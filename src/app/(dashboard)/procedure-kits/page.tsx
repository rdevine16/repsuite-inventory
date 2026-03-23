import { createClient } from '@/lib/supabase-server'
import ProcedureKitsManager from './procedure-kits-manager'

export default async function ProcedureKitsPage() {
  const supabase = await createClient()

  // Get distinct procedure names from cases
  const { data: caseProcedures } = await supabase
    .from('cases')
    .select('procedure_name')

  const procedureSet = new Set<string>()
  caseProcedures?.forEach((c) => {
    if (c.procedure_name) procedureSet.add(c.procedure_name)
  })
  const procedures = Array.from(procedureSet).sort()

  // Get kit template names (from repsuite_set_names + kit_mappings)
  const { data: setNames } = await supabase
    .from('repsuite_set_names')
    .select('set_name')
    .order('set_name')

  const { data: kitMappings } = await supabase
    .from('kit_mappings')
    .select('repsuite_name, display_name')

  const kitNameMap: Record<string, string> = {}
  kitMappings?.forEach((m) => { kitNameMap[m.repsuite_name] = m.display_name })

  const kitNames = (setNames ?? []).map((s) => ({
    repsuite_name: s.set_name,
    display_name: kitNameMap[s.set_name] ?? s.set_name,
  }))

  // Get base requirements
  const { data: baseRequirements } = await supabase
    .from('procedure_kit_requirements')
    .select('*')
    .order('procedure_name')

  // Get surgeon overrides
  const { data: surgeonOverrides } = await supabase
    .from('surgeon_kit_overrides')
    .select('*')

  // Get surgeons
  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')

  const { data: caseSurgeons } = await supabase
    .from('cases')
    .select('surgeon_name')

  const surgeonSet = new Set<string>()
  caseSurgeons?.forEach((c) => { if (c.surgeon_name) surgeonSet.add(c.surgeon_name) })

  const surgeonNameMap: Record<string, string> = {}
  surgeonMappings?.forEach((m) => { surgeonNameMap[m.repsuite_name] = m.display_name })

  const surgeons = Array.from(surgeonSet).map((name) => ({
    repsuite_name: name,
    display_name: surgeonNameMap[name] ?? name.replace(/^\d+ - /, ''),
  })).sort((a, b) => a.display_name.localeCompare(b.display_name))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procedure Kits</h1>
        <p className="text-gray-500 mt-1">
          Define which kits are required for each procedure type, with surgeon-specific overrides.
        </p>
      </div>

      <ProcedureKitsManager
        procedures={procedures}
        kitNames={kitNames}
        baseRequirements={baseRequirements ?? []}
        surgeonOverrides={surgeonOverrides ?? []}
        surgeons={surgeons}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
