import { buildOnHandCounts } from '@/lib/inventory-mapper'
import { clinicalAlternateSets, getVariantLabel, getTubName } from '@/lib/plan-config'
import type { ConversionLikelihood } from '@/lib/plan-config'
import type { SupabaseClient } from '@supabase/supabase-js'

// ------- Types -------

export interface CaseSummary {
  id: string
  case_id: string
  surgeon_name: string
  procedure_name: string
  surgery_date: string
  side: 'left' | 'right' | 'unknown'
  procedure_type: 'knee' | 'hip'
}

interface ImplantPlan {
  id: string
  surgeon_name: string
  procedure_type: string
  plan_type: string
  plan_label: string | null
  conversion_likelihood: string | null
  femur_variant: string | null
  tibia_variant: string | null
  patella_variant: string | null
  poly_variants: string[] | null
  notes: string | null
}

export interface DemandSource {
  surgeon: string
  plan_type: string
  plan_label: string | null
  cases: number
  sets: number
}

export interface VariantCoverage {
  component: string        // 'femur', 'tibia', 'patella', 'poly'
  variant: string          // 'cr_pressfit', 'universal', 'cs', etc.
  side: string | null      // 'left', 'right', or null
  display_name: string     // "Left CR Pressfit Femur"
  tub_name: string         // "Left CR Pressfit Femur Tub"
  sets_needed: number
  sets_on_hand: number
  gap: number
  status: 'covered' | 'short'
  demand_breakdown: DemandSource[]
}

export interface CoverageResult {
  facility_id: string
  facility_name: string
  date: string
  total_cases: number
  cases: CaseSummary[]
  cases_by_surgeon: { surgeon: string; display_name: string; count: number; left: number; right: number }[]
  coverage: VariantCoverage[]
  recommendations: {
    tub_name: string
    variant: string
    side: string | null
    component: string
    tubs_needed: number
    priority: 'required' | 'recommended'
  }[]
  no_plans: string[]  // Surgeons with cases but no implant plans configured
}

// ------- Helpers -------

function detectSide(procedureName: string): 'left' | 'right' | 'unknown' {
  const lower = procedureName.toLowerCase()
  if (lower.includes('left') || lower.includes(' lt ') || lower.startsWith('lt ')) return 'left'
  if (lower.includes('right') || lower.includes(' rt ') || lower.startsWith('rt ')) return 'right'
  return 'unknown'
}

function detectProcedureType(procedureName: string): 'knee' | 'hip' {
  const lower = procedureName.toLowerCase()
  if (lower.includes('hip') || lower.includes('tha')) return 'hip'
  return 'knee'
}

// Count complete sets for a given variant from on-hand counts
// A complete set = at least 1 of every size in the variant
function countCompleteSets(
  onHand: Record<string, number>,
  category: string,
  variant: string,
  sizes: string[],
): number {
  if (sizes.length === 0) return 0
  const counts = sizes.map((size) => onHand[`${category}|${variant}|${size}`] ?? 0)
  return Math.min(...counts)
}

// Map femur variant to its grid category + grid variants (left/right)
function femurGridVariants(variant: string, side: string | null): { category: string; gridVariants: string[] } {
  if (side === 'left') return { category: 'knee_femur', gridVariants: [`left_${variant}`] }
  if (side === 'right') return { category: 'knee_femur', gridVariants: [`right_${variant}`] }
  // Unknown side — check both
  return { category: 'knee_femur', gridVariants: [`left_${variant}`, `right_${variant}`] }
}

const FEMUR_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']
const TIBIA_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']
const PATELLA_SIZES: Record<string, string[]> = {
  asym_pressfit: ['29', '32', '35', '38', '40'],
  asym_cemented: ['29', '32', '35', '38', '40'],
  sym_pressfit: ['29', '31', '33', '36', '39'],
  sym_cemented: ['27', '29', '31', '33', '36', '39'],
}
// For poly, a "complete set" = all 8 knee sizes present (we check by knee size, not thickness)
const POLY_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']

