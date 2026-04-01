'use client'

import { useState, useMemo } from 'react'
import KpiCard from './kpi-card'
import Discrepancies, { type Discrepancy } from './discrepancies'

export interface OverviewData {
  totalOnHand: number
  addedThisWeek: number
  addedThisMonth: number
  removedThisWeek: number
  removedThisMonth: number
  expiring30: number
  expiring60: number
  expiring90: number
  coverageShort: number
  coverageCovered: number
}

interface FacilitySummary {
  id: string
  name: string
  itemCount: number
  expiring30: number
  removedThisMonth: number
}

export default function OverviewTab({
  data,
  discrepancies,
  facilitySummaries,
}: {
  data: OverviewData
  discrepancies: Discrepancy[]
  facilitySummaries?: FacilitySummary[]
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  const added = period === 'week' ? data.addedThisWeek : data.addedThisMonth
  const removed = period === 'week' ? data.removedThisWeek : data.removedThisMonth
  const netChange = added - removed

  const netTrend = netChange > 0 ? 'up' as const : netChange < 0 ? 'down' as const : 'neutral' as const
  const netLabel = netChange > 0 ? `+${netChange}` : `${netChange}`

  const totalExpiring = data.expiring30 + data.expiring60 + data.expiring90

  const expirationSubtitle = useMemo(() => {
    const parts: string[] = []
    if (data.expiring30 > 0) parts.push(`${data.expiring30} < 30d`)
    if (data.expiring60 > 0) parts.push(`${data.expiring60} 30-60d`)
    if (data.expiring90 > 0) parts.push(`${data.expiring90} 60-90d`)
    return parts.join(' · ') || 'None expiring within 90 days'
  }, [data.expiring30, data.expiring60, data.expiring90])

  const totalCoverage = data.coverageShort + data.coverageCovered
  const coverageColor = data.coverageShort > 0 ? 'amber' as const : 'emerald' as const

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              period === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              period === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Items on Hand"
          value={data.totalOnHand}
          subtitle="Current facility inventory"
        />
        <KpiCard
          label={`Added This ${period === 'week' ? 'Week' : 'Month'}`}
          value={added}
          subtitle="Items scanned into inventory"
        />
        <KpiCard
          label={`Removed This ${period === 'week' ? 'Week' : 'Month'}`}
          value={removed}
          subtitle="Items used in cases or removed"
        />
        <KpiCard
          label="Net Change"
          value={Math.abs(netChange)}
          trend={netTrend}
          trendLabel={netLabel}
          subtitle={`${period === 'week' ? 'Weekly' : 'Monthly'} inventory change`}
        />
        <KpiCard
          label="Expiring Soon"
          value={totalExpiring}
          subtitle={expirationSubtitle}
          color={data.expiring30 > 0 ? 'red' : totalExpiring > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label="Coverage Status"
          value={totalCoverage > 0 ? `${data.coverageCovered}/${totalCoverage}` : '—'}
          subtitle={totalCoverage > 0
            ? `${data.coverageShort} variant${data.coverageShort !== 1 ? 's' : ''} short`
            : 'No upcoming cases to evaluate'
          }
          color={totalCoverage > 0 ? coverageColor : 'default'}
        />
      </div>

      {/* Facility Comparison Cards (All Facilities mode) */}
      {facilitySummaries && facilitySummaries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Facility Comparison</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilitySummaries.map((f) => (
              <a
                key={f.id}
                href={`/inventory?facility=${f.id}&tab=overview`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition group"
              >
                <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition">{f.name}</h4>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span><strong className="text-gray-900">{f.itemCount}</strong> items</span>
                  {f.expiring30 > 0 && (
                    <span className="text-red-600"><strong>{f.expiring30}</strong> expiring &lt;30d</span>
                  )}
                  {f.removedThisMonth > 0 && (
                    <span><strong>{f.removedThisMonth}</strong> used this month</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Discrepancies */}
      <Discrepancies items={discrepancies} />
    </div>
  )
}
