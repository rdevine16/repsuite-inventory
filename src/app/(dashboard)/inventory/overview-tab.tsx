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

export default function OverviewTab({ data, discrepancies }: { data: OverviewData; discrepancies: Discrepancy[] }) {
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

      {/* Discrepancies */}
      <Discrepancies items={discrepancies} />
    </div>
  )
}
