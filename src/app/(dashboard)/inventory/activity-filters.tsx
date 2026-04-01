'use client'

export type EventTypeFilter = 'all' | 'add' | 'remove' | 'restore'

interface ActivityFiltersProps {
  search: string
  onSearchChange: (val: string) => void
  eventType: EventTypeFilter
  onEventTypeChange: (val: EventTypeFilter) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (val: string) => void
  onDateToChange: (val: string) => void
  totalCount: number
}

export default function ActivityFilters({
  search,
  onSearchChange,
  eventType,
  onEventTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  totalCount,
}: ActivityFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by description, ref#, or lot#..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={eventType}
          onChange={(e) => onEventTypeChange(e.target.value as EventTypeFilter)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">All Events</option>
          <option value="add">Added</option>
          <option value="remove">Removed</option>
          <option value="restore">Restored</option>
        </select>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <span className="text-sm text-gray-500 sm:ml-auto">{totalCount} events</span>
      </div>
    </div>
  )
}
