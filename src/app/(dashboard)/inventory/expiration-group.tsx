'use client'

import { useState } from 'react'

export interface ExpirationItem {
  id: string
  reference_number: string | null
  description: string | null
  lot_number: string | null
  expiration_date: string
  gtin: string | null
  tier: 'expired' | 'red' | 'amber' | 'yellow' | 'gray'
}

const tierStyles: Record<string, { bg: string; text: string; label: string }> = {
  expired: { bg: 'bg-red-200', text: 'text-red-900', label: 'Expired' },
  red: { bg: 'bg-red-100', text: 'text-red-700', label: '< 30 days' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', label: '30–60 days' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '60–90 days' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', label: '> 90 days' },
}

export default function ExpirationGroup({
  groupName,
  items,
}: {
  groupName: string
  items: ExpirationItem[]
}) {
  const [open, setOpen] = useState(true)

  // Count per tier
  const tierCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.tier] = (acc[item.tier] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{groupName}</span>
          <span className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(tierCounts).map(([tier, count]) => {
            const style = tierStyles[tier]
            return (
              <span
                key={tier}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
              >
                {count}
              </span>
            )
          })}
          <span className="text-gray-400 text-xs ml-1">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Description</th>
              <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Ref#</th>
              <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Lot#</th>
              <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Expiration</th>
              <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Urgency</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const style = tierStyles[item.tier]
              return (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-5 text-gray-900 text-sm truncate max-w-xs">
                    {item.description || '—'}
                  </td>
                  <td className="py-2 px-5 text-gray-600 font-mono text-xs">
                    {item.reference_number ?? '—'}
                  </td>
                  <td className="py-2 px-5 text-gray-600 font-mono text-xs">
                    {item.lot_number ?? '—'}
                  </td>
                  <td className="py-2 px-5 text-sm">
                    {item.expiration_date}
                  </td>
                  <td className="py-2 px-5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
