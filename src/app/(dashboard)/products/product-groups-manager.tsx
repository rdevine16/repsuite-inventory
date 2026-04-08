'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'
import { useConfirm } from '@/components/confirm-modal'

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

const PAGE_SIZE = 25

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
  const [currentPage, setCurrentPage] = useState(1)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const router = useRouter()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Reset local deletions when server data changes (after router.refresh())
  useEffect(() => { setDeletedIds(new Set()) }, [productGroups])

  // Filter out locally-deleted groups so UI updates immediately
  const groups = useMemo(() => productGroups.filter((pg) => !deletedIds.has(pg.id)), [productGroups, deletedIds])

  const filtered = useMemo(() => {
    let result = groups

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
  }, [groups, search, filter, groupDetails])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const renamedCount = groups.filter((pg) => pg.display_name !== pg.catalog_name).length

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [search, filter])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map((pg) => pg.id)))
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    const confirmed = await confirm({
      title: `Delete ${count} ${count === 1 ? 'group' : 'groups'}?`,
      message: `This will permanently remove ${count} product ${count === 1 ? 'group' : 'groups'}. References will become ungrouped. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    const ids = Array.from(selectedIds)

    // Ungroup all catalog items in these groups first
    for (const id of ids) {
      const { error: ungroupErr } = await supabase
        .from('product_catalog')
        .update({ product_group_id: null })
        .eq('product_group_id', id)
      if (ungroupErr) {
        toast(`Failed to ungroup references: ${ungroupErr.message}`, 'error')
        return
      }
    }

    const { error, data } = await supabase
      .from('product_groups')
      .delete()
      .in('id', ids)
      .select()

    if (error) {
      toast(error.message, 'error')
    } else if (!data || data.length === 0) {
      toast('Delete failed — you may not have permission to delete groups.', 'error')
    } else {
      toast(`Deleted ${data.length} ${data.length === 1 ? 'group' : 'groups'}`, 'success')
      setDeletedIds((prev) => new Set([...prev, ...data.map((d: { id: string }) => d.id)]))
      setSelectedIds(new Set())
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Total Groups</span>
          <span className="text-lg font-bold text-gray-900 ml-2">{groups.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Renamed</span>
          <span className="text-lg font-bold text-blue-600 ml-2">{renamedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Need Renaming</span>
          <span className="text-lg font-bold text-amber-600 ml-2">{groups.length - renamedCount}</span>
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
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All ({groups.length})</option>
            <option value="default">Needs Rename ({groups.length - renamedCount})</option>
            <option value="renamed">Already Renamed ({renamedCount})</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {filtered.length} of {groups.length} groups
          {search && <span> matching &ldquo;{search}&rdquo;</span>}
        </p>
      </div>

      {/* Slide-out Drawer */}
      <EditGroupDrawer
        open={showDrawer}
        group={editingGroup}
        groupRefs={editingGroup ? (groupDetails[editingGroup.id]?.refs ?? []) : []}
        allCatalogItems={allCatalogItems}
        onClose={() => { setShowDrawer(false); setEditingGroup(null) }}
        onSaved={() => { setShowDrawer(false); setEditingGroup(null); router.refresh() }}
        onDeleted={(id) => {
          setDeletedIds((prev) => new Set([...prev, id]))
          setShowDrawer(false)
          setEditingGroup(null)
          router.refresh()
        }}
      />

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && canEdit && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-white"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {canEdit && (
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && selectedIds.size === paginated.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Display Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref #</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">GTINs</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((pg) => {
                const details = groupDetails[pg.id]

                return (
                  <tr key={pg.id} className={`border-b border-gray-50 hover:bg-gray-50/50 group/row ${selectedIds.has(pg.id) ? 'bg-blue-50/50' : ''}`}>
                    {canEdit && (
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(pg.id)}
                          onChange={() => toggleSelect(pg.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
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
                          onClick={() => { setEditingGroup(pg); setShowDrawer(true) }}
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
                  <td colSpan={canEdit ? 5 : 3} className="py-8 text-center text-gray-400">
                    No product groups match your search.
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
                {'«'}
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
              >
                {'‹'}
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
                {'›'}
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
              >
                {'»'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditGroupDrawer({
  open,
  group,
  groupRefs,
  allCatalogItems,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  group: ProductGroup | null
  groupRefs: string[]
  allCatalogItems: CatalogItem[]
  onClose: () => void
  onSaved: () => void
  onDeleted: (id: string) => void
}) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {open && group && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Product Group</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <EditGroupFormContent
                group={group}
                groupRefs={groupRefs}
                allCatalogItems={allCatalogItems}
                onClose={onClose}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function EditGroupFormContent({
  group,
  groupRefs,
  allCatalogItems,
  onClose,
  onSaved,
  onDeleted,
}: {
  group: ProductGroup
  groupRefs: string[]
  allCatalogItems: CatalogItem[]
  onClose: () => void
  onSaved: () => void
  onDeleted: (id: string) => void
}) {
  const [displayName, setDisplayName] = useState(group.display_name)
  const [currentRefs, setCurrentRefs] = useState<string[]>(groupRefs)
  const [refSearch, setRefSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const { toast } = useToast()
  const { confirm: confirmDialog } = useConfirm()

  // Reset form when group changes
  useEffect(() => {
    setDisplayName(group.display_name)
    setCurrentRefs(groupRefs)
    setRefSearch('')
    setError(null)
  }, [group.id, group.display_name, groupRefs])

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

    setSaving(false)
    toast('Group updated successfully', 'success')
    onSaved()
  }

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: `Delete ${group.display_name}?`,
      message: 'This will permanently remove this group. All references will become ungrouped.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return
    setSaving(true)

    // Ungroup all refs first
    const { error: ungroupErr } = await supabase
      .from('product_catalog')
      .update({ product_group_id: null })
      .eq('product_group_id', group.id)

    if (ungroupErr) {
      setError(`Failed to ungroup references: ${ungroupErr.message}`)
      setSaving(false)
      return
    }

    const { error: delError, data } = await supabase
      .from('product_groups')
      .delete()
      .eq('id', group.id)
      .select()

    if (delError) {
      setError(delError.message)
      setSaving(false)
    } else if (!data || data.length === 0) {
      setError('Delete failed — you may not have permission to delete groups.')
      setSaving(false)
    } else {
      toast('Group deleted', 'success')
      onDeleted(group.id)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Current References */}
      <div>
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
      <div>
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
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium ml-auto disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
