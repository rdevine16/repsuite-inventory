import { createClient } from '@/lib/supabase-server'
import ImplantPlansManager from './implant-plans-manager'

export default async function SurgeonPreferencesPage() {
  const supabase = await createClient()

  // Get surgeons from mappings + cases
  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')
    .order('display_name')

  const { data: caseSurgeons } = await supabase
    .from('cases')
    .select('surgeon_name')

  const surgeonSet = new Set<string>()
  caseSurgeons?.forEach((c) => {
    if (c.surgeon_name) surgeonSet.add(c.surgeon_name)
  })

  const surgeonNameMap: Record<string, string> = {}
  surgeonMappings?.forEach((m) => { surgeonNameMap[m.repsuite_name] = m.display_name })

  const surgeons = Array.from(surgeonSet).map((name) => ({
    repsuite_name: name,
    display_name: surgeonNameMap[name] ?? name.replace(/^\d+ - /, ''),
  })).sort((a, b) => a.display_name.localeCompare(b.display_name))

  // Get existing implant plans
  const { data: plans } = await supabase
    .from('surgeon_implant_plans')
    .select('*')
    .order('surgeon_name')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surgeon Implant Plans</h1>
        <p className="text-gray-500 mt-1">
          Define each surgeon&apos;s implant plans — primary, cemented fallback, and clinical alternate.
        </p>
      </div>

      <ImplantPlansManager
        surgeons={surgeons}
        plans={plans ?? []}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
