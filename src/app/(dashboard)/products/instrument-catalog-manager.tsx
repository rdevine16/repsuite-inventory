'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface CatalogItem {
  id: string
  display_name: string
  repsuite_name: string | null
  category: string
  item_type: string
  catalog_number: string | null
  is_custom: boolean
}

const PAGE_SIZE = 25

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
  { id: 'mako', label: 'Mako' },
  { id: 'general', label: 'General' },
]

export default function InstrumentCatalogManager({
  catalogItems,
  usageCounts,
  userRole,
  itemType,
}: {
  catalogItems: CatalogItem[]
  usageCounts: Record<string, number>
  userRole: string
  itemType: 'tray' | 'instrument'
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const router = useRouter()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const filtered = useMemo(() => {
    let result = catalogItems

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.display_name.toLowerCase().includes(q) ||
          item.repsuite_name?.toLowerCase().includes(q) ||
          item.catalog_number?.toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter)
    }

    if (mappingFilter === 'mapped') {
      result = result.filter((item) => item.repsuite_name)
    } else if (mappingFilter === 'unmapped') {
      result = result.filter((item) => !item.repsuite_name)
    }

    return result
  }, [catalogItems, search, categoryFilter, mappingFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [search, categoryFilter, mappingFilter])

  const mappedCount = catalogItems.filter((item) => item.repsuite_name).length
  const customCount = catalogItems.filter((item) => item.is_custom).length
  const typeLabel = itemType === 'tray' ? 'Trays' : 'Instruments'
  const typeLabelSingular = itemType === 'tray' ? 'Tray' : 'Instrument'

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-lg font-bold text-gray-900 ml-2">{catalogItems.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Mapped</span>
          <span className="text-lg font-bold text-blue-600 ml-2">{mappedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Unmapped</span>
          <span className="text-lg font-bold text-amber-600 ml-2">{catalogItems.length - mappedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Custom</span>
          <span className="text-lg font-bold text-gray-600 ml-2">{customCount}</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={`Search by name, RepSuite name, or ref #...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <select
            value={mappingFilter}
            onChange={(e) => setMappingFilter(e.target.value as typeof mappingFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All ({catalogItems.length})</option>
            <option value="mapped">Mapped ({mappedCount})</option>
            <option value="unmapped">Unmapped ({catalogItems.length - mappedCount})</option>
          </select>
          {canEdit && (
            <button
              onClick={() => { setEditingItem(null); setShowForm(true) }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap"
            >
              + Add {typeLabelSingular}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {filtered.length} of {catalogItems.length} {typeLabel.toLowerCase()}
          {search && <span> matching &ldquo;{search}&rdquo;</span>}
        </p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <CatalogForm
          item={editingItem}
          itemType={itemType}
          onClose={() => { setShowForm(false); setEditingItem(null) }}
          onSaved={() => { setShowForm(false); setEditingItem(null); router.refresh() }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Display Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">RepSuite Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Category</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref #</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Facilities</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Type</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 group/row">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{item.display_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    {item.repsuite_name ? (
                      <span className="text-gray-600">{item.repsuite_name}</span>
                    ) : (
                      <span className="text-gray-300 italic">Not mapped</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500 capitalize">{item.category}</span>
                  </td>
                  <td className="py-3 px-4">
                    {item.catalog_number ? (
                      <span className="font-mono text-xs text-gray-600">{item.catalog_number}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">
                    {usageCounts[item.id] ?? 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.is_custom ? (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Custom</span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Stock</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => { setEditingItem(item); setShowForm(true) }}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-gray-400">
                    {catalogItems.length === 0
                      ? `No ${typeLabel.toLowerCase()} in catalog yet. Add your first one to get started.`
                      : `No ${typeLabel.toLowerCase()} match your search.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
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
    </div>
  )
}

function CatalogForm({
  item,
  itemType,
  onClose,
  onSaved,
}: {
  item: CatalogItem | null
  itemType: 'tray' | 'instrument'
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(item?.display_name ?? '')
  const [repsuiteName, setRepsuiteName] = useState(item?.repsuite_name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'general')
  const [catalogNumber, setCatalogNumber] = useState(item?.catalog_number ?? '')
  const [isCustom, setIsCustom] = useState(item?.is_custom ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      display_name: displayName.trim(),
      repsuite_name: repsuiteName.trim() || null,
      category,
      item_type: itemType,
      catalog_number: catalogNumber.trim() || null,
      is_custom: isCustom,
      updated_at: new Date().toISOString(),
    }

    let result
    if (item) {
      result = await supabase.from('instrument_catalog').update(payload).eq('id', item.id)
    } else {
      result = await supabase.from('instrument_catalog').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  const handleDelete = async () => {
    if (!item) return
    if (!confirm(`Remove "${item.display_name}" from the catalog?`)) return
    setSaving(true)

    const { error: delError } = await supabase.from('instrument_catalog').delete().eq('id', item.id)
    if (delError) {
      setError(delError.message)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  const typeLabelSingular = itemType === 'tray' ? 'Tray' : 'Instrument'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        {item ? `Edit ${typeLabelSingular}` : `Add ${typeLabelSingular} to Catalog`}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={itemType === 'tray' ? 'e.g., Acetabular Reamer Tray' : 'e.g., Femoral Head Impactor'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RepSuite Name</label>
          <input
            type="text"
            value={repsuiteName}
            onChange={(e) => setRepsuiteName(e.target.value)}
            placeholder="Name as it appears in RepSuite"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Ref #</label>
          <input
            type="text"
            value={catalogNumber}
            onChange={(e) => setCatalogNumber(e.target.value)}
            placeholder="e.g., 393035"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="is_custom"
            checked={isCustom}
            onChange={(e) => setIsCustom(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_custom" className="text-sm text-gray-700">
            Custom {typeLabelSingular.toLowerCase()} (not a standard Stryker item)
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : item ? 'Update' : 'Add to Catalog'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        {item && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium ml-auto disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {/* Items template editor — only for existing tray catalog entries */}
      {item && itemType === 'tray' && (
        <CatalogItemsEditor catalogId={item.id} catalogName={item.display_name} />
      )}
    </div>
  )
}

interface CatalogItemRow {
  id: string
  catalog_id: string
  name: string
  catalog_number: string | null
  quantity_expected: number
  sort_order: number
}

function CatalogItemsEditor({ catalogId, catalogName }: { catalogId: string; catalogName: string }) {
  const [items, setItems] = useState<CatalogItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [addRef, setAddRef] = useState('')
  const [addQty, setAddQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRef, setEditRef] = useState('')
  const [editQty, setEditQty] = useState(1)
  const supabase = createClient()

  const loadItems = async () => {
    const { data } = await supabase
      .from('instrument_catalog_items')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('sort_order')
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [catalogId])

  const handleAdd = async () => {
    if (!addName.trim()) return
    setSaving(true)
    await supabase.from('instrument_catalog_items').insert({
      catalog_id: catalogId,
      name: addName.trim(),
      catalog_number: addRef.trim() || null,
      quantity_expected: addQty,
      sort_order: items.length,
    })
    setAddName('')
    setAddRef('')
    setAddQty(1)
    setSaving(false)
    loadItems()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('instrument_catalog_items').delete().eq('id', id)
    loadItems()
  }

  const startEdit = (item: CatalogItemRow) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditRef(item.catalog_number ?? '')
    setEditQty(item.quantity_expected)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    await supabase.from('instrument_catalog_items').update({
      name: editName.trim(),
      catalog_number: editRef.trim() || null,
      quantity_expected: editQty,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)
    setEditingId(null)
    loadItems()
  }

  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">
          Items in this tray
          <span className="ml-2 text-xs font-normal text-gray-400">({items.length} items)</span>
        </h4>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium text-xs">Ref #</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium text-xs">Description</th>
                    <th className="text-center py-2 px-3 text-gray-600 font-medium text-xs w-16">Exp</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-medium text-xs w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 group/item">
                      {editingId === item.id ? (
                        <>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={editRef}
                              onChange={(e) => setEditRef(e.target.value)}
                              placeholder="Ref #"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              value={editQty}
                              onChange={(e) => setEditQty(parseInt(e.target.value) || 1)}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-xs text-center"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <button onClick={handleSaveEdit} className="text-xs text-blue-600 hover:text-blue-800 mr-2">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 font-mono text-xs text-gray-500">{item.catalog_number ?? '—'}</td>
                          <td className="py-2 px-3 text-gray-700">{item.name}</td>
                          <td className="py-2 px-3 text-center text-gray-600">{item.quantity_expected}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => startEdit(item)}
                              className="opacity-0 group-hover/item:opacity-100 text-xs text-gray-400 hover:text-blue-600 mr-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="opacity-0 group-hover/item:opacity-100 text-xs text-gray-400 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add new item row */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g., 36mm Reamer"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">Ref #</label>
              <input
                type="text"
                value={addRef}
                onChange={(e) => setAddRef(e.target.value)}
                placeholder="393035"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-16">
              <label className="block text-xs text-gray-500 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !addName.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              + Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}
