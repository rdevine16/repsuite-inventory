import { createClient } from '@/lib/supabase-server'
import CoverageDashboard from './coverage-dashboard'

export default async function CoveragePage() {
  const supabase = await createClient()

  // Get facilities with smart tracking enabled
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('smart_tracking_enabled', true)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Case Coverage</h1>
        <p className="text-gray-500 mt-1">
          Verify implant coverage for upcoming surgery days. Select a facility and date to audit.
        </p>
      </div>

      <CoverageDashboard facilities={facilities ?? []} />
    </div>
  )
}
