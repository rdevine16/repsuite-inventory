'use client'

import { useState, useMemo } from 'react'
import ActivityFilters, { type EventTypeFilter } from './activity-filters'
import ActivityRow from './activity-row'

export interface ActivityEvent {
  event_id: string
  event_type: 'add' | 'remove' | 'restore'
  event_at: string
  facility_id: string
  reference_number: string | null
  description: string | null
  lot_number: string | null
  expiration_date: string | null
  gtin: string | null
  case_id: string | null
  case_display_id: string | null
  surgeon_name: string | null
  procedure_name: string | null
  surgery_date: string | null
  auto_deducted: boolean | null
  manually_overridden: boolean | null
  source_conflict: boolean | null
  current_status: string | null
  case_usage_item_id: string | null
}

const PER_PAGE = 50

export default function ActivityTab({ events }: { events: ActivityEvent[] }) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState<EventTypeFilter>('all')
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let result = events

    // Event type filter
    if (eventType !== 'all') {
      result = result.filter((e) => e.event_type === eventType)
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((e) => e.event_at >= dateFrom)
    }
    if (dateTo) {
      const endOfDay = dateTo + 'T23:59:59.999Z'
      result = result.filter((e) => e.event_at <= endOfDay)
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.reference_number?.toLowerCase().includes(q) ||
          e.lot_number?.toLowerCase().includes(q) ||
          e.surgeon_name?.toLowerCase().includes(q)
      )
    }

    return result
  }, [events, eventType, dateFrom, dateTo, search])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleFilterChange = () => setPage(1)

  return (
    <div className="space-y-4">
      <ActivityFilters
        search={search}
        onSearchChange={(v) => { setSearch(v); handleFilterChange() }}
        eventType={eventType}
        onEventTypeChange={(v) => { setEventType(v); handleFilterChange() }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => { setDateFrom(v); handleFilterChange() }}
        onDateToChange={(v) => { setDateTo(v); handleFilterChange() }}
        totalCount={filtered.length}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Time</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Event</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Description</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref#</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Lot#</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Surgeon</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((event) => (
                <ActivityRow key={`${event.event_type}-${event.event_id}`} event={event} />
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No activity events found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
