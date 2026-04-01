import { buildOnHandCounts } from '@/lib/inventory-mapper'
import { clinicalAlternateSets, getVariantLabel, getTubName } from '@/lib/plan-config'
import type { ConversionLikelihood, ImplantPlanTemplate } from '@/lib/plan-config'
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
  plan_id: string | null
  plan_name: string | null
}

export interface DemandSource {
  surgeon: string
  plan_name: string
  plan_section: string  // 'primary', 'cemented', 'clinical_alt'
  cases: number
  sets: number
}

export interface VariantCoverage {
  component: string
  variant: string
  side: string | null
  display_name: string
  tub_name: string
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
  no_plans: string[]       // Cases with no plan assigned
  no_plan_surgeons: string[]  // Surgeons with no plans configured at all
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

const FEMUR_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']
const TIBIA_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']
const PATELLA_SIZES: Record<string, string[]> = {
  asym_pressfit: ['29', '32', '35', '38', '40'],
  asym_cemented: ['29', '32', '35', '38', '40'],
  sym_pressfit: ['29', '31', '33', '36', '39'],
  sym_cemented: ['27', '29', '31', '33', '36', '39'],
}
const POLY_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8']

// ------- Main Engine -------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateDailyCoverage(
  supabase: SupabaseClient<any, any, any>,
  facilityId: string,
  date: string,
): Promise<CoverageResult> {
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
    .select('id, case_id, surgeon_name, procedure_name, surgery_date, plan_id')
    .eq('facility_id', facilityId)
    .gte('surgery_date', dayStart)
    .lte('surgery_date', dayEnd)
    .neq('status', 'Completed')
    .neq('status', 'Cancelled')

  // Load all plans referenced by cases + default plans for surgeons without assignments
  const surgeonNames = [...new Set((rawCases ?? []).map((c) => c.surgeon_name).filter(Boolean))]
  const planIds = [...new Set((rawCases ?? []).map((c) => c.plan_id).filter(Boolean))]

  const { data: allPlans } = await supabase
    .from('surgeon_implant_plans')
    .select('*')
    .in('surgeon_name', surgeonNames.length > 0 ? surgeonNames : ['__none__'])

  const planMap = new Map<string, ImplantPlanTemplate>()
  const defaultPlans = new Map<string, ImplantPlanTemplate>() // key: surgeon|procType
  for (const p of (allPlans ?? []) as ImplantPlanTemplate[]) {
    planMap.set(p.id, p)
    if (p.is_default) {
      defaultPlans.set(`${p.surgeon_name}|${p.procedure_type}`, p)
    }
  }

  // Get surgeon display names
  const { data: mappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')
    .in('repsuite_name', surgeonNames.length > 0 ? surgeonNames : ['__none__'])

  const nameMap: Record<string, string> = {}
  mappings?.forEach((m) => { nameMap[m.repsuite_name] = m.display_name })
  const displayName = (raw: string) => nameMap[raw] ?? raw.replace(/^\d+ - /, '')

  // Build case summaries with resolved plans
  const cases: CaseSummary[] = (rawCases ?? []).map((c) => {
    const procType = detectProcedureType(c.procedure_name ?? '')
    let planId = c.plan_id
    let planName: string | null = null

    // If no plan assigned, try default
    if (!planId && c.surgeon_name) {
      const def = defaultPlans.get(`${c.surgeon_name}|${procType}`)
      if (def) {
        planId = def.id
        planName = `${def.plan_name} (default)`
      }
    } else if (planId) {
      planName = planMap.get(planId)?.plan_name ?? null
    }

    return {
      id: c.id,
      case_id: c.case_id ?? '',
      surgeon_name: c.surgeon_name ?? '',
      procedure_name: c.procedure_name ?? '',
      surgery_date: c.surgery_date,
      side: detectSide(c.procedure_name ?? ''),
      procedure_type: procType,
      plan_id: planId,
      plan_name: planName,
    }
  })

  // Group by surgeon for summary
  const surgeonCounts: Record<string, { count: number; left: number; right: number }> = {}
  for (const c of cases) {
    if (!c.surgeon_name) continue
    if (!surgeonCounts[c.surgeon_name]) surgeonCounts[c.surgeon_name] = { count: 0, left: 0, right: 0 }
    surgeonCounts[c.surgeon_name].count++
    if (c.side === 'left') surgeonCounts[c.surgeon_name].left++
    else if (c.side === 'right') surgeonCounts[c.surgeon_name].right++
    else { surgeonCounts[c.surgeon_name].left++; surgeonCounts[c.surgeon_name].right++ }
  }

  const casesBySurgeon = Object.entries(surgeonCounts).map(([name, c]) => ({
    surgeon: name, display_name: displayName(name), count: c.count, left: c.left, right: c.right,
  }))

  // Track cases with no plan
  const noPlanCases = cases.filter((c) => !c.plan_id)
  const surgeonsWithAnyPlan = new Set((allPlans ?? []).map((p: ImplantPlanTemplate) => p.surgeon_name))
  const noPlanSurgeons = [...new Set(noPlanCases.map((c) => c.surgeon_name))].filter((n) => !surgeonsWithAnyPlan.has(n))

  // ------- Calculate demand per variant -------
  const demand: Record<string, { sets: number; sources: DemandSource[] }> = {}

  function addDemand(
    component: string, variant: string, side: string | null,
    sets: number, surgeon: string, planName: string, section: string, cases: number,
  ) {
    if (!variant || sets <= 0) return
    const key = `${component}|${variant}|${side ?? 'any'}`
    if (!demand[key]) demand[key] = { sets: 0, sources: [] }
    demand[key].sets += sets
    demand[key].sources.push({ surgeon: displayName(surgeon), plan_name: planName, plan_section: section, cases, sets })
  }

  // Group cases by plan_id to aggregate
  const casesByPlan: Record<string, CaseSummary[]> = {}
  for (const c of cases) {
    if (!c.plan_id) continue
    if (!casesByPlan[c.plan_id]) casesByPlan[c.plan_id] = []
    casesByPlan[c.plan_id].push(c)
  }

  for (const [planId, planCases] of Object.entries(casesByPlan)) {
    const plan = planMap.get(planId)
    if (!plan) continue

    const leftCases = planCases.filter((c) => c.side === 'left' || c.side === 'unknown').length
    const rightCases = planCases.filter((c) => c.side === 'right' || c.side === 'unknown').length
    const totalCases = planCases.length
    const surgeon = planCases[0].surgeon_name
    const pName = plan.plan_name

    if (plan.procedure_type === 'hip') {
      // Hip: femur=stem, tibia=cup, patella=liner, poly=head
      if (plan.femur_variant) addDemand('stem', plan.femur_variant, null, totalCases, surgeon, pName, 'primary', totalCases)
      if (plan.tibia_variant) addDemand('cup', plan.tibia_variant, null, totalCases, surgeon, pName, 'primary', totalCases)
      if (plan.patella_variant) addDemand('liner', plan.patella_variant, null, totalCases, surgeon, pName, 'primary', totalCases)
      for (const pv of plan.poly_variants ?? []) addDemand('head', pv, null, totalCases, surgeon, pName, 'primary', totalCases)
      // TODO: cemented fallback and clinical alternate for hip
      continue
    }

    // Knee — Primary
    if (plan.femur_variant) {
      if (leftCases > 0) addDemand('femur', plan.femur_variant, 'left', leftCases, surgeon, pName, 'primary', leftCases)
      if (rightCases > 0) addDemand('femur', plan.femur_variant, 'right', rightCases, surgeon, pName, 'primary', rightCases)
    }
    if (plan.tibia_variant) addDemand('tibia', plan.tibia_variant, null, totalCases, surgeon, pName, 'primary', totalCases)
    if (plan.patella_variant) addDemand('patella', plan.patella_variant, null, totalCases, surgeon, pName, 'primary', totalCases)
    for (const pv of plan.poly_variants ?? []) addDemand('poly', pv, null, totalCases, surgeon, pName, 'primary', totalCases)

    // Cemented fallback — 1:1 with primary, only for components that change
    if (plan.cemented_femur_variant) {
      if (leftCases > 0) addDemand('femur', plan.cemented_femur_variant, 'left', leftCases, surgeon, pName, 'cemented', leftCases)
      if (rightCases > 0) addDemand('femur', plan.cemented_femur_variant, 'right', rightCases, surgeon, pName, 'cemented', rightCases)
    }
    if (plan.cemented_tibia_variant) addDemand('tibia', plan.cemented_tibia_variant, null, totalCases, surgeon, pName, 'cemented', totalCases)
    if (plan.cemented_patella_variant) addDemand('patella', plan.cemented_patella_variant, null, totalCases, surgeon, pName, 'cemented', totalCases)

    // Clinical alternate
    if (plan.has_clinical_alternate) {
      const likelihood = (plan.alt_conversion_likelihood ?? 'low') as ConversionLikelihood
      if (plan.alt_femur_variant) {
        if (leftCases > 0) {
          const s = clinicalAlternateSets(likelihood, leftCases)
          addDemand('femur', plan.alt_femur_variant, 'left', s, surgeon, pName, 'clinical_alt', leftCases)
        }
        if (rightCases > 0) {
          const s = clinicalAlternateSets(likelihood, rightCases)
          addDemand('femur', plan.alt_femur_variant, 'right', s, surgeon, pName, 'clinical_alt', rightCases)
        }
      }
      if (plan.alt_tibia_variant) {
        const s = clinicalAlternateSets(likelihood, totalCases)
        addDemand('tibia', plan.alt_tibia_variant, null, s, surgeon, pName, 'clinical_alt', totalCases)
      }
      if (plan.alt_patella_variant) {
        const s = clinicalAlternateSets(likelihood, totalCases)
        addDemand('patella', plan.alt_patella_variant, null, s, surgeon, pName, 'clinical_alt', totalCases)
      }
      for (const pv of plan.alt_poly_variants ?? []) {
        const s = clinicalAlternateSets(likelihood, totalCases)
        addDemand('poly', pv, null, s, surgeon, pName, 'clinical_alt', totalCases)
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
      const kitCounts = buildOnHandCounts(
        caseParts.filter((p) => p.catalog_number).map((p) => ({ gtin: null, reference_number: p.catalog_number }))
      )
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

    let setsOnHand = 0
    if (component === 'femur') {
      const gridVariant = side ? `${side}_${variant}` : variant
      setsOnHand = countCompleteSets(onHand, 'knee_femur', gridVariant, FEMUR_SIZES)
    } else if (component === 'tibia') {
      setsOnHand = countCompleteSets(onHand, 'knee_tibia', variant, TIBIA_SIZES)
    } else if (component === 'patella') {
      setsOnHand = countCompleteSets(onHand, 'knee_patella', variant, PATELLA_SIZES[variant] ?? ['29', '32', '35', '38', '40'])
    } else if (component === 'poly') {
      const cat = `knee_poly_${variant}`
      const thicknesses = variant === 'ts'
        ? ['9', '11', '13', '16', '19', '22', '25', '28', '31']
        : ['9', '10', '11', '12', '13', '14', '16', '19']
      const perSizeTotals = POLY_SIZES.map((ks) => {
        let total = 0
        for (const th of thicknesses) total += onHand[`${cat}|${ks}|${th}`] ?? 0
        return total
      })
      setsOnHand = Math.min(...perSizeTotals)
    }

    const gap = Math.max(0, d.sets - setsOnHand)
    const sideLabel = side ? (side === 'left' ? 'Left' : 'Right') : null
    const displayNameStr = `${sideLabel ? sideLabel + ' ' : ''}${getVariantLabel(variant)} ${component.charAt(0).toUpperCase() + component.slice(1)}`

    coverage.push({
      component, variant, side,
      display_name: displayNameStr,
      tub_name: getTubName(component, variant, side ?? undefined),
      sets_needed: d.sets, sets_on_hand: setsOnHand, gap,
      status: gap <= 0 ? 'covered' : 'short',
      demand_breakdown: d.sources,
    })
  }

  coverage.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'short' ? -1 : 1
    return a.display_name.localeCompare(b.display_name)
  })

  const recommendations = coverage
    .filter((c) => c.gap > 0)
    .map((c) => {
      const hasRequired = c.demand_breakdown.some((d) => d.plan_section === 'primary' || d.plan_section === 'cemented')
      return {
        tub_name: c.tub_name, variant: c.variant, side: c.side, component: c.component,
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
    no_plans: noPlanCases.map((c) => `${displayName(c.surgeon_name)} — ${c.procedure_name}`),
    no_plan_surgeons: noPlanSurgeons.map(displayName),
  }
}
