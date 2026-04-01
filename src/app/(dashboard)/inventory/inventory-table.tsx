'use client'

import { useState, useMemo } from 'react'

interface InventoryItem {
  id: string
  facility_id: string
  gtin: string | null
  reference_number: string | null
  description: string | null
  lot_number: string | null
  expiration_date: string | null
  added_at: string
  facilities: { name: string } | { name: string }[] | null
}

interface Facility {
  id: string
  name: string
}

export default function InventoryTable({
  items,
  facilities,
  gtinDisplayName,
}: {
  items: InventoryItem[]
  facilities: Facility[]
  gtinDisplayName: Record<string, string>
}) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'description' | 'reference_number' | 'expiration_date' | 'added_at'>('added_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const perPage = 25

  const filteredItems = useMemo(() => {
    let result = items

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.description?.toLowerCase().includes(q) ||
          item.reference_number?.toLowerCase().includes(q) ||
          item.gtin?.includes(q) ||
          item.lot_number?.toLowerCase().includes(q) ||
          (item.gtin && gtinDisplayName[item.gtin]?.toLowerCase().includes(q))
      )
    }

    result.sort((a, b) => {
      const aVal = a[sortField] ?? ''
      const bVal = b[sortField] ?? ''
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })

    return result
  }, [items, search, sortField, sortDir, gtinDisplayName])

  const totalPages = Math.ceil(filteredItems.length / perPage)
  const paginatedItems = filteredItems.slice((page - 1) * perPage, page * perPage)

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const isExpired = (date: string | null) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false
    const d = new Date(date)
    const now = new Date()
    const ninety = new Date()
    ninety.setDate(ninety.getDate() + 90)
    return d >= now && d <= ninety
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by description, reference, GTIN, or lot number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>{filteredItems.length} items found</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Expired
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Expiring ≤90 days
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort('description')}
                >
                  Description <SortIcon field="description" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort('reference_number')}
                >
                  Reference <SortIcon field="reference_number" />
                </th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Lot</th>
                <th
                  className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort('expiration_date')}
                >
                  Expiration <SortIcon field="expiration_date" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort('added_at')}
                >
                  Added <SortIcon field="added_at" />
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="font-medium text-gray-900 block truncate">
                        {(item.gtin && gtinDisplayName[item.gtin]) || item.description || '—'}
                      </span>
                      {item.gtin && gtinDisplayName[item.gtin] && gtinDisplayName[item.gtin] !== item.description && (
                        <span className="text-xs text-gray-400 block truncate">{item.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">
                      {item.reference_number ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">
                      {item.lot_number ?? '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      {item.expiration_date ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isExpired(item.expiration_date)
                            ? 'bg-red-100 text-red-700'
                            : isExpiringSoon(item.expiration_date)
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.expiration_date}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">
                      {new Date(item.added_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                )
              })}
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No items found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
