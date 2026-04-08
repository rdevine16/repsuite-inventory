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
  status: string | null
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
  sets_needed: number       // raw demand (1:1 with cases)
  target_sets: number       // demand adjusted by coverage ratio
  sets_on_hand: number      // permanent hospital inventory
  sets_requested: number    // total requested from warehouse (shipped + in transit)
  sets_shipped: number      // portion of requested that has shipped
  gap: number               // target_sets - (on_hand + requested). 0 = on target
  status: 'on_target' | 'below_target' | 'covered'
  demand_breakdown: DemandSource[]
}

export interface CoverageResult {
  facility_id: string
  facility_name: string
  date: string
  coverage_ratio: number
  total_cases: number
  knee_cases: number
  hip_cases: number
  cases: CaseSummary[]
  cases_by_surgeon: { surgeon: string; display_name: string; count: number; left: number; right: number; procedure_type: string }[]
  coverage: VariantCoverage[]
  recommendations: {
    tub_name: string
    variant: string
    side: string | null
    component: string
    tubs_needed: number
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

// Fallback sizes if variant_sizes table has no entry
const FALLBACK_SIZES: Record<string, string[]> = {
  femur: ['1', '2', '3', '4', '5', '6', '7', '8'],
  tibia: ['1', '2', '3', '4', '5', '6', '7', '8'],
  poly: ['1', '2', '3', '4', '5', '6', '7', '8'],
  patella: ['29', '32', '35', '38', '40'],
}

// ------- Main Engine -------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateDailyCoverage(
  supabase: SupabaseClient<any, any, any>,
  facilityId: string,
  date: string,
): Promise<CoverageResult> {
  const { data: facility } = await supabase
    .from('facilities').select('name, coverage_ratio').eq('id', facilityId).single()

  const coverageRatio: number = facility?.coverage_ratio ?? 0.66

  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  // Fetch ALL cases for the day (including completed) — we need completed cases
  // for supply counting since their kits stay at the hospital all day.
  // Cancelled cases are excluded entirely.
  const { data: allDayCases } = await supabase
    .from('cases')
    .select('id, case_id, surgeon_name, procedure_name, surgery_date, plan_id, status, sf_id')
    .eq('facility_id', facilityId)
    .gte('surgery_date', dayStart)
    .lte('surgery_date', dayEnd)
    .neq('status', 'Cancelled')

  // Active cases drive demand (not completed, not cancelled)
  const rawCases = (allDayCases ?? []).filter((c) => c.status !== 'Completed')
  // All non-cancelled cases (including completed) drive supply
  const supplyCases = allDayCases ?? []

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

  // Build case summary from a raw case record
  function toCaseSummary(c: { id: string; case_id: string | null; surgeon_name: string | null; procedure_name: string | null; surgery_date: string; plan_id: string | null; status: string | null; sf_id: string | null }): CaseSummary {
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
      plan_id: planId, plan_name: planName, status: c.status,
    }
  }

  // Active cases (demand) — excludes completed
  const cases: CaseSummary[] = rawCases.map(toCaseSummary)

  // All cases including completed (supply) — kits stay at the hospital all day
  const allCasesForSupply = supplyCases.map(toCaseSummary)

  // Surgeon summary
  const surgeonCounts: Record<string, { count: number; left: number; right: number; procedure_type: string }> = {}
  for (const c of cases) {
    if (!c.surgeon_name) continue
    if (!surgeonCounts[c.surgeon_name]) surgeonCounts[c.surgeon_name] = { count: 0, left: 0, right: 0, procedure_type: c.procedure_type }
    surgeonCounts[c.surgeon_name].count++
    if (c.side === 'left') surgeonCounts[c.surgeon_name].left++
    else if (c.side === 'right') surgeonCounts[c.surgeon_name].right++
    else { surgeonCounts[c.surgeon_name].left++; surgeonCounts[c.surgeon_name].right++ }
  }

  const casesBySurgeon = Object.entries(surgeonCounts).map(([name, c]) => ({
    surgeon: name, display_name: displayName(name), count: c.count, left: c.left, right: c.right, procedure_type: c.procedure_type,
  }))

