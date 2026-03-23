'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface KitMapping {
  id: string
  repsuite_name: string
  display_name: string
  category: string
}

interface RepSuiteKit {
  kit_name: string
}

export default function KitMappingManager({
  mappings,
  repsuiteKits,
  userRole,
}: {
  mappings: KitMapping[]
  repsuiteKits: RepSuiteKit[]
  userRole: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [editingKit, setEditingKit] = useState<string | null>(null)
  const [editingDisplayName, setEditingDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRepsuiteName, setNewRepsuiteName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Build combined list from both synced kit names and manual mappings
  const kitList = useMemo(() => {
    const mappingByName: Record<string, KitMapping> = {}
    mappings.forEach((m) => { mappingByName[m.repsuite_name] = m })

    // Start with kits from synced cases
    const fromCases = repsuiteKits.map((k) => {
      const mapping = mappingByName[k.kit_name]
      return {
        repsuite_name: k.kit_name,
        display_name: mapping?.display_name ?? k.kit_name,
        isMapped: !!mapping,
        mappingId: mapping?.id ?? null,
      }
    })

    // Add any mappings that aren't in synced cases (manually added)
    const caseNames = new Set(repsuiteKits.map((k) => k.kit_name))
    const manualOnly = mappings
      .filter((m) => !caseNames.has(m.repsuite_name))
      .map((m) => ({
        repsuite_name: m.repsuite_name,
        display_name: m.display_name,
        isMapped: true,
        mappingId: m.id,
      }))

    return [...fromCases, ...manualOnly]
  }, [mappings, repsuiteKits])

  const filtered = useMemo(() => {
    let result = kitList
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (k) => k.display_name.toLowerCase().includes(q) || k.repsuite_name.toLowerCase().includes(q)
      )
    }
    if (filter === 'mapped') result = result.filter((k) => k.isMapped)
    if (filter === 'unmapped') result = result.filter((k) => !k.isMapped)
    return result
  }, [kitList, search, filter])

  const mappedCount = kitList.filter((k) => k.isMapped).length

  const handleSave = async (repsuiteName: string, displayName: string) => {
    setSaving(true)
    const existing = mappings.find((m) => m.repsuite_name === repsuiteName)
    if (existing) {
      await supabase
        .from('kit_mappings')
        .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('kit_mappings')
        .insert({ repsuite_name: repsuiteName, display_name: displayName.trim() })
    }
    setSaving(false)
    setEditingKit(null)
    router.refresh()
  }

  const handleAdd = async () => {
    if (!newRepsuiteName.trim() || !newDisplayName.trim()) return
    setSaving(true)
    await supabase
      .from('kit_mappings')
      .insert({ repsuite_name: newRepsuiteName.trim(), display_name: newDisplayName.trim() })
    setSaving(false)
    setShowAddForm(false)
    setNewRepsuiteName('')
    setNewDisplayName('')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Kits</span>
            <span className="text-lg font-bold text-gray-900 ml-2">{kitList.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Renamed</span>
            <span className="text-lg font-bold text-blue-600 ml-2">{mappedCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Default</span>
            <span className="text-lg font-bold text-amber-600 ml-2">{kitList.length - mappedCount}</span>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap"
          >
            + Add Kit
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Kit Mapping</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RepSuite Name</label>
              <input
                type="text"
                value={newRepsuiteName}
                onChange={(e) => setNewRepsuiteName(e.target.value)}
                placeholder="Name as it appears in RepSuite"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Your preferred name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All ({kitList.length})</option>
            <option value="unmapped">Default Name ({kitList.length - mappedCount})</option>
            <option value="mapped">Renamed ({mappedCount})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Display Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">RepSuite Name</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Status</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((kit) => (
                <tr key={kit.repsuite_name} className="border-b border-gray-50 hover:bg-gray-50/50 group/row">
                  <td className="py-3 px-4">
                    {editingKit === kit.repsuite_name ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(kit.repsuite_name, editingDisplayName)
                            if (e.key === 'Escape') setEditingKit(null)
                          }}
                        />
                        <button onClick={() => handleSave(kit.repsuite_name, editingDisplayName)} disabled={saving} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Save</button>
                        <button onClick={() => setEditingKit(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">{kit.display_name}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{kit.repsuite_name}</td>
                  <td className="py-3 px-4 text-center">
                    {kit.isMapped ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Renamed</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Default</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => { setEditingKit(kit.repsuite_name); setEditingDisplayName(kit.display_name) }}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Rename"
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
                  <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-gray-400">
                    {kitList.length === 0 ? 'No kits found. Sync cases first or add manually.' : 'No kits match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
