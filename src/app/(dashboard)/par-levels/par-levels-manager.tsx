'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ParLevel {
  id: string
  facility_id: string
  product_group_id: string | null
  gtin: string | null
  min_quantity: number
  max_quantity: number | null
  product_groups: { catalog_name: string; display_name: string } | { catalog_name: string; display_name: string }[] | null
  facilities: { name: string } | { name: string }[] | null
}

interface ProductGroup {
  id: string
  catalog_name: string
  display_name: string
}

interface Facility {
  id: string
  name: string
}

function unwrap<T>(val: T | T[] | null): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

export default function ParLevelsManager({
  parLevels,
  facilities,
  productGroups,
  currentCounts,
  userRole,
}: {
  parLevels: ParLevel[]
  facilities: Facility[]
  productGroups: ProductGroup[]
  currentCounts: Record<string, Record<string, number>>
  userRole: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [facilityId, setFacilityId] = useState('')
  const [productGroupId, setProductGroupId] = useState('')
  const [minQty, setMinQty] = useState(1)
  const [maxQty, setMaxQty] = useState<number | ''>('')
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'ok'>('all')

  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const filteredProductGroups = productGroups.filter(
    (pg) =>
      pg.display_name.toLowerCase().includes(productSearch.toLowerCase()) ||
      pg.catalog_name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 20)

  const getStatus = (pl: ParLevel) => {
    const groupId = pl.product_group_id
    if (!groupId) return 'ok'
    const current = currentCounts[pl.facility_id]?.[groupId] ?? 0
    if (current < pl.min_quantity) return 'below'
    if (pl.max_quantity && current > pl.max_quantity) return 'over'
    return 'ok'
  }

  const filteredParLevels = parLevels.filter((pl) => {
    if (filterFacility !== 'all' && pl.facility_id !== filterFacility) return false
    if (filterStatus === 'below' && getStatus(pl) !== 'below') return false
    if (filterStatus === 'ok' && getStatus(pl) === 'below') return false
    return true
  })

  const handleSave = async () => {
    if (!facilityId || !productGroupId) {
      setError('Please select a facility and product group.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      facility_id: facilityId,
      product_group_id: productGroupId,
      min_quantity: minQty,
      max_quantity: maxQty === '' ? null : maxQty,
      updated_at: new Date().toISOString(),
    }

    let result
    if (editingId) {
      result = await supabase.from('par_levels').update(payload).eq('id', editingId)
    } else {
      result = await supabase.from('par_levels').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
    } else {
      resetForm()
      router.refresh()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this par level?')) return
    await supabase.from('par_levels').delete().eq('id', id)
    router.refresh()
  }

  const startEdit = (pl: ParLevel) => {
    setEditingId(pl.id)
    setFacilityId(pl.facility_id)
    setProductGroupId(pl.product_group_id ?? '')
    setMinQty(pl.min_quantity)
    setMaxQty(pl.max_quantity ?? '')
    setShowForm(true)
    setProductSearch('')
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFacilityId('')
    setProductGroupId('')
    setMinQty(1)
    setMaxQty('')
    setProductSearch('')
    setSaving(false)
    setError(null)
  }

  const selectedGroup = productGroups.find((pg) => pg.id === productGroupId)

  return (
    <div className="space-y-4">
      {/* Filters + Add button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <select
            value={filterFacility}
            onChange={(e) => setFilterFacility(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All Facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'below' | 'ok')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="below">Below Par</option>
            <option value="ok">At/Above Par</option>
          </select>
        </div>

        {canEdit && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Set Par Level
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Par Level' : 'Set New Par Level'}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Select facility...</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Group</label>
              {selectedGroup ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 block truncate">
                      {selectedGroup.display_name}
                    </span>
                    {selectedGroup.display_name !== selectedGroup.catalog_name && (
                      <span className="text-xs text-gray-400 block truncate">
                        Catalog: {selectedGroup.catalog_name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setProductGroupId('')}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border rounded shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Search product groups..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {productSearch && (
                    <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                      {filteredProductGroups.map((pg) => (
                        <button
                          key={pg.id}
                          onClick={() => { setProductGroupId(pg.id); setProductSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-900">{pg.display_name}</span>
                          {pg.display_name !== pg.catalog_name && (
                            <span className="text-gray-400 text-xs block">Catalog: {pg.catalog_name}</span>
                          )}
                        </button>
                      ))}
                      {filteredProductGroups.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">No product groups found.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Quantity</label>
              <input
                type="number"
                min={0}
                value={minQty}
                onChange={(e) => setMinQty(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Quantity (optional)</label>
              <input
                type="number"
                min={0}
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Par Levels Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Product Group</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Facility</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Current</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Min</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Max</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Status</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredParLevels.map((pl) => {
                const group = unwrap(pl.product_groups)
                const facility = unwrap(pl.facilities)
                const groupId = pl.product_group_id
                const current = groupId ? (currentCounts[pl.facility_id]?.[groupId] ?? 0) : 0
                const status = getStatus(pl)
                return (
                  <tr key={pl.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="font-medium text-gray-900 block truncate">
                        {group?.display_name ?? '—'}
                      </span>
                      {group && group.display_name !== group.catalog_name && (
                        <span className="text-xs text-gray-400 block truncate">
                          {group.catalog_name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{facility?.name ?? '—'}</td>
                    <td className="py-2.5 px-4 text-center font-semibold text-gray-900">{current}</td>
                    <td className="py-2.5 px-4 text-center text-gray-600">{pl.min_quantity}</td>
                    <td className="py-2.5 px-4 text-center text-gray-600">{pl.max_quantity ?? '—'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'below'
                          ? 'bg-red-100 text-red-700'
                          : status === 'over'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {status === 'below' ? 'Below Par' : status === 'over' ? 'Over Max' : 'OK'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => startEdit(pl)}
                          className="text-blue-600 hover:text-blue-700 text-xs mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pl.id)}
                          className="text-red-600 hover:text-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filteredParLevels.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-gray-400">
                    {parLevels.length === 0
                      ? 'No par levels set yet. Click "+ Set Par Level" to get started.'
                      : 'No par levels match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!canEdit && (
        <p className="text-sm text-gray-400 text-center">
          You have viewer access. Contact an admin to modify par levels.
        </p>
      )}
    </div>
  )
}
