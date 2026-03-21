'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Tray {
  id: string
  facility_id: string
  name: string
  set_id: string | null
  catalog_number: string | null
  category: string
  tray_type: string
  item_type: string
  quantity: number
  status: string
  missing_items: string | null
  notes: string | null
}

const CATEGORIES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
  { id: 'general', label: 'General' },
]

const STATUS_CONFIG = {
  complete: { label: 'Complete', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  usable: { label: 'Usable', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  not_usable: { label: 'Not Usable', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}

type SortField = 'name' | 'item_type' | 'status'

export default function InstrumentTrays({
  facilityId,
  trays,
  canEdit,
}: {
  facilityId: string
  trays: Tray[]
  canEdit: boolean
}) {
  const [tab, setTab] = useState('knee')
  const [showForm, setShowForm] = useState(false)
  const [editingTray, setEditingTray] = useState<Tray | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues'>('all')
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
                onClick={() => setTab(cat.id)}
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
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'issues')}
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
                  <th className="text-center py-3 px-4 text-gray-600 font-medium">Qty</th>
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
                {filteredTrays.map((tray) => {
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
                      <td className="py-3 px-4 text-center text-gray-600">{tray.quantity}</td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TrayForm({
  facilityId,
  tray,
  defaultCategory,
  onClose,
  onSaved,
}: {
  facilityId: string
  tray: Tray | null
  defaultCategory: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(tray?.name ?? '')
  const [setId, setSetId] = useState(tray?.set_id ?? '')
  const [catalogNumber, setCatalogNumber] = useState(tray?.catalog_number ?? '')
  const [category, setCategory] = useState(tray?.category ?? defaultCategory)
  const [itemType, setItemType] = useState(tray?.item_type ?? 'tray')
  const [trayType, setTrayType] = useState(tray?.tray_type ?? 'standard')
  const [quantity, setQuantity] = useState(tray?.quantity ?? 1)
  const [status, setStatus] = useState(tray?.status ?? 'complete')
  const [missingItems, setMissingItems] = useState(tray?.missing_items ?? '')
  const [notes, setNotes] = useState(tray?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      facility_id: facilityId,
      name: name.trim(),
      set_id: setId.trim() || null,
      catalog_number: catalogNumber.trim() || null,
      category,
      item_type: itemType,
      tray_type: trayType,
      quantity,
      status,
      missing_items: missingItems.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (tray) {
      result = await supabase.from('instrument_trays').update(payload).eq('id', tray.id)
    } else {
      result = await supabase.from('instrument_trays').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
    } else {
      onSaved()
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Set ID</label>
          <input
            type="text"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            placeholder="e.g., FD, 1, A"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="knee">Knee</option>
            <option value="hip">Hip</option>
            <option value="general">General</option>
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
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
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
