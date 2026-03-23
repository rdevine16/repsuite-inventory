import { createClient } from '@/lib/supabase-server'
import AlertThresholdsManager from './alert-thresholds-manager'

export default async function AlertThresholdsPage() {
  const supabase = await createClient()

  const { data: thresholds } = await supabase
    .from('alert_thresholds')
    .select('*')
    .order('category')
    .order('variant')
    .order('size')

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, smart_tracking_enabled')
    .order('name')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alert Thresholds</h1>
        <p className="text-gray-500 mt-1">
          Set minimum implant quantities before shortage alerts fire. Default is 1 (alert when zero remaining).
        </p>
      </div>

      <AlertThresholdsManager
        thresholds={thresholds ?? []}
        facilities={facilities ?? []}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
