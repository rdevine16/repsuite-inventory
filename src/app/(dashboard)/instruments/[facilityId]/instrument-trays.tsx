'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Tray {
  id: string
  facility_id: string
  name: string
  set_id: string | null
  category: string
  tray_type: string
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
  const router = useRouter()
  const supabase = createClient()

  const filteredTrays = trays.filter((t) => t.category === tab)

  const categoryCounts = CATEGORIES.map((cat) => ({
    ...cat,
    count: trays.filter((t) => t.category === cat.id).length,
    issues: trays.filter((t) => t.category === cat.id && t.status !== 'complete').length,
  }))

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this tray?')) return
    await supabase.from('instrument_trays').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
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
                {cat.count > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    tab === cat.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>{cat.count}</span>
                )}
                {cat.issues > 0 && (
                  <span className="ml-1 text-xs text-red-500">{cat.issues}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {canEdit && (
          <button
            onClick={() => { setEditingTray(null); setShowForm(true) }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Add Tray
          </button>
        )}
      </div>

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

      {/* Tray Cards */}
      {filteredTrays.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
          <p>No {tab} trays tracked at this facility.</p>
          {canEdit && <p className="text-sm mt-1">Click &quot;+ Add Tray&quot; to get started.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrays.map((tray) => {
            const statusConfig = STATUS_CONFIG[tray.status as keyof typeof STATUS_CONFIG]
            return (
              <div
                key={tray.id}
                className={`rounded-xl border p-5 ${
                  tray.status === 'not_usable'
                    ? 'border-red-200 bg-red-50/30'
                    : tray.status === 'usable'
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{tray.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {tray.set_id && (
                        <span className="text-xs text-gray-500 font-mono">Set: {tray.set_id}</span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">{tray.tray_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
                    <span className={`text-xs font-medium ${
                      tray.status === 'complete' ? 'text-emerald-600' :
                      tray.status === 'usable' ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {tray.missing_items && (
                  <div className="mb-3 p-2.5 bg-white/60 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">Missing</p>
                    <p className="text-sm text-gray-700">{tray.missing_items}</p>
                  </div>
                )}

                {tray.notes && (
                  <p className="text-xs text-gray-400 mb-3">{tray.notes}</p>
                )}

                {canEdit && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => { setEditingTray(tray); setShowForm(true) }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tray.id)}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )
          })}
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
  const [category, setCategory] = useState(tray?.category ?? defaultCategory)
  const [trayType, setTrayType] = useState(tray?.tray_type ?? 'standard')
  const [status, setStatus] = useState(tray?.status ?? 'complete')
  const [missingItems, setMissingItems] = useState(tray?.missing_items ?? '')
  const [notes, setNotes] = useState(tray?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Tray name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      facility_id: facilityId,
      name: name.trim(),
      set_id: setId.trim() || null,
      category,
      tray_type: trayType,
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
        {tray ? 'Edit Tray' : 'Add Tray'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tray Name</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
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
            placeholder="e.g., 4mm drill guide, calcar planer"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="sm:col-span-2">
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
          {saving ? 'Saving...' : tray ? 'Update' : 'Add Tray'}
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
