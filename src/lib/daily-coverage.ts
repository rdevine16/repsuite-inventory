import { buildOnHandCounts } from '@/lib/inventory-mapper'
import { frequencySets, getVariantLabel, getTubName } from '@/lib/plan-config'
import type { Frequency } from '@/lib/plan-config'
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
  sub_plan_name: string
  frequency: string
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
  no_plans: string[]
  no_plan_surgeons: string[]
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
  onHand: Record<string, number>, category: string, variant: string, sizes: string[],
): number {
  if (sizes.length === 0) return 0
  return Math.min(...sizes.map((size) => onHand[`${category}|${variant}|${size}`] ?? 0))
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
    .from('facilities').select('name').eq('id', facilityId).single()

  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const { data: rawCases } = await supabase
    .from('cases')
    .select('id, case_id, surgeon_name, procedure_name, surgery_date, plan_id')
    .eq('facility_id', facilityId)
    .gte('surgery_date', dayStart)
    .lte('surgery_date', dayEnd)
    .not('status', 'in', '("Completed","Cancelled")')

  const surgeonNames = [...new Set((rawCases ?? []).map((c) => c.surgeon_name).filter(Boolean))]

  // Load templates with sub-plans and items
  const { data: allTemplates } = await supabase
    .from('surgeon_implant_plans').select('*')
    .in('surgeon_name', surgeonNames.length > 0 ? surgeonNames : ['__none__'])

  const { data: allSubPlans } = await supabase
    .from('plan_sub_plans').select('*').order('sort_order')

  const { data: allItems } = await supabase
    .from('plan_sub_plan_items').select('*')

  // Build nested lookup
  const itemsBySp: Record<string, { component: string; variant: string; side: string | null }[]> = {}
  for (const item of allItems ?? []) {
    if (!itemsBySp[item.sub_plan_id]) itemsBySp[item.sub_plan_id] = []
    itemsBySp[item.sub_plan_id].push({ component: item.component, variant: item.variant, side: item.side })
  }

  interface FullSubPlan { id: string; name: string; frequency: Frequency; items: { component: string; variant: string; side: string | null }[] }
  const subPlansByTemplate: Record<string, FullSubPlan[]> = {}
  for (const sp of allSubPlans ?? []) {
    if (!subPlansByTemplate[sp.template_id]) subPlansByTemplate[sp.template_id] = []
    subPlansByTemplate[sp.template_id].push({
      id: sp.id, name: sp.name, frequency: sp.frequency as Frequency,
      items: itemsBySp[sp.id] ?? [],
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateMap = new Map<string, { plan_name: string; sub_plans: FullSubPlan[] }>()
  const defaultPlans = new Map<string, string>() // surgeon|procType → template_id
  for (const t of allTemplates ?? []) {
    templateMap.set(t.id, { plan_name: t.plan_name, sub_plans: subPlansByTemplate[t.id] ?? [] })
    if (t.is_default) defaultPlans.set(`${t.surgeon_name}|${t.procedure_type}`, t.id)
  }

  // Surgeon display names
  const { data: mappings } = await supabase
    .from('surgeon_mappings').select('repsuite_name, display_name')
    .in('repsuite_name', surgeonNames.length > 0 ? surgeonNames : ['__none__'])
  const nameMap: Record<string, string> = {}
  mappings?.forEach((m) => { nameMap[m.repsuite_name] = m.display_name })
  const displayName = (raw: string) => nameMap[raw] ?? raw.replace(/^\d+ - /, '')

  // Build cases
  const cases: CaseSummary[] = (rawCases ?? []).map((c) => {
    const procType = detectProcedureType(c.procedure_name ?? '')
    let planId = c.plan_id
    let planName: string | null = null

    if (!planId && c.surgeon_name) {
      const defId = defaultPlans.get(`${c.surgeon_name}|${procType}`)
      if (defId) { planId = defId; planName = `${templateMap.get(defId)?.plan_name ?? ''} (default)` }
    } else if (planId) {
      planName = templateMap.get(planId)?.plan_name ?? null
    }

    return {
      id: c.id, case_id: c.case_id ?? '', surgeon_name: c.surgeon_name ?? '',
      procedure_name: c.procedure_name ?? '', surgery_date: c.surgery_date,
      side: detectSide(c.procedure_name ?? ''), procedure_type: procType,
      plan_id: planId, plan_name: planName,
    }
  })

  // Surgeon summary
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

  const noPlanCases = cases.filter((c) => !c.plan_id)
  const surgeonsWithAnyPlan = new Set((allTemplates ?? []).map((t: { surgeon_name: string }) => t.surgeon_name))
  const noPlanSurgeons = [...new Set(noPlanCases.map((c) => c.surgeon_name))].filter((n) => !surgeonsWithAnyPlan.has(n))

  // ------- Calculate demand -------
  const demand: Record<string, { sets: number; sources: DemandSource[] }> = {}

  function addDemand(
    component: string, variant: string, side: string | null,
    sets: number, surgeon: string, planName: string, subPlanName: string, freq: string, cases: number,
  ) {
    if (!variant || sets <= 0) return
    const key = `${component}|${variant}|${side ?? 'any'}`
    if (!demand[key]) demand[key] = { sets: 0, sources: [] }
    demand[key].sets += sets
    demand[key].sources.push({ surgeon: displayName(surgeon), plan_name: planName, sub_plan_name: subPlanName, frequency: freq, cases, sets })
  }

  // Group cases by plan
  const casesByPlan: Record<string, CaseSummary[]> = {}
  for (const c of cases) {
    if (!c.plan_id) continue
    if (!casesByPlan[c.plan_id]) casesByPlan[c.plan_id] = []
    casesByPlan[c.plan_id].push(c)
  }

  for (const [planId, planCases] of Object.entries(casesByPlan)) {
    const tmpl = templateMap.get(planId)
    if (!tmpl) continue

    const leftCases = planCases.filter((c) => c.side === 'left' || c.side === 'unknown').length
    const rightCases = planCases.filter((c) => c.side === 'right' || c.side === 'unknown').length
    const totalCases = planCases.length
    const surgeon = planCases[0].surgeon_name

    for (const sp of tmpl.sub_plans) {
      const sets = frequencySets(sp.frequency, totalCases)

      for (const item of sp.items) {
        if (item.component === 'femur' || (item.side === 'left' || item.side === 'right')) {
          // Side-specific: calculate per side
          const itemSide = item.side
          if (itemSide === 'left' || (!itemSide && leftCases > 0)) {
            const s = frequencySets(sp.frequency, leftCases)
            addDemand(item.component, item.variant, itemSide ?? 'left', s, surgeon, tmpl.plan_name, sp.name, sp.frequency, leftCases)
          }
          if (itemSide === 'right' || (!itemSide && rightCases > 0)) {
            const s = frequencySets(sp.frequency, rightCases)
            addDemand(item.component, item.variant, itemSide ?? 'right', s, surgeon, tmpl.plan_name, sp.name, sp.frequency, rightCases)
          }
          // If no side specified on item and case side is unknown, already counted in both
        } else {
          addDemand(item.component, item.variant, item.side, sets, surgeon, tmpl.plan_name, sp.name, sp.frequency, totalCases)
        }
      }
    }
  }

  // ------- Count sets on hand -------
  const { data: inventoryItems } = await supabase
    .from('facility_inventory').select('gtin, reference_number').eq('facility_id', facilityId)
  const onHand = buildOnHandCounts(inventoryItems ?? [])

  const { data: loanerCases } = await supabase
    .from('cases').select('sf_id').eq('facility_id', facilityId)
    .in('status', ['Shipped/Ready for Surgery', 'Assigned'])
  const sfIds = (loanerCases ?? []).map((c) => c.sf_id).filter(Boolean)
  if (sfIds.length > 0) {
    const { data: caseParts } = await supabase
      .from('case_parts').select('catalog_number, quantity, is_loaner')
      .in('case_sf_id', sfIds).eq('is_loaner', true)
    if (caseParts) {
      const kitCounts = buildOnHandCounts(
        caseParts.filter((p) => p.catalog_number).map((p) => ({ gtin: null, reference_number: p.catalog_number }))
      )
      for (const [key, count] of Object.entries(kitCounts)) onHand[key] = (onHand[key] ?? 0) + count
    }
  }

  // ------- Build coverage -------
  const coverage: VariantCoverage[] = []

  for (const [key, d] of Object.entries(demand)) {
    const [component, variant, sideKey] = key.split('|')
    const side = sideKey === 'any' ? null : sideKey

    let setsOnHand = 0
    if (component === 'femur') {
      const gv = side ? `${side}_${variant}` : variant
      setsOnHand = countCompleteSets(onHand, 'knee_femur', gv, FEMUR_SIZES)
    } else if (component === 'tibia') {
      setsOnHand = countCompleteSets(onHand, 'knee_tibia', variant, TIBIA_SIZES)
    } else if (component === 'patella') {
      setsOnHand = countCompleteSets(onHand, 'knee_patella', variant, PATELLA_SIZES[variant] ?? ['29', '32', '35', '38', '40'])
    } else if (component === 'poly') {
      const cat = `knee_poly_${variant}`
      const ths = variant === 'ts' ? ['9', '11', '13', '16', '19', '22', '25', '28', '31'] : ['9', '10', '11', '12', '13', '14', '16', '19']
      setsOnHand = Math.min(...POLY_SIZES.map((ks) => {
        let t = 0; for (const th of ths) t += onHand[`${cat}|${ks}|${th}`] ?? 0; return t
      }))
    }

    const gap = Math.max(0, d.sets - setsOnHand)
    const sl = side ? (side === 'left' ? 'Left' : 'Right') : null
    const dn = `${sl ? sl + ' ' : ''}${getVariantLabel(variant)} ${component.charAt(0).toUpperCase() + component.slice(1)}`

    coverage.push({
      component, variant, side, display_name: dn,
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

  const recommendations = coverage.filter((c) => c.gap > 0).map((c) => {
    const hasRequired = c.demand_breakdown.some((d) => d.frequency === 'every_case')
    return {
      tub_name: c.tub_name, variant: c.variant, side: c.side, component: c.component,
      tubs_needed: c.gap,
      priority: hasRequired ? 'required' as const : 'recommended' as const,
    }
  }).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'required' ? -1 : 1
    return a.tub_name.localeCompare(b.tub_name)
  })

  return {
    facility_id: facilityId, facility_name: facility?.name ?? facilityId,
    date, total_cases: cases.length, cases, cases_by_surgeon: casesBySurgeon,
    coverage, recommendations,
    no_plans: noPlanCases.map((c) => `${displayName(c.surgeon_name)} — ${c.procedure_name}`),
    no_plan_surgeons: noPlanSurgeons.map(displayName),
  }
}