// ------- Main Engine -------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateDailyCoverage(
  supabase: SupabaseClient<any, any, any>,
  facilityId: string,
  date: string,
): Promise<CoverageResult> {
  // Get facility name
  const { data: facility } = await supabase
    .from('facilities')
    .select('name')
    .eq('id', facilityId)
    .single()

  // Get cases for the day
  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const { data: rawCases } = await supabase
    .from('cases')
    .select('id, case_id, surgeon_name, procedure_name, surgery_date')
    .eq('facility_id', facilityId)
    .gte('surgery_date', dayStart)
    .lte('surgery_date', dayEnd)
    .neq('status', 'Completed')
    .neq('status', 'Cancelled')

  const cases: CaseSummary[] = (rawCases ?? []).map((c) => ({
    id: c.id,
    case_id: c.case_id,
    surgeon_name: c.surgeon_name ?? '',
    procedure_name: c.procedure_name ?? '',
    surgery_date: c.surgery_date,
    side: detectSide(c.procedure_name ?? ''),
    procedure_type: detectProcedureType(c.procedure_name ?? ''),
  }))

  // Group by surgeon
  const surgeonCounts: Record<string, { count: number; left: number; right: number }> = {}
  for (const c of cases) {
    if (!c.surgeon_name) continue
    if (!surgeonCounts[c.surgeon_name]) surgeonCounts[c.surgeon_name] = { count: 0, left: 0, right: 0 }
    surgeonCounts[c.surgeon_name].count++
    if (c.side === 'left') surgeonCounts[c.surgeon_name].left++
    else if (c.side === 'right') surgeonCounts[c.surgeon_name].right++
    else {
      // Unknown side — count as both for safety
      surgeonCounts[c.surgeon_name].left++
      surgeonCounts[c.surgeon_name].right++
    }
  }

  // Get surgeon display names
  const surgeonNames = Object.keys(surgeonCounts)
  const { data: mappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')
    .in('repsuite_name', surgeonNames)

  const nameMap: Record<string, string> = {}
  mappings?.forEach((m) => { nameMap[m.repsuite_name] = m.display_name })

  const casesBySurgeon = Object.entries(surgeonCounts).map(([name, c]) => ({
    surgeon: name,
    display_name: nameMap[name] ?? name.replace(/^\d+ - /, ''),
    count: c.count,
    left: c.left,
    right: c.right,
  }))

  // Get implant plans for all surgeons
  const { data: allPlans } = await supabase
    .from('surgeon_implant_plans')
    .select('*')
    .in('surgeon_name', surgeonNames)

  const plans: ImplantPlan[] = allPlans ?? []

  // Track surgeons with no plans
  const surgeonsWithPlans = new Set(plans.map((p) => p.surgeon_name))
  const noPlans = surgeonNames.filter((n) => !surgeonsWithPlans.has(n))

  // ------- Calculate demand per variant -------
  // Key: component|variant|side → { sets_needed, sources[] }
  const demand: Record<string, { sets: number; sources: DemandSource[] }> = {}

  function addDemand(
    component: string,
    variant: string,
    side: string | null,
    sets: number,
    surgeon: string,
    planType: string,
    planLabel: string | null,
    cases: number,
  ) {
    if (!variant || sets <= 0) return
    const key = `${component}|${variant}|${side ?? 'any'}`
    if (!demand[key]) demand[key] = { sets: 0, sources: [] }
    demand[key].sets += sets
    demand[key].sources.push({
      surgeon: nameMap[surgeon] ?? surgeon.replace(/^\d+ - /, ''),
      plan_type: planType,
      plan_label: planLabel,
      cases,
      sets,
    })
  }

  for (const surgeon of surgeonNames) {
    const sc = surgeonCounts[surgeon]
    const surgeonPlans = plans.filter((p) => p.surgeon_name === surgeon)

    for (const plan of surgeonPlans) {
      const procType = plan.procedure_type
      if (procType === 'hip') {
        // Hip — stem/cup/liner/head mapped to femur/tibia/patella/poly fields
        const totalCases = sc.count
        let sets: number
        if (plan.plan_type === 'primary') sets = totalCases
        else if (plan.plan_type === 'cemented_fallback') sets = totalCases
        else sets = clinicalAlternateSets(plan.conversion_likelihood as ConversionLikelihood ?? 'low', totalCases)

        if (plan.femur_variant) addDemand('stem', plan.femur_variant, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
        if (plan.tibia_variant) addDemand('cup', plan.tibia_variant, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
        if (plan.patella_variant) addDemand('liner', plan.patella_variant, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
        if (plan.poly_variants) {
          for (const pv of plan.poly_variants) {
            addDemand('head', pv, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
          }
        }
        continue
      }

      // Knee
      const leftCases = sc.left
      const rightCases = sc.right
      const totalCases = sc.count

      // Femur — side-specific
      if (plan.femur_variant) {
        if (plan.plan_type === 'primary') {
          if (leftCases > 0) addDemand('femur', plan.femur_variant, 'left', leftCases, surgeon, plan.plan_type, plan.plan_label, leftCases)
          if (rightCases > 0) addDemand('femur', plan.femur_variant, 'right', rightCases, surgeon, plan.plan_type, plan.plan_label, rightCases)
        } else if (plan.plan_type === 'cemented_fallback') {
          // 1:1 with primary
          if (leftCases > 0) addDemand('femur', plan.femur_variant, 'left', leftCases, surgeon, plan.plan_type, plan.plan_label, leftCases)
          if (rightCases > 0) addDemand('femur', plan.femur_variant, 'right', rightCases, surgeon, plan.plan_type, plan.plan_label, rightCases)
        } else {
          const altSets = clinicalAlternateSets((plan.conversion_likelihood as ConversionLikelihood) ?? 'low', totalCases)
          // For clinical alt, we need sets for both sides since any case could convert
          if (leftCases > 0) {
            const leftAlt = clinicalAlternateSets((plan.conversion_likelihood as ConversionLikelihood) ?? 'low', leftCases)
            addDemand('femur', plan.femur_variant, 'left', leftAlt, surgeon, plan.plan_type, plan.plan_label, leftCases)
          }
          if (rightCases > 0) {
            const rightAlt = clinicalAlternateSets((plan.conversion_likelihood as ConversionLikelihood) ?? 'low', rightCases)
            addDemand('femur', plan.femur_variant, 'right', rightAlt, surgeon, plan.plan_type, plan.plan_label, rightCases)
          }
        }
      }

      // Tibia, Patella — not side-specific
      for (const [component, variant] of [['tibia', plan.tibia_variant], ['patella', plan.patella_variant]] as const) {
        if (!variant) continue
        let sets: number
        if (plan.plan_type === 'primary') sets = totalCases
        else if (plan.plan_type === 'cemented_fallback') sets = totalCases
        else sets = clinicalAlternateSets((plan.conversion_likelihood as ConversionLikelihood) ?? 'low', totalCases)
        addDemand(component, variant, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
      }

      // Poly — not side-specific, can be array
      if (plan.poly_variants) {
        for (const pv of plan.poly_variants) {
          let sets: number
          if (plan.plan_type === 'primary') sets = totalCases
          else if (plan.plan_type === 'cemented_fallback') sets = totalCases
          else sets = clinicalAlternateSets((plan.conversion_likelihood as ConversionLikelihood) ?? 'low', totalCases)
          addDemand('poly', pv, null, sets, surgeon, plan.plan_type, plan.plan_label, totalCases)
        }
      }
    }
  }

  // ------- Count sets on hand -------
  const { data: inventoryItems } = await supabase
    .from('facility_inventory')
    .select('gtin, reference_number')
    .eq('facility_id', facilityId)

  const onHand = buildOnHandCounts(inventoryItems ?? [])

  // Also count loaner kit parts at facility
  const { data: loanerCases } = await supabase
    .from('cases')
    .select('sf_id')
    .eq('facility_id', facilityId)
    .in('status', ['Shipped/Ready for Surgery', 'Assigned'])

  const sfIds = (loanerCases ?? []).map((c) => c.sf_id).filter(Boolean)
  if (sfIds.length > 0) {
    const { data: caseParts } = await supabase
      .from('case_parts')
      .select('catalog_number, quantity, is_loaner')
      .in('case_sf_id', sfIds)
      .eq('is_loaner', true)

    if (caseParts) {
      const kitItems = caseParts
        .filter((p) => p.catalog_number)
        .map((p) => ({ gtin: null, reference_number: p.catalog_number }))
      const kitCounts = buildOnHandCounts(kitItems)
      for (const [key, count] of Object.entries(kitCounts)) {
        onHand[key] = (onHand[key] ?? 0) + count
      }
    }
  }

  // ------- Build coverage results -------
  const coverage: VariantCoverage[] = []

  for (const [key, d] of Object.entries(demand)) {
    const [component, variant, sideKey] = key.split('|')
    const side = sideKey === 'any' ? null : sideKey

    // Count complete sets on hand for this variant
    let setsOnHand = 0

    if (component === 'femur') {
      const gridVariant = side ? `${side}_${variant}` : variant
      setsOnHand = countCompleteSets(onHand, 'knee_femur', gridVariant, FEMUR_SIZES)
    } else if (component === 'tibia') {
      setsOnHand = countCompleteSets(onHand, 'knee_tibia', variant, TIBIA_SIZES)
    } else if (component === 'patella') {
      const sizes = PATELLA_SIZES[variant] ?? ['29', '32', '35', '38', '40']
      setsOnHand = countCompleteSets(onHand, 'knee_patella', variant, sizes)
    } else if (component === 'poly') {
      // Poly: category = knee_poly_cs/ps/ts, variants = knee sizes 1-8
      // A complete set = at least 1 of each knee size (across all thicknesses)
      const cat = `knee_poly_${variant}`
      // Check: for each knee size, do they have at least 1 poly of any thickness?
      const thicknesses = variant === 'ts'
        ? ['9', '11', '13', '16', '19', '22', '25', '28', '31']
        : ['9', '10', '11', '12', '13', '14', '16', '19']

      // For each knee size, total polys across all thicknesses
      const perSizeTotals = POLY_SIZES.map((ks) => {
        let total = 0
        for (const th of thicknesses) {
          total += onHand[`${cat}|${ks}|${th}`] ?? 0
        }
        return total
      })
      setsOnHand = Math.min(...perSizeTotals)
    }
    // TODO: hip components — skip for now

    const gap = Math.max(0, d.sets - setsOnHand)
    const sideLabel = side ? (side === 'left' ? 'Left' : 'Right') : null
    const displayName = `${sideLabel ? sideLabel + ' ' : ''}${getVariantLabel(variant)} ${component.charAt(0).toUpperCase() + component.slice(1)}`

    coverage.push({
      component,
      variant,
      side,
      display_name: displayName,
      tub_name: getTubName(component, variant, side ?? undefined),
      sets_needed: d.sets,
      sets_on_hand: setsOnHand,
      gap,
      status: gap <= 0 ? 'covered' : 'short',
      demand_breakdown: d.sources,
    })
  }

  // Sort: shorts first, then by component
  coverage.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'short' ? -1 : 1
    return a.display_name.localeCompare(b.display_name)
  })

  // Build recommendations
  const recommendations = coverage
    .filter((c) => c.gap > 0)
    .map((c) => {
      // Required if any demand source is primary or cemented_fallback
      const hasRequired = c.demand_breakdown.some((d) =>
        d.plan_type === 'primary' || d.plan_type === 'cemented_fallback'
      )
      return {
        tub_name: c.tub_name,
        variant: c.variant,
        side: c.side,
        component: c.component,
        tubs_needed: c.gap,
        priority: hasRequired ? 'required' as const : 'recommended' as const,
      }
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'required' ? -1 : 1
      return a.tub_name.localeCompare(b.tub_name)
    })

  return {
    facility_id: facilityId,
    facility_name: facility?.name ?? facilityId,
    date,
    total_cases: cases.length,
    cases,
    cases_by_surgeon: casesBySurgeon,
    coverage,
    recommendations,
    no_plans: noPlans.map((n) => nameMap[n] ?? n.replace(/^\d+ - /, '')),
  }
}
