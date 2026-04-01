'use client'

import { useMemo } from 'react'
import UsageTrendChart, { type WeeklyUsage } from './charts/usage-trend'
import CategoryBreakdownChart, { type CategoryUsage } from './charts/category-breakdown'
import TopItemsTable, { type TopItem } from './charts/top-items'
import KpiCard from './kpi-card'

export interface UsedItemRecord {
  reference_number: string | null
  description: string | null
  created_at: string
}

export interface AnalyticsData {
  usedItems: UsedItemRecord[]
  totalOnHand: number
  upcomingCaseCount: number
}

const CATEGORY_PATTERNS: [string, RegExp][] = [
  ['Femur', /^(6260-\d-|0580-\d-)/],
  ['Tibia', /^(6266-\d-|0589-\d-)/],
  ['Poly', /^(6277-\d-|6262-\d-)/],
  ['Patella', /^(5948-\d|6295-\d)/],
  ['Hip Stem', /^(6282-\d|6284-\d)/],
  ['Hip Cup', /^(6210-|0535-)/],
  ['Hip Liner', /^(6214-|0626-|6270-)/],
  ['Hip Head', /^(6215-|6216-|0628-)/],
]

function categorizeRef(ref: string | null): string {
  if (!ref) return 'Other'
  for (const [name, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(ref)) return name
  }
  return 'Other'
}

function getWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

export default function AnalyticsTab({ data }: { data: AnalyticsData }) {
  const { weeklyUsage, categoryUsage, topItems, avgPerCase, daysOfSupply } = useMemo(() => {
    const { usedItems, totalOnHand, upcomingCaseCount } = data

    // Weekly usage for last 12 weeks
    const now = new Date()
    const twelveWeeksAgo = new Date(now)
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

    const weekBuckets = new Map<string, { label: string; count: number; weekStart: Date }>()

    // Initialize 12 week buckets
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(now)
      ws.setDate(ws.getDate() - i * 7)
      const weekStart = getWeekStart(ws)
      const key = weekStart.toISOString().split('T')[0]
      weekBuckets.set(key, { label: getWeekLabel(weekStart), count: 0, weekStart })
    }

    // Count items per week
    const recentItems = usedItems.filter((i) => i.created_at >= twelveWeeksAgo.toISOString())
    for (const item of recentItems) {
      const ws = getWeekStart(new Date(item.created_at))
      const key = ws.toISOString().split('T')[0]
      const bucket = weekBuckets.get(key)
      if (bucket) bucket.count++
    }

    const weeklyUsage: WeeklyUsage[] = Array.from(weekBuckets.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((b) => ({ week: b.label, count: b.count }))

    // Category breakdown
    const catMap = new Map<string, number>()
    for (const item of recentItems) {
      const cat = categorizeRef(item.reference_number)
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
    }
    const categoryUsage: CategoryUsage[] = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    // Top 10 reference numbers
    const refMap = new Map<string, { description: string | null; count: number }>()
    for (const item of usedItems) {
      if (!item.reference_number) continue
      const existing = refMap.get(item.reference_number)
      if (existing) {
        existing.count++
      } else {
        refMap.set(item.reference_number, { description: item.description, count: 1 })
      }
    }
    const topItems: TopItem[] = Array.from(refMap.entries())
      .map(([reference_number, { description, count }]) => ({ reference_number, description, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Avg items per case (rolling 30 day) — approximate from used items count / upcoming + recent cases
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const last30Items = usedItems.filter((i) => i.created_at >= thirtyDaysAgo.toISOString()).length

    // Days of supply: on-hand / (daily burn rate)
    const totalWeeks = Math.max(1, weeklyUsage.filter((w) => w.count > 0).length)
    const totalUsed = weeklyUsage.reduce((sum, w) => sum + w.count, 0)
    const dailyBurn = totalUsed / (totalWeeks * 7)
    const daysOfSupply = dailyBurn > 0 ? Math.round(totalOnHand / dailyBurn) : null

    // Simple avg per case estimate
    const avgPerCase = upcomingCaseCount > 0 ? Math.round((last30Items / Math.max(1, upcomingCaseCount)) * 10) / 10 : null

    return { weeklyUsage, categoryUsage, topItems, avgPerCase, daysOfSupply }
  }, [data])

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Avg Items per Case"
          value={avgPerCase ?? '—'}
          subtitle="Rolling 30-day estimate"
        />
        <KpiCard
          label="Projected Days of Supply"
          value={daysOfSupply ?? '—'}
          subtitle="Based on 12-week burn rate"
          color={daysOfSupply !== null && daysOfSupply < 14 ? 'red' : daysOfSupply !== null && daysOfSupply < 30 ? 'amber' : 'default'}
        />
      </div>

      {/* Usage Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage Trend (Last 12 Weeks)</h3>
        <UsageTrendChart data={weeklyUsage} />
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage by Category</h3>
        <CategoryBreakdownChart data={categoryUsage} />
      </div>

      {/* Top Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Top 10 Most-Used References</h3>
        </div>
        <TopItemsTable items={topItems} />
      </div>
    </div>
  )
}
