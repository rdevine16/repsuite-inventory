'use client'

import { Fragment } from 'react'
import Link from 'next/link'

interface Case {
  id: string
  case_id: string | null
  surgeon_name: string | null
  procedure_name: string | null
  surgery_date: string | null
  hospital_name: string | null
  side: string | null
  status: string | null
  facilities: { name: string } | { name: string }[] | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'Shipped/Ready for Surgery': { label: 'Ready', color: 'bg-emerald-50 text-emerald-700' },
  'Assigned': { label: 'Assigned', color: 'bg-blue-50 text-blue-700' },
  'Requested': { label: 'Requested', color: 'bg-amber-50 text-amber-700' },
  'New': { label: 'New', color: 'bg-gray-100 text-gray-600' },
}

function getDayLabel(dateStr: string, today: string, tomorrow: string, dayAfter: string): string {
  const dateOnly = dateStr.split('T')[0]
  if (dateOnly === today) return 'Today'
  if (dateOnly === tomorrow) return 'Tomorrow'
  if (dateOnly === dayAfter) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })
  }
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

function formatDayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
}

export default function UpcomingCases({ cases }: { cases: Case[] }) {
  // Group cases by day (Eastern timezone)
  const toEasternDate = (d: Date) => {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  const now = new Date()
  const todayStr = toEasternDate(now)
  const tom = new Date(now)
  tom.setDate(tom.getDate() + 1)
  const tomorrowStr = toEasternDate(tom)
  const da = new Date(now)
  da.setDate(da.getDate() + 2)
  const dayAfterStr = toEasternDate(da)

  const dayGroups: { date: string; label: string; fullDate: string; cases: Case[] }[] = []
  const grouped: Record<string, Case[]> = {}

  cases.forEach((c) => {
    if (!c.surgery_date) return
    const dateKey = toEasternDate(new Date(c.surgery_date))
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(c)
  })

  ;[todayStr, tomorrowStr, dayAfterStr].forEach((dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    dayGroups.push({
      date: dateStr,
      label: getDayLabel(dateStr + 'T12:00:00', todayStr, tomorrowStr, dayAfterStr),
      fullDate: formatDayDate(dateStr + 'T12:00:00'),
      cases: grouped[dateStr] ?? [],
    })
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Cases</h2>
        <Link href="/cases" className="text-sm text-blue-600 hover:text-blue-700">
          View all →
        </Link>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Surgeon</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Procedure</th>
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Facility</th>
              <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Status</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {dayGroups.map((day) => (
              <Fragment key={day.date}>
                <tr className="bg-gray-50/70">
                  <td colSpan={5} className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${day.label === 'Today' ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day.label}
                      </span>
                      <span className="text-xs text-gray-400">{day.fullDate}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {day.cases.length} {day.cases.length === 1 ? 'case' : 'cases'}
                      </span>
                    </div>
                  </td>
                </tr>

                {day.cases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-center text-xs text-gray-400 border-b border-gray-100">
                      No cases
                    </td>
                  </tr>
                ) : (
                  day.cases.map((c) => {
                    const facility = Array.isArray(c.facilities) ? c.facilities[0] : c.facilities
                    const statusConfig = STATUS_CONFIG[c.status ?? ''] ?? { label: c.status ?? '—', color: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-900 truncate">
                          {c.surgeon_name ?? '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 truncate max-w-full">
                            {c.procedure_name ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs truncate">{facility?.name ?? c.hospital_name?.replace(/^\d+ - /, '') ?? '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={'/cases/' + c.id}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