  const kneeCases = cases.filter((c) => c.procedure_type === 'knee').length
  const hipCases = cases.filter((c) => c.procedure_type === 'hip').length

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

  // ------- Load variant sizes from DB -------
  const { data: variantSizesData } = await supabase
    .from('variant_sizes')
    .select('component, variant, sizes')

  const sizeMap: Record<string, string[]> = {}
  for (const vs of variantSizesData ?? []) {
    sizeMap[`${vs.component}|${vs.variant}`] = vs.sizes
  }

  function getSizes(component: string, variant: string): string[] {
    return sizeMap[`${component}|${variant}`] ?? FALLBACK_SIZES[component] ?? []
  }

  // ------- Count supply (on hand + on order) -------
  // 1. Permanent hospital inventory
  const { data: inventoryItems } = await supabase
    .from('facility_inventory').select('gtin, reference_number').eq('facility_id', facilityId)
  const onHand = buildOnHandCounts(inventoryItems ?? [])

  // 2. Plan-based supply: use surgeon plans + case status to determine what's
  //    been shipped (on hand) vs requested (on order) for this day's cases.
  //    RepSuite doesn't populate case_parts until kits ship, so for "Requested"
  //    cases we derive supply from the assigned plan instead.
  const supplyOnHand: Record<string, number> = {}
  const supplyOnOrder: Record<string, number> = {}

  function addSupply(
    target: Record<string, number>,
    component: string, variant: string, side: string | null, sets: number,
  ) {
    if (!variant || sets <= 0) return
    const key = `${component}|${variant}|${side ?? 'any'}`
    target[key] = (target[key] ?? 0) + sets
  }

  // Group ALL day's cases (including completed) by plan for supply counting
  const supplyCasesByPlan: Record<string, (CaseSummary)[]> = {}
  for (const c of allCasesForSupply) {
    if (!c.plan_id) continue
    if (!supplyCasesByPlan[c.plan_id]) supplyCasesByPlan[c.plan_id] = []
    supplyCasesByPlan[c.plan_id].push(c)
  }

  for (const [planId, planCases] of Object.entries(supplyCasesByPlan)) {
    const tmpl = templateMap.get(planId)
    if (!tmpl) continue

    // Split cases by supply status — completed + shipped kits are physically on hand
    const shippedCases = planCases.filter((c) =>
      c.status === 'Shipped/Ready for Surgery' || c.status === 'Completed'
    )
    const requestedCases = planCases.filter((c) =>
      c.status === 'Requested' || c.status === 'Assigned'
    )

    for (const { bucket, bucketCases } of [
      { bucket: supplyOnHand, bucketCases: shippedCases },
      { bucket: supplyOnOrder, bucketCases: requestedCases },
    ]) {
      if (bucketCases.length === 0) continue

      const leftCount = bucketCases.filter((c) => c.side === 'left' || c.side === 'unknown').length
      const rightCount = bucketCases.filter((c) => c.side === 'right' || c.side === 'unknown').length
      const totalCount = bucketCases.length

      for (const sp of tmpl.sub_plans) {
        for (const item of sp.items) {
          if (item.component === 'femur' || (item.side === 'left' || item.side === 'right')) {
            const itemSide = item.side
            if (itemSide === 'left' || (!itemSide && leftCount > 0)) {
              addSupply(bucket, item.component, item.variant, itemSide ?? 'left', frequencySets(sp.frequency, leftCount))
            }
            if (itemSide === 'right' || (!itemSide && rightCount > 0)) {
              addSupply(bucket, item.component, item.variant, itemSide ?? 'right', frequencySets(sp.frequency, rightCount))
            }
          } else {
            addSupply(bucket, item.component, item.variant, item.side, frequencySets(sp.frequency, totalCount))
          }
        }
      }
    }
  }

  // Plan-derived supply uses demand-style keys (component|variant|side)
  // which are applied directly in the coverage loop below, not through
  // the grid-based countSetsFor function.
  const onOrder: Record<string, number> = {}

  // ------- Build coverage -------

