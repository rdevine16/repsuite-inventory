'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ActivityEvent } from './activity-tab'

const eventBadge: Record<string, { label: string; className: string }> = {
  add: { label: 'Added', className: 'bg-emerald-100 text-emerald-700' },
  remove: { label: 'Used', className: 'bg-red-100 text-red-700' },
  restore: { label: 'Restored', className: 'bg-blue-100 text-blue-700' },
}

export default function ActivityRow({ event }: { event: ActivityEvent }) {
  const [expanded, setExpanded] = useState(false)
  const badge = eventBadge[event.event_type] ?? { label: event.event_type, className: 'bg-gray-100 text-gray-600' }

  return (
    <>
      <tr
        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2.5 px-4">
          <span className="text-xs text-gray-500">
            {new Date(event.event_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </td>
        <td className="py-2.5 px-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
          {event.source_conflict && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Conflict
            </span>
          )}
        </td>
        <td className="py-2.5 px-4 max-w-xs">
          <span className="font-medium text-gray-900 block truncate text-sm">
            {event.description || '—'}
          </span>
        </td>
        <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">
          {event.reference_number ?? '—'}
        </td>
        <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">
          {event.lot_number ?? '—'}
        </td>
        <td className="py-2.5 px-4 text-xs text-gray-500">
          {event.event_type !== 'add' && event.surgeon_name ? (
            <span>{event.surgeon_name}</span>
          ) : '—'}
        </td>
        <td className="py-2.5 px-4 text-xs text-gray-400">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/70">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Lot & Expiration */}
              <div>
                <p className="text-gray-500 font-medium mb-1">Lot / Expiration</p>
                <p className="text-gray-900 font-mono">{event.lot_number ?? 'N/A'}</p>
                <p className="text-gray-600">{event.expiration_date ?? 'No expiration'}</p>
              </div>

              {/* Case Linkage (remove/restore only) */}
              {event.event_type !== 'add' && event.case_id && (
                <div>
                  <p className="text-gray-500 font-medium mb-1">Linked Case</p>
                  <Link
                    href={`/cases/${event.case_id}`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {event.case_display_id ?? 'View Case'}
                  </Link>
                  <p className="text-gray-600">{event.procedure_name ?? ''}</p>
                  {event.surgery_date && (
                    <p className="text-gray-500">
                      {new Date(event.surgery_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              )}

              {event.event_type !== 'add' && !event.case_id && (
                <div>
                  <p className="text-gray-500 font-medium mb-1">Linked Case</p>
                  <p className="text-gray-400 italic">No case linked</p>
                </div>
              )}

              {/* Deduction Method */}
              {event.event_type !== 'add' && (
                <div>
                  <p className="text-gray-500 font-medium mb-1">Deduction Method</p>
                  <div className="flex flex-wrap gap-1.5">
                    {event.auto_deducted && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                        Auto-deducted
                      </span>
                    )}
                    {event.manually_overridden && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                        Manually overridden
                      </span>
                    )}
                    {!event.auto_deducted && !event.manually_overridden && (
                      <span className="text-gray-400">Manual</span>
                    )}
                  </div>
                  {event.current_status && (
                    <p className="text-gray-500 mt-1">Status: {event.current_status}</p>
                  )}
                </div>
              )}

              {/* Source Conflict Detail */}
              {event.source_conflict && (
                <div>
                  <p className="text-gray-500 font-medium mb-1">Source Conflict</p>
                  <p className="text-amber-700 text-xs">
                    RepSuite location differs from user-specified facility
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
