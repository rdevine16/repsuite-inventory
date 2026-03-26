'use client'

import React, { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Tray {
  id: string
  facility_id: string
  name: string
  set_id: string | null
  catalog_number: string | null
  catalog_id: string | null
  category: string
  subcategory: string
  tray_type: string
  item_type: string
  quantity: number
  status: string
  missing_items: string | null
  notes: string | null
}

interface CatalogItem {
  id: string
  display_name: string
  repsuite_name: string | null
  category: string
  subcategory: string
  item_type: string
  catalog_number: string | null
  is_custom: boolean
}

const CATEGORIES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
  { id: 'mako', label: 'Mako' },
  { id: 'general', label: 'General' },
]

const SUBCATEGORIES = [
  { id: 'primary', label: 'Primary' },
  { id: 'revision', label: 'Revision' },
  { id: 'surgeon_extras', label: 'Surgeon Extras' },
  { id: 'general', label: 'General' },
]

const PAGE_SIZE = 25

const STATUS_CONFIG = {
  complete: { label: 'Complete', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  usable: { label: 'Usable', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  not_usable: { label: 'Not Usable', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}

type SortField = 'name' | 'item_type' | 'status'

export default function InstrumentTrays({
  facilityId,
  trays,
  catalogItems,
  canEdit,
}: {
  facilityId: string
  trays: Tray[]
  catalogItems: CatalogItem[]
  canEdit: boolean
}) {
  const [tab, setTab] = useState('knee')
  const [showForm, setShowForm] = useState(false)
  const [editingTray, setEditingTray] = useState<Tray | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const router = useRouter()
  const supabase = createClient()

  const filteredTrays = useMemo(() => {
    let result = trays.filter((t) => t.category === tab)

    if (statusFilter === 'issues') {
      result = result.filter((t) => t.status !== 'complete')
    }

    result.sort((a, b) => {
      const aVal = a[sortField] ?? ''
      const bVal = b[sortField] ?? ''
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })

    return result
  }, [trays, tab, sortField, sortDir, statusFilter])

  // Group by subcategory for display
  const groupedTrays = useMemo(() => {
    const groups: { id: string; label: string; trays: Tray[] }[] = []
    const subcatOrder = SUBCATEGORIES.map((s) => s.id)
    const bySubcat: Record<string, Tray[]> = {}
    filteredTrays.forEach((t) => {
      const sc = t.subcategory || 'primary'
      if (!bySubcat[sc]) bySubcat[sc] = []
      bySubcat[sc].push(t)
    })
    subcatOrder.forEach((scId) => {
      if (bySubcat[scId]?.length) {
        groups.push({
          id: scId,
          label: SUBCATEGORIES.find((s) => s.id === scId)?.label ?? scId,
          trays: bySubcat[scId],
        })
      }
    })
    // Any subcategories not in the predefined list
    Object.keys(bySubcat).forEach((scId) => {
      if (!subcatOrder.includes(scId)) {
        groups.push({ id: scId, label: scId, trays: bySubcat[scId] })
      }
    })
    return groups
  }, [filteredTrays])

  const totalPages = Math.ceil(filteredTrays.length / PAGE_SIZE)
  const paginatedTrays = filteredTrays.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset to page 1 when filters change
  const handleTabChange = (newTab: string) => { setTab(newTab); setCurrentPage(1) }
  const handleStatusFilterChange = (val: 'all' | 'issues') => { setStatusFilter(val); setCurrentPage(1) }

  const categoryCounts = CATEGORIES.map((cat) => {
    const catTrays = trays.filter((t) => t.category === cat.id)
    return {
      ...cat,
      trays: catTrays.filter((t) => t.item_type === 'tray').length,
      instruments: catTrays.filter((t) => t.item_type === 'instrument').length,
      issues: catTrays.filter((t) => t.status !== 'complete').length,
    }
  })

  const currentCat = categoryCounts.find((c) => c.id === tab)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item?')) return
    await supabase.from('instrument_trays').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Tabs + Actions */}
      <div className="flex items-center justify-between">
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {categoryCounts.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                  tab === cat.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {cat.label}
                {(cat.trays + cat.instruments) > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    tab === cat.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>{cat.trays + cat.instruments}</span>
                )}
                {cat.issues > 0 && (
                  <span className="ml-1 text-xs text-red-500">{cat.issues}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'issues')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="issues">Issues Only</option>
          </select>
          {canEdit && (
            <button
              onClick={() => { setEditingTray(null); setShowForm(true) }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {currentCat && (currentCat.trays + currentCat.instruments) > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-900">{currentCat.trays}</span> trays
          </span>
          <span className="text-gray-500">
            <span className="font-semibold text-gray-900">{currentCat.instruments}</span> instruments
          </span>
          {currentCat.issues > 0 && (
            <span className="text-red-600 font-medium">{currentCat.issues} with issues</span>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <TrayForm
          facilityId={facilityId}
          tray={editingTray}
          catalogItems={catalogItems}
          defaultCategory={tab}
          onClose={() => { setShowForm(false); setEditingTray(null) }}
          onSaved={() => { setShowForm(false); setEditingTray(null); router.refresh() }}
        />
      )}

      {/* Table */}
      {filteredTrays.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
          <p>{statusFilter === 'issues' ? 'No issues found.' : `No ${tab} items tracked at this facility.`}</p>
          {canEdit && statusFilter === 'all' && <p className="text-sm mt-1">Click &quot;+ Add Item&quot; to get started.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th
                    className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Name <SortIcon field="name" />
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Set ID</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref #</th>
                  <th
                    className="text-left py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => handleSort('item_type')}
                  >
                    Item <SortIcon field="item_type" />
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Config</th>
                  <th
                    className="text-center py-3 px-4 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Missing Items</th>
                  {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-24"></th>}
                </tr>
              </thead>
              <tbody>
                {groupedTrays.map((group) => (
                  <React.Fragment key={`group-${group.id}`}>
                    {groupedTrays.length > 1 && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="py-2 px-4 bg-gray-100/80 border-b border-gray-200">
                          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group.label}</span>
                          <span className="text-xs text-gray-400 ml-2">{group.trays.length}</span>
                        </td>
                      </tr>
                    )}
                    {group.trays.map((tray) => {
                  const statusConfig = STATUS_CONFIG[tray.status as keyof typeof STATUS_CONFIG]
                  return (
                    <tr key={tray.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{tray.name}</span>
                        {tray.notes && (
                          <span className="block text-xs text-gray-400 truncate max-w-xs">{tray.notes}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{tray.set_id ?? '—'}</td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{tray.catalog_number ?? '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 capitalize">{tray.item_type}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 capitalize">{tray.tray_type}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate">{tray.missing_items ?? '—'}</td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => { setEditingTray(tray); setShowForm(true) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition inline-flex"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(tray.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition inline-flex ml-1"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTrays.length)} of {filteredTrays.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number
                  if (totalPages <= 5) {
                    page = i + 1
                  } else if (currentPage <= 3) {
                    page = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i
                  } else {
                    page = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2.5 py-1 text-xs rounded border ${
                        page === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 bg-white hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrayForm({
  facilityId,
  tray,
  catalogItems,
  defaultCategory,
  onClose,
  onSaved,
}: {
  facilityId: string
  tray: Tray | null
  catalogItems: CatalogItem[]
  defaultCategory: string
  onClose: () => void
  onSaved: () => void
}) {
  const [mode, setMode] = useState<'catalog' | 'custom'>(tray ? (tray.catalog_id ? 'catalog' : 'custom') : 'catalog')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(
    tray?.catalog_id ? catalogItems.find((c) => c.id === tray.catalog_id) ?? null : null
  )
  const [name, setName] = useState(tray?.name ?? '')
  const [setId, setSetId] = useState(tray?.set_id ?? '')
  const [catalogNumber, setCatalogNumber] = useState(tray?.catalog_number ?? '')
  const [category, setCategory] = useState(tray?.category ?? defaultCategory)
  const [subcategory, setSubcategory] = useState(tray?.subcategory ?? 'primary')
  const [itemType, setItemType] = useState(tray?.item_type ?? 'tray')
  const [trayType, setTrayType] = useState(tray?.tray_type ?? 'standard')
  const [quantity, setQuantity] = useState(tray?.quantity ?? 1)
  const [status, setStatus] = useState(tray?.status ?? 'complete')
  const [missingItems, setMissingItems] = useState(tray?.missing_items ?? '')
  const [notes, setNotes] = useState(tray?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const supabase = createClient()

  // Filter catalog items by search and category
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch && !showDropdown) return []
    let result = catalogItems
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase()
      result = result.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          c.catalog_number?.toLowerCase().includes(q) ||
          c.repsuite_name?.toLowerCase().includes(q)
      )
    }
    return result.slice(0, 20)
  }, [catalogItems, catalogSearch, showDropdown])

  const selectCatalogItem = (item: CatalogItem) => {
    setSelectedCatalog(item)
    setName(item.display_name)
    setCatalogNumber(item.catalog_number ?? '')
    setCategory(item.category)
    setSubcategory(item.subcategory ?? 'primary')
    setItemType(item.item_type)
    setTrayType(item.is_custom ? 'custom' : 'standard')
    setCatalogSearch('')
    setShowDropdown(false)
  }

  const clearCatalogSelection = () => {
    setSelectedCatalog(null)
    setName('')
    setCatalogNumber('')
    setCatalogSearch('')
  }

  const handleSave = async () => {
    const finalName = mode === 'catalog' ? (selectedCatalog?.display_name ?? '') : name.trim()
    if (!finalName) {
      setError(mode === 'catalog' ? 'Please select an item from the catalog.' : 'Name is required.')
      return
    }
    setSaving(true)
    setError(null)

    if (tray) {
      // Editing: update single row
      const payload = {
        facility_id: facilityId,
        name: finalName,
        set_id: setId.trim() || null,
        catalog_number: catalogNumber.trim() || null,
        catalog_id: mode === 'catalog' ? selectedCatalog?.id ?? null : null,
        category,
        subcategory,
        item_type: itemType,
        tray_type: trayType,
        quantity: 1,
        status,
        missing_items: missingItems.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const result = await supabase.from('instrument_trays').update(payload).eq('id', tray.id)
      if (result.error) {
        setError(result.error.message)
        setSaving(false)
      } else {
        onSaved()
      }
    } else {
      // Adding: create N individual rows
      const rows = Array.from({ length: quantity }, () => ({
        facility_id: facilityId,
        name: finalName,
        set_id: setId.trim() || null,
        catalog_number: catalogNumber.trim() || null,
        catalog_id: mode === 'catalog' ? selectedCatalog?.id ?? null : null,
        category,
        subcategory,
        item_type: itemType,
        tray_type: trayType,
        quantity: 1,
        status,
        missing_items: null,
        notes: null,
      }))
      const result = await supabase.from('instrument_trays').insert(rows)
      if (result.error) {
        setError(result.error.message)
        setSaving(false)
      } else {
        onSaved()
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {tray ? 'Edit Item' : 'Add Item'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('catalog'); clearCatalogSelection() }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            mode === 'catalog'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          From Catalog
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            mode === 'custom'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Custom Entry
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {mode === 'catalog' ? (
          <div className="sm:col-span-2 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select from Catalog</label>
            {selectedCatalog ? (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <span className="font-medium text-gray-900">{selectedCatalog.display_name}</span>
                  <span className="text-xs text-gray-500 ml-2 capitalize">{selectedCatalog.category}</span>
                  {selectedCatalog.catalog_number && (
                    <span className="text-xs font-mono text-gray-500 ml-2">{selectedCatalog.catalog_number}</span>
                  )}
                </div>
                <button
                  onClick={clearCatalogSelection}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => { setCatalogSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search trays, instruments..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {showDropdown && filteredCatalog.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                    {filteredCatalog.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectCatalogItem(item)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-900">{item.display_name}</span>
                        <span className="text-xs text-gray-400 ml-2 capitalize">{item.category}</span>
                        {item.catalog_number && (
                          <span className="text-xs font-mono text-gray-400 ml-2">{item.catalog_number}</span>
                        )}
                        {item.is_custom && (
                          <span className="text-xs text-gray-400 ml-1">(custom)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && catalogSearch && filteredCatalog.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full border border-gray-200 rounded-lg bg-white shadow-lg p-3 text-sm text-gray-400">
                    No matching items. Try &ldquo;Custom Entry&rdquo; to add a new one.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Insignia Broach Tray"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="tray">Tray</option>
                <option value="instrument">Instrument</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Set ID</label>
          <input
            type="text"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            placeholder="e.g., FD, 1, A"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ref #</label>
              <input
                type="text"
                value={catalogNumber}
                onChange={(e) => setCatalogNumber(e.target.value)}
                placeholder="e.g., 393035"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="knee">Knee</option>
                <option value="hip">Hip</option>
                <option value="mako">Mako</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {SUBCATEGORIES.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Configuration</label>
              <select
                value={trayType}
                onChange={(e) => setTrayType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="standard">Standard</option>
                <option value="mako">Mako</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </>
        )}
        {!tray && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How many to add?</label>
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {quantity > 1 && (
              <p className="text-xs text-gray-400 mt-1">This will create {quantity} individual rows, each editable separately.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="complete">Complete</option>
            <option value="usable">Usable — Missing Items</option>
            <option value="not_usable">Not Usable — Critical Missing</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Missing Items</label>
          <input
            type="text"
            value={missingItems}
            onChange={(e) => setMissingItems(e.target.value)}
            placeholder="e.g., 4mm drill guide"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : tray ? 'Update' : 'Add'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
