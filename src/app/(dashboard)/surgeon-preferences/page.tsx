import { createClient } from '@/lib/supabase-server'
import ImplantPlansManager from './implant-plans-manager'
import type { PlanTemplate, SubPlan, SubPlanItem } from '@/lib/plan-config'

export default async function SurgeonPreferencesPage() {
  const supabase = await createClient()

  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')
    .order('display_name')

  const { data: caseSurgeons } = await supabase.from('cases').select('surgeon_name')

  const surgeonSet = new Set<string>()
  caseSurgeons?.forEach((c) => { if (c.surgeon_name) surgeonSet.add(c.surgeon_name) })

  const surgeonNameMap: Record<string, string> = {}
  surgeonMappings?.forEach((m) => { surgeonNameMap[m.repsuite_name] = m.display_name })

  const surgeons = Array.from(surgeonSet).map((name) => ({
    repsuite_name: name,
    display_name: surgeonNameMap[name] ?? name.replace(/^\d+ - /, ''),
  })).sort((a, b) => a.display_name.localeCompare(b.display_name))

  // Load templates with nested sub-plans and items
  const { data: rawTemplates } = await supabase
    .from('surgeon_implant_plans')
    .select('*')
    .order('surgeon_name')

  const { data: rawSubPlans } = await supabase
    .from('plan_sub_plans')
    .select('*')
    .order('sort_order')

  const { data: rawItems } = await supabase
    .from('plan_sub_plan_items')
    .select('*')

  // Assemble nested structure
  const itemsBySubPlan: Record<string, SubPlanItem[]> = {}
  ;(rawItems ?? []).forEach((item) => {
    if (!itemsBySubPlan[item.sub_plan_id]) itemsBySubPlan[item.sub_plan_id] = []
    itemsBySubPlan[item.sub_plan_id].push(item as SubPlanItem)
  })

  const subPlansByTemplate: Record<string, SubPlan[]> = {}
  ;(rawSubPlans ?? []).forEach((sp) => {
    if (!subPlansByTemplate[sp.template_id]) subPlansByTemplate[sp.template_id] = []
    subPlansByTemplate[sp.template_id].push({
      ...sp,
      items: itemsBySubPlan[sp.id] ?? [],
    } as SubPlan)
  })

  const templates: PlanTemplate[] = (rawTemplates ?? []).map((t) => ({
    ...t,
    sub_plans: (subPlansByTemplate[t.id] ?? []).sort((a, b) => a.sort_order - b.sort_order),
  })) as PlanTemplate[]

  const { data: profile } = await supabase.from('profiles').select('role').single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surgeon Implant Plans</h1>
        <p className="text-gray-500 mt-1">
          Create named implant plans with sub-plans (A, B, C) for each surgeon. Each sub-plan has its own frequency and items.
        </p>
      </div>

      <ImplantPlansManager
        surgeons={surgeons}
        templates={templates}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
