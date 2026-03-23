import { createClient } from '@/lib/supabase-server'
import SurgeonPreferencesManager from './surgeon-preferences-manager'

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

  // Get existing preferences
  const { data: preferences } = await supabase
    .from('surgeon_preferences')
    .select('*')
    .order('surgeon_name')
    .order('procedure_type')
    .order('component')
    .order('priority')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surgeon Preferences</h1>
        <p className="text-gray-500 mt-1">
          Define each surgeon&apos;s preferred implant systems per component with fallback priorities.
        </p>
      </div>

      <SurgeonPreferencesManager
        surgeons={surgeons}
        preferences={preferences ?? []}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
