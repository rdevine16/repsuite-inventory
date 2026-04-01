'use client'

import Link from 'next/link'

export interface Discrepancy {
  id: string
  type: 'source_conflict' | 'unmatched_deduction' | 'not_matched'
  description: string | null
  reference_number: string | null
  lot_number: string | null
  case_id: string | null
  case_display_id: string | null
  surgeon_name: string | null
  created_at: string
}

const typeConfig: Record<string, { label: string; severity: string; badgeClass: string; explanation: string }> = {
  source_conflict: {
    label: 'Source Conflict',
    severity: 'Warning',
    badgeClass: 'bg-amber-100 text-amber-700',
    explanation: 'RepSuite location differs from user-specified facility',
  },
  unmatched_deduction: {
    label: 'Unmatched Deduction',
    severity: 'Alert',
    badgeClass: 'bg-red-100 text-red-700',
    explanation: 'Item removed from inventory with no linked case record',
  },
  not_matched: {
    label: 'Not Matched',
    severity: 'Warning',
    badgeClass: 'bg-amber-100 text-amber-700',
    explanation: 'Case usage record exists but no inventory item was deducted',
  },
}

export default function Discrepancies({ items }: { items: Discrepancy[] }) {
  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
      <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-red-900">Discrepancies</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-800">
            {items.length}
          </span>
        </div>
        <span className="text-xs text-red-700">Requires investigation</span>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((item) => {
          const config = typeConfig[item.type]
          return (
            <div key={`${item.type}-${item.id}`} className="px-5 py-3 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-900 truncate">
                  {item.description || item.reference_number || 'Unknown item'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{config.explanation}</p>
                {item.reference_number && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    Ref: {item.reference_number}
                    {item.lot_number && ` · Lot: ${item.lot_number}`}
                  </p>
                )}
                {item.surgeon_name && (
                  <p className="text-xs text-gray-500 mt-0.5">Surgeon: {item.surgeon_name}</p>
                )}
              </div>
              {item.case_id && (
                <Link
                  href={`/cases/${item.case_id}`}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  {item.case_display_id ?? 'View Case'}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
