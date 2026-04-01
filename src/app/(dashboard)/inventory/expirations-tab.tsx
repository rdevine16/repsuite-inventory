'use client'

import { useMemo } from 'react'
import ExpirationGroup, { type ExpirationItem } from './expiration-group'

export interface InventoryItemForExpiration {
  id: string
  reference_number: string | null
  description: string | null
  lot_number: string | null
  expiration_date: string | null
  gtin: string | null
}

function classifyTier(expirationDate: string, today: string, thirty: string, sixty: string, ninety: string): ExpirationItem['tier'] {
  if (expirationDate < today) return 'expired'
  if (expirationDate <= thirty) return 'red'
  if (expirationDate <= sixty) return 'amber'
  if (expirationDate <= ninety) return 'yellow'
  return 'gray'
}

export default function ExpirationsTab({
  items,
  upcomingRefNumbers,
}: {
  items: InventoryItemForExpiration[]
  upcomingRefNumbers: string[]
}) {
  const { groups, tierCounts, fefoItems } = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const thirty = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const sixty = new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0]
    const ninety = new Date(now.getTime() + 90 * 86400000).toISOString().split('T')[0]

    // Only items with expiration dates
    const withExpiration = items
      .filter((i) => i.expiration_date)
      .map((i) => ({
        ...i,
        expiration_date: i.expiration_date!,
        tier: classifyTier(i.expiration_date!, today, thirty, sixty, ninety),
      }))
      .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))

    // Count per tier
    const tierCounts = { expired: 0, red: 0, amber: 0, yellow: 0, gray: 0 }
    withExpiration.forEach((i) => { tierCounts[i.tier]++ })

    // Group by description (product name) — excluding gray tier from main groups for focused view
    const groupMap = new Map<string, ExpirationItem[]>()
    withExpiration.forEach((item) => {
      const key = item.description || item.reference_number || 'Unknown'
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(item)
    })

    const groups = Array.from(groupMap.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => {
        // Sort groups by soonest expiring item
        const aFirst = a.items[0]?.expiration_date ?? 'z'
        const bFirst = b.items[0]?.expiration_date ?? 'z'
        return aFirst.localeCompare(bFirst)
      })

    // FEFO: items expiring within 90 days that match upcoming case ref numbers
    const refSet = new Set(upcomingRefNumbers.map((r) => r.toLowerCase()))
    const fefoItems = withExpiration.filter(
      (i) =>
        i.tier !== 'gray' &&
        i.tier !== 'expired' &&
        i.reference_number &&
        refSet.has(i.reference_number.toLowerCase())
    )

    return { groups, tierCounts, fefoItems }
  }, [items, upcomingRefNumbers])

  const tierBadges = [
    { key: 'expired', label: 'Expired', bg: 'bg-red-200', text: 'text-red-900' },
    { key: 'red', label: '< 30d', bg: 'bg-red-100', text: 'text-red-700' },
    { key: 'amber', label: '30–60d', bg: 'bg-amber-100', text: 'text-amber-700' },
    { key: 'yellow', label: '60–90d', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    { key: 'gray', label: '> 90d', bg: 'bg-gray-100', text: 'text-gray-600' },
  ] as const

  const totalTracked = Object.values(tierCounts).reduce((sum, c) => sum + c, 0)

  return (
    <div className="space-y-4">
      {/* Tier summary badges */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">{totalTracked} items with expiration dates</span>
        {tierBadges.map((b) => {
          const count = tierCounts[b.key]
          if (count === 0) return null
          return (
            <span
              key={b.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${b.bg} ${b.text}`}
            >
              {count} {b.label}
            </span>
          )
        })}
      </div>

      {/* FEFO Recommendation */}
      {fefoItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">
            FEFO Recommendation — Use These First
          </h3>
          <p className="text-xs text-amber-700 mb-3">
            These items are expiring soon and match upcoming surgical cases. Prioritize using them first.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fefoItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-amber-200 px-3 py-2"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{item.description || '—'}</p>
                <p className="text-xs text-gray-500 font-mono">{item.reference_number} · Lot {item.lot_number}</p>
                <p className="text-xs text-amber-700 font-medium mt-0.5">Expires {item.expiration_date}</p>
              </div>
            ))}
          </div>
          {fefoItems.length > 6 && (
            <p className="text-xs text-amber-600 mt-2">+ {fefoItems.length - 6} more items</p>
          )}
        </div>
      )}

      {/* Grouped items */}
      {groups.length > 0 ? (
        groups.map((group) => (
          <ExpirationGroup
            key={group.name}
            groupName={group.name}
            items={group.items}
          />
        ))
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">No items with expiration dates at this facility.</p>
        </div>
      )}
    </div>
  )
}
