import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function CasesPage() {
  const supabase = await createClient()

  const { data: cases } = await supabase
    .from('cases')
    .select('*, facilities(name)')
    .order('surgery_date', { ascending: false })

  // Get usage counts per case
  const { data: usageCounts } = await supabase
    .from('case_usage_items')
    .select('case_id, current_status')

  const caseStats: Record<string, { total: number; deducted: number }> = {}
  usageCounts?.forEach((u: { case_id: string; current_status: string }) => {
    if (!caseStats[u.case_id]) caseStats[u.case_id] = { total: 0, deducted: 0 }
    caseStats[u.case_id].total++
    if (u.current_status === 'deducted') caseStats[u.case_id].deducted++
  })

  // Check token status
  const { data: tokenStatus } = await supabase
    .from('repsuite_tokens')
    .select('token_status, error_message, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
        <p className="text-gray-500 mt-1">Completed surgical cases synced from RepSuite</p>
      </div>

      {/* Token status banner */}
      {tokenStatus?.token_status === 'expired' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">RepSuite sync paused</p>
            <p className="text-sm text-red-600 mt-0.5">
              Open the RepSuiteConnect app on your phone to re-authenticate.
              {tokenStatus.error_message && (
                <span className="text-xs text-red-400 block mt-1">{tokenStatus.error_message}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {!tokenStatus && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">No RepSuite token found</p>
            <p className="text-sm text-amber-600 mt-0.5">
              Open the RepSuiteConnect app and log in to start syncing cases.
            </p>
          </div>
        </div>
      )}

      {/* Cases list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!cases || cases.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p>No cases synced yet.</p>
            <p className="text-sm mt-1">Cases will appear here once the sync runs after you log into the iOS app.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Case ID</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Surgeon</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Procedure</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Facility</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-medium">Items</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c: any) => {
                  const facility = Array.isArray(c.facilities) ? c.facilities[0] : c.facilities
                  const stats = caseStats[c.id]
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-mono text-xs font-medium text-gray-900">{c.case_id}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {c.surgery_date ? new Date(c.surgery_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {c.surgeon_name?.replace(/^\d+ - /, '') ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {c.procedure_name ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{facility?.name ?? '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {stats ? (
                          <span className="text-xs">
                            <span className="font-semibold text-emerald-600">{stats.deducted}</span>
                            <span className="text-gray-400"> / {stats.total}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={'/cases/' + c.id}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
