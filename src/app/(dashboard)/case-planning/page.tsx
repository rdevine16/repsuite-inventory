import { createClient } from '@/lib/supabase-server'
import CasePlanningDashboard from './case-planning-dashboard'

export default async function CasePlanningPage() {
  const supabase = await createClient()

  // Facilities with smart tracking
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('smart_tracking_enabled', true)
    .order('name')

  // Upcoming cases (next 14 days)
  const now = new Date()
  const startDate = now.toISOString().split('T')[0]
  const end = new Date(now)
  end.setDate(end.getDate() + 14)
  const endDate = end.toISOString().split('T')[0]

  // Include today's completed cases (kits stay all day) but exclude future completed + all cancelled
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('*, facilities(name)')
    .gte('surgery_date', `${startDate}T00:00:00`)
    .lte('surgery_date', `${endDate}T23:59:59`)
    .neq('status', 'Cancelled')
    .order('surgery_date', { ascending: true })

  console.log('[case-planning] date range:', startDate, '→', endDate, 'cases:', cases?.length, 'statuses:', [...new Set(cases?.map((c: any) => c.status))])

  // Debug: check if any completed cases exist for today
  const { data: completedToday } = await supabase
    .from('cases')
    .select('id, case_id, status, surgery_date, surgeon_name')
    .eq('status', 'Completed')
    .gte('surgery_date', `${startDate}T00:00:00`)
    .lte('surgery_date', `${startDate}T23:59:59`)
  console.log('[case-planning] completed cases today:', completedToday?.length, completedToday?.map((c: any) => ({ id: c.case_id, date: c.surgery_date, surgeon: c.surgeon_name?.slice(0, 20) })))

  // Surgeon display name mappings
  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')

  const surgeonNameMap: Record<string, string> = {}
  surgeonMappings?.forEach((m: { repsuite_name: string; display_name: string }) => {
    surgeonNameMap[m.repsuite_name] = m.display_name
  })

  // All surgeon implant plans
  const { data: plans } = await supabase
    .from('surgeon_implant_plans')
    .select('id, surgeon_name, plan_name, procedure_type, is_default')
    .order('surgeon_name')

  // Sub-plans with items for plan detail display
  const { data: subPlans } = await supabase
    .from('plan_sub_plans')
    .select('id, template_id, name, frequency, sort_order')
    .order('sort_order')

  const { data: subPlanItems } = await supabase
    .from('plan_sub_plan_items')
    .select('id, sub_plan_id, component, variant, side')

  // Token status
  const { data: tokenStatus } = await supabase
    .from('repsuite_tokens')
    .select('token_status, error_message, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Case Planning</h1>
        <p className="text-gray-500 mt-1">
          Manage upcoming cases, assign surgeon preferences, and verify implant readiness
        </p>
      </div>

      {tokenStatus?.token_status === 'expired' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">RepSuite sync paused</p>
            <p className="text-sm text-red-600 mt-0.5">
              Open the RepSuiteConnect app on your phone to re-authenticate.
            </p>
          </div>
        </div>
      )}

      <CasePlanningDashboard
        facilities={facilities ?? []}
        cases={(cases ?? []).map((c: any) => ({
          ...c,
          display_surgeon: surgeonNameMap[c.surgeon_name] ?? c.surgeon_name?.replace(/^\d+ - /, '') ?? '—',
          facility_name: (Array.isArray(c.facilities) ? c.facilities[0] : c.facilities)?.name ?? c.hospital_name?.replace(/^\d+ - /, '') ?? '—',
        }))}
        plans={plans ?? []}
        subPlans={subPlans ?? []}
        subPlanItems={subPlanItems ?? []}
        surgeonNameMap={surgeonNameMap}
        serverToday={startDate}
      />
    </div>
  )
}
