'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ProductGroup {
  id: string
  catalog_name: string
  display_name: string
}

interface GroupDetail {
  gtinCount: number
  refs: string[]
}

interface CatalogItem {
  gtin: string
  reference_number: string
  description: string
  product_group_id: string | null
}

export default function ProductGroupsManager({
  productGroups,
  groupDetails,
  allCatalogItems,
  userRole,
}: {
  productGroups: ProductGroup[]
  groupDetails: Record<string, GroupDetail>
  allCatalogItems: CatalogItem[]
  userRole: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'renamed' | 'default'>('all')
  const [page, setPage] = useState(1)
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null)
  const perPage = 25

  const router = useRouter()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const filtered = useMemo(() => {
    let result = productGroups

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((pg) => {
        const detail = groupDetails[pg.id]
        return (
          pg.display_name.toLowerCase().includes(q) ||
          detail?.refs.some((r) => r.toLowerCase().includes(q))
        )
      })
    }

    if (filter === 'renamed') {
      result = result.filter((pg) => pg.display_name !== pg.catalog_name)
    } else if (filter === 'default') {
      result = result.filter((pg) => pg.display_name === pg.catalog_name)
    }

    return result
  }, [productGroups, search, filter, groupDetails])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const renamedCount = productGroups.filter((pg) => pg.display_name !== pg.catalog_name).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Total Groups</span>
          <span className="text-lg font-bold text-gray-900 ml-2">{productGroups.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Renamed</span>
          <span className="text-lg font-bold text-blue-600 ml-2">{renamedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Need Renaming</span>
          <span className="text-lg font-bold text-amber-600 ml-2">{productGroups.length - renamedCount}</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by display name or reference number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All ({productGroups.length})</option>
            <option value="default">Needs Rename ({productGroups.length - renamedCount})</option>
            <option value="renamed">Already Renamed ({renamedCount})</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {filtered.length} of {productGroups.length} groups
          {search && <span> matching &ldquo;{search}&rdquo;</span>}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Display Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref #</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">GTINs</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((pg) => {
                const details = groupDetails[pg.id]
                const isRenamed = pg.display_name !== pg.catalog_name

                return (
                  <tr key={pg.id} className="border-b border-gray-50 hover:bg-gray-50/50 group/row">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{pg.display_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {details?.refs.map((ref) => (
                          <span key={ref} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-mono text-gray-600">
                            {ref}
                          </span>
                        )) ?? '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {details?.gtinCount ?? 0}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setEditingGroup(pg)}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Edit group"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-gray-400">
                    No product groups match your search.
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

      {/* Edit Modal */}
      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          groupRefs={groupDetails[editingGroup.id]?.refs ?? []}
          allCatalogItems={allCatalogItems}
          onClose={() => setEditingGroup(null)}
          onSaved={() => { setEditingGroup(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function EditGroupModal({
  group,
  groupRefs,
  allCatalogItems,
  onClose,
  onSaved,
}: {
  group: ProductGroup
  groupRefs: string[]
  allCatalogItems: CatalogItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(group.display_name)
  const [currentRefs, setCurrentRefs] = useState<string[]>(groupRefs)
  const [refSearch, setRefSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Available refs to add (not already in this group)
  const availableRefs = useMemo(() => {
    if (!refSearch || refSearch.length < 2) return []
    const q = refSearch.toLowerCase()
    return allCatalogItems
      .filter(
        (item) =>
          !currentRefs.includes(item.reference_number) &&
          (item.reference_number.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q))
      )
      .slice(0, 15)
  }, [refSearch, allCatalogItems, currentRefs])

  const addRef = (ref: string) => {
    setCurrentRefs([...currentRefs, ref])
    setRefSearch('')
  }

  const removeRef = (ref: string) => {
    if (currentRefs.length <= 1) {
      setError('A group must have at least one reference.')
      return
    }
    setCurrentRefs(currentRefs.filter((r) => r !== ref))
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }
    setSaving(true)
    setError(null)

    // Update display name
    const { error: updateError } = await supabase
      .from('product_groups')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', group.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Find refs that were added
    const addedRefs = currentRefs.filter((r) => !groupRefs.includes(r))
    // Find refs that were removed
    const removedRefs = groupRefs.filter((r) => !currentRefs.includes(r))

    // Move added refs into this group
    for (const ref of addedRefs) {
      const { error: moveError } = await supabase
        .from('product_catalog')
        .update({ product_group_id: group.id })
        .eq('reference_number', ref)

      if (moveError) {
        setError(`Failed to add ${ref}: ${moveError.message}`)
        setSaving(false)
        return
      }
    }

    // Remove refs from this group (set to null — they become ungrouped)
    for (const ref of removedRefs) {
      const { error: removeError } = await supabase
        .from('product_catalog')
        .update({ product_group_id: null })
        .eq('reference_number', ref)

      if (removeError) {
        setError(`Failed to remove ${ref}: ${removeError.message}`)
        setSaving(false)
        return
      }
    }

    // Clean up orphaned groups (groups with no catalog entries)
    // We need to do this server-side, but for now just refresh
    setSaving(false)
    onSaved()
  }

  // Close on backdrop click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Edit Product Group</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Display Name */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Current References */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              References in this group ({currentRefs.length})
            </label>
            <div className="space-y-1.5">
              {currentRefs.map((ref) => {
                const item = allCatalogItems.find((c) => c.reference_number === ref)
                return (
                  <div key={ref} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-mono font-medium text-gray-900">{ref}</span>
                      {item && (
                        <span className="text-xs text-gray-400 block truncate">{item.description}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeRef(ref)}
                      className="text-gray-400 hover:text-red-600 p-1 ml-2 shrink-0"
                      title="Remove from group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add Reference */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Reference</label>
            <input
              type="text"
              value={refSearch}
              onChange={(e) => setRefSearch(e.target.value)}
              placeholder="Search by reference number or description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {availableRefs.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                {availableRefs.map((item) => (
                  <button
                    key={item.gtin}
                    onClick={() => addRef(item.reference_number)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-mono font-medium text-gray-900">{item.reference_number}</span>
                    <span className="text-gray-400 text-xs block truncate">{item.description}</span>
                    {item.product_group_id && item.product_group_id !== group.id && (
                      <span className="text-amber-600 text-xs">Currently in another group — will be moved</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {refSearch.length >= 2 && availableRefs.length === 0 && (
              <p className="mt-1 text-xs text-gray-400 px-1">No matching references found.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