  const gridCategoryMap: Record<string, string> = {
    femur: 'knee_femur', tibia: 'knee_tibia', patella: 'knee_patella',
    stem: 'hip_stem', cup: 'hip_cup',
  }

  // Count complete sets from a given inventory map
  function countSetsFor(inv: Record<string, number>, component: string, variant: string, side: string | null): number {
    const sizes = getSizes(component, variant)
    if (component === 'femur') {
      const gv = side ? `${side}_${variant}` : variant
      return countCompleteSets(inv, 'knee_femur', gv, sizes)
    } else if (component === 'poly') {
      const cat = `knee_poly_${variant}`
      const polySizes = getSizes('poly', variant)
      const ths = variant === 'ts' ? ['9', '11', '13', '16', '19', '22', '25', '28', '31'] : ['9', '10', '11', '12', '13', '14', '16', '19']
      return Math.min(...polySizes.flatMap((ks) =>
        ths.map((th) => inv[`${cat}|${ks}|${th}`] ?? 0)
      ))
    } else if (component === 'liner' || component === 'head') {
      return 0
    } else {
      const gridCat = gridCategoryMap[component] ?? component
      return countCompleteSets(inv, gridCat, variant, sizes)
    }
  }

  const coverage: VariantCoverage[] = []

  for (const [key, d] of Object.entries(demand)) {
    const [component, variant, sideKey] = key.split('|')
    const side = sideKey === 'any' ? null : sideKey

    // Inventory-based count (permanent hospital inventory)
    const inventoryOnHand = countSetsFor(onHand, component, variant, side)
    // Plan-derived supply by case status
    const planShipped = supplyOnHand[key] ?? 0
    const planRequested = supplyOnOrder[key] ?? 0
    const totalRequested = planShipped + planRequested

    const setsOnHand = inventoryOnHand
    // Apply coverage ratio: target is the number of sets you INTEND to have
    const targetSets = Math.ceil(d.sets * coverageRatio)
    const totalAvailable = setsOnHand + totalRequested
    const gap = Math.max(0, targetSets - totalAvailable)

    const sl = side ? (side === 'left' ? 'Left' : 'Right') : null
    const dn = `${sl ? sl + ' ' : ''}${getVariantLabel(variant)} ${component.charAt(0).toUpperCase() + component.slice(1)}`

    // Neutral status: on_target (at or above ratio), below_target (below ratio),
    // covered (everything shipped or in permanent inventory)
    let status: 'on_target' | 'below_target' | 'covered'
    if (totalAvailable >= d.sets) {
      status = 'covered'        // full 1:1 coverage
    } else if (totalAvailable >= targetSets) {
      status = 'on_target'      // at your intended ratio
    } else {
      status = 'below_target'   // below your ratio — may want to order more
    }

    coverage.push({
      component, variant, side, display_name: dn,
      tub_name: getTubName(component, variant, side ?? undefined),
      sets_needed: d.sets, target_sets: targetSets, sets_on_hand: setsOnHand,
      sets_requested: totalRequested, sets_shipped: planShipped, gap,
      status,
      demand_breakdown: d.sources,
    })
  }

  coverage.sort((a, b) => {
    const order = { below_target: 0, on_target: 1, covered: 2 }
    if (a.status !== b.status) return order[a.status] - order[b.status]
    return a.display_name.localeCompare(b.display_name)
  })

  // Only recommend ordering for items below target
  const recommendations = coverage.filter((c) => c.gap > 0).map((c) => ({
    tub_name: c.tub_name, variant: c.variant, side: c.side, component: c.component,
    tubs_needed: c.gap,
  })).sort((a, b) => a.tub_name.localeCompare(b.tub_name))

  return {
    facility_id: facilityId, facility_name: facility?.name ?? facilityId,
    date, coverage_ratio: coverageRatio,
    total_cases: cases.length, knee_cases: kneeCases, hip_cases: hipCases,
    cases, cases_by_surgeon: casesBySurgeon,
    coverage, recommendations,
    no_plans: noPlanCases.map((c) => `${displayName(c.surgeon_name)} — ${c.procedure_name}`),
    no_plan_surgeons: noPlanSurgeons.map(displayName),
  }
}
