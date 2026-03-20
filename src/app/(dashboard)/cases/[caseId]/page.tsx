import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CaseUsageList from './case-usage-list'

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  const supabase = await createClient()

  const { data: caseData } = await supabase
    .from('cases')
    .select('*, facilities(name)')
    .eq('id', caseId)
    .single()

  if (!caseData) redirect('/cases')

  const { data: usageItems } = await supabase
    .from('case_usage_items')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  const facility = Array.isArray(caseData.facilities) ? caseData.facilities[0] : caseData.facilities

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/cases"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case {caseData.case_id}</h1>
          <p className="text-gray-500 text-sm">
            {caseData.surgery_date ? new Date(caseData.surgery_date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            }) : ''}
          </p>
        </div>
      </div>

      {/* Case Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Surgeon</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {caseData.surgeon_name?.replace(/^\d+ - /, '') ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Procedure</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{caseData.procedure_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Facility</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{facility?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Side</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{caseData.side ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Sales Rep</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{caseData.sales_rep ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Covering Reps</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{caseData.covering_reps ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Patient ID</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{caseData.patient_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Synced</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {new Date(caseData.synced_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Items */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Items Used</h2>
        <CaseUsageList
          items={usageItems ?? []}
          facilityId={caseData.facility_id}
          facilitySiteNumber={caseData.hospital_site_number}
          canEdit={profile?.role === 'admin' || profile?.role === 'manager'}
        />
      </div>
    </div>
  )
}
