'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SurgeonMapping {
  id: string
  repsuite_name: string
  display_name: string
}

interface RepSuiteSurgeon {
  surgeon_name: string
}

export default function SurgeonMappingManager({
  mappings,
  repsuiteSurgeons,
  userRole,
}: {
  mappings: SurgeonMapping[]
  repsuiteSurgeons: RepSuiteSurgeon[]
  userRole: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [editingSurgeon, setEditingSurgeon] = useState<string | null>(null)
  const [editingDisplayName, setEditingDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Build a combined list: all RepSuite surgeons with their mapping status
  const surgeonList = useMemo(() => {
    const mappingByRepsuiteName: Record<string, SurgeonMapping> = {}
    mappings.forEach((m) => { mappingByRepsuiteName[m.repsuite_name] = m })

    return repsuiteSurgeons.map((s) => {
      const mapping = mappingByRepsuiteName[s.surgeon_name]
      const cleanName = s.surgeon_name.replace(/^\d+ - /, '')
      return {
        repsuite_name: s.surgeon_name,
        display_name: mapping?.display_name ?? cleanName,
        isMapped: !!mapping,
        mappingId: mapping?.id ?? null,
        cleanName,
      }
    })
  }, [mappings, repsuiteSurgeons])

  const filtered = useMemo(() => {
    let result = surgeonList
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) => s.display_name.toLowerCase().includes(q) || s.repsuite_name.toLowerCase().includes(q)
      )
    }
    if (filter === 'mapped') result = result.filter((s) => s.isMapped)
    if (filter === 'unmapped') result = result.filter((s) => !s.isMapped)
    return result
  }, [surgeonList, search, filter])

  const mappedCount = surgeonList.filter((s) => s.isMapped).length

  const handleSave = async (repsuiteName: string, displayName: string) => {
    setSaving(true)
    const existing = mappings.find((m) => m.repsuite_name === repsuiteName)
    if (existing) {
      await supabase
        .from('surgeon_mappings')
        .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('surgeon_mappings')
        .insert({ repsuite_name: repsuiteName, display_name: displayName.trim() })
    }
    setSaving(false)
    setEditingSurgeon(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Surgeons</span>
          <span className="text-lg font-bold text-gray-900 ml-2">{surgeonList.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Renamed</span>
          <span className="text-lg font-bold text-blue-600 ml-2">{mappedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Default</span>
          <span className="text-lg font-bold text-amber-600 ml-2">{surgeonList.length - mappedCount}</span>
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
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
            <option value="all">All ({surgeonList.length})</option>
            <option value="unmapped">Default Name ({surgeonList.length - mappedCount})</option>
            <option value="mapped">Renamed ({mappedCount})</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {filtered.length} of {surgeonList.length} surgeons
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
                <th className="text-left py-3 px-4 text-gray-600 font-medium">RepSuite Name</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Status</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((surgeon) => (
                <tr key={surgeon.repsuite_name} className="border-b border-gray-50 hover:bg-gray-50/50 group/row">
                  <td className="py-3 px-4">
                    {editingSurgeon === surgeon.repsuite_name ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(surgeon.repsuite_name, editingDisplayName)
                            if (e.key === 'Escape') setEditingSurgeon(null)
                          }}
                        />
                        <button
                          onClick={() => handleSave(surgeon.repsuite_name, editingDisplayName)}
                          disabled={saving}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSurgeon(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">{surgeon.display_name}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{surgeon.repsuite_name}</td>
                  <td className="py-3 px-4 text-center">
                    {surgeon.isMapped ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Renamed</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Default</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingSurgeon(surgeon.repsuite_name)
                          setEditingDisplayName(surgeon.display_name)
                        }}
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
                    {surgeonList.length === 0
                      ? 'No surgeons found. Sync cases first to populate this list.'
                      : 'No surgeons match your search.'}
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
