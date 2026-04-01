'use client'

import CsvExport from './csv-export'
import type { ActivityEvent } from './activity-tab'

export interface AuditSession {
  id: string
  facility_id: string
  started_at: string
  completed_at: string | null
  user_id: string | null
}

export default function AuditTab({
  sessions,
  activityEvents,
  facilityName,
}: {
  sessions: AuditSession[]
  activityEvents: ActivityEvent[]
  facilityName: string
}) {
  const lastSession = sessions[0] ?? null

  return (
    <div className="space-y-6">
      {/* Last Count Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Last Physical Count</h3>
            {lastSession ? (
              <p className="text-sm text-gray-600 mt-1">
                {new Date(lastSession.started_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {lastSession.completed_at && (
                  <span className="text-gray-400">
                    {' '}· Completed {new Date(lastSession.completed_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">No physical counts recorded</p>
            )}
          </div>
          <CsvExport events={activityEvents} facilityName={facilityName} />
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Count Session History</h3>
        </div>
        {sessions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Started</th>
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Completed</th>
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Duration</th>
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const started = new Date(session.started_at)
                const completed = session.completed_at ? new Date(session.completed_at) : null
                const durationMs = completed ? completed.getTime() - started.getTime() : null
                const durationMin = durationMs ? Math.round(durationMs / 60000) : null

                return (
                  <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-5 text-gray-900">
                      {started.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      <span className="text-gray-400 ml-1">
                        {started.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-gray-600">
                      {completed
                        ? completed.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="py-2.5 px-5 text-gray-600">
                      {durationMin != null ? `${durationMin} min` : '—'}
                    </td>
                    <td className="py-2.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {completed ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">No count sessions recorded for this facility.</p>
          </div>
        )}
      </div>

      {/* Activity Summary for Audit */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Inventory Change Log</h3>
          <span className="text-xs text-gray-500">{activityEvents.length} total events</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-lg font-bold text-emerald-700">
              {activityEvents.filter((e) => e.event_type === 'add').length}
            </p>
            <p className="text-xs text-emerald-600">Added</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-lg font-bold text-red-700">
              {activityEvents.filter((e) => e.event_type === 'remove').length}
            </p>
            <p className="text-xs text-red-600">Removed</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-lg font-bold text-blue-700">
              {activityEvents.filter((e) => e.event_type === 'restore').length}
            </p>
            <p className="text-xs text-blue-600">Restored</p>
          </div>
        </div>
      </div>
    </div>
  )
}
