'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getVariantLabel, getComponentConfig, COMPONENT_LABELS } from '@/lib/plan-config'

interface VariantSize {
  id: string
  component: string
  variant: string
  sizes: string[]
  notes: string | null
}

export default function VariantSizesManager({
  variantSizes,
  userRole,
}: {
  variantSizes: VariantSize[]
  userRole: string
}) {
  const [search, setSearch] = useState('')
  const [filterComponent, setFilterComponent] = useState<string>('all')
  const [drawerItem, setDrawerItem] = useState<VariantSize | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Form state
  const [formComponent, setFormComponent] = useState('')
  const [formVariant, setFormVariant] = useState('')
  const [formSizes, setFormSizes] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const allComponents = [
    ...getComponentConfig('knee').map((c) => c.key),
    ...getComponentConfig('hip').map((c) => c.key),
  ].filter((v, i, a) => a.indexOf(v) === i)

  const filtered = useMemo(() => {
    let result = variantSizes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (v) => v.component.toLowerCase().includes(q) ||
          v.variant.toLowerCase().includes(q) ||
          getVariantLabel(v.variant).toLowerCase().includes(q)
      )
    }
    if (filterComponent !== 'all') {
      result = result.filter((v) => v.component === filterComponent)
    }
    return result.sort((a, b) => {
      if (a.component !== b.component) return a.component.localeCompare(b.component)
      return a.variant.localeCompare(b.variant)
    })
  }, [variantSizes, search, filterComponent])

  const definedCount = variantSizes.length
  const components = [...new Set(variantSizes.map((v) => v.component))].sort()

  const openDrawer = (item: VariantSize | 'new') => {
    if (item === 'new') {
      setFormComponent('')
      setFormVariant('')
      setFormSizes('')
      setFormNotes('')
    } else {
      setFormComponent(item.component)
      setFormVariant(item.variant)
      setFormSizes(item.sizes.join(', '))
      setFormNotes(item.notes ?? '')
    }
    setDrawerItem(item)
  }

  const handleSave = async () => {
    if (!formComponent || !formVariant || !formSizes.trim()) return
    setSaving(true)

    const sizes = formSizes.split(',').map((s) => s.trim()).filter(Boolean)
    const data = {
      component: formComponent,
      variant: formVariant,
      sizes,
      notes: formNotes || null,
      updated_at: new Date().toISOString(),
    }

    if (drawerItem === 'new') {
      await supabase.from('variant_sizes').insert(data)
    } else if (drawerItem) {
      await supabase.from('variant_sizes').update(data).eq('id', drawerItem.id)
    }

    setSaving(false)
    setDrawerItem(null)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('variant_sizes').delete().eq('id', id)
    setDrawerItem(null)
    router.refresh()
  }

  // Get variant options for selected component in form
  const allConfig = [...getComponentConfig('knee'), ...getComponentConfig('hip')]
  const formVariantOptions = allConfig.find((c) => c.key === formComponent)?.options ?? []

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Defined</span>
            <span className="text-lg font-bold text-gray-900 ml-2">{definedCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Components</span>
            <span className="text-lg font-bold text-blue-600 ml-2">{components.length}</span>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => openDrawer('new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Add Variant
          </button>
        )}
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
              placeholder="Search variants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterComponent}
            onChange={(e) => setFilterComponent(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All Components</option>
            {allComponents.map((c) => (
              <option key={c} value={c}>{COMPONENT_LABELS[c] ?? c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Component</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Variant</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Sizes (1 complete set)</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Count</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((vs) => (
                <tr
                  key={vs.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 group/row ${canEdit ? 'cursor-pointer' : ''}`}
                  onClick={canEdit ? () => openDrawer(vs) : undefined}
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{COMPONENT_LABELS[vs.component] ?? vs.component}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700">{getVariantLabel(vs.variant)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {vs.sizes.map((size) => (
                        <span key={size} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                          {size}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-xs font-medium text-gray-500">{vs.sizes.length}</span>
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDrawer(vs) }}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
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
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-gray-400">
                    {variantSizes.length === 0 ? 'No variant sizes defined yet.' : 'No variants match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {drawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerItem(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                {drawerItem === 'new' ? 'Add Variant Sizes' : 'Edit Variant Sizes'}
              </h3>
              <button onClick={() => setDrawerItem(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Component</label>
                <select
                  value={formComponent}
                  onChange={(e) => { setFormComponent(e.target.value); setFormVariant('') }}
                  disabled={drawerItem !== 'new'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                >
                  <option value="">Select component...</option>
                  {allComponents.map((c) => (
                    <option key={c} value={c}>{COMPONENT_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Variant</label>
                <select
                  value={formVariant}
                  onChange={(e) => setFormVariant(e.target.value)}
                  disabled={drawerItem !== 'new' || !formComponent}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                >
                  <option value="">Select variant...</option>
                  {formVariantOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Sizes
                  <span className="text-gray-400 font-normal ml-1">— comma-separated, defines 1 complete set</span>
                </label>
                <textarea
                  value={formSizes}
                  onChange={(e) => setFormSizes(e.target.value)}
                  placeholder="e.g., 1, 2, 3, 4, 5, 6, 7, 8"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                />
                {formSizes && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {formSizes.split(',').map((s) => s.trim()).filter(Boolean).length} sizes = 1 complete set
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !formComponent || !formVariant || !formSizes.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {drawerItem !== 'new' && (
                  <button
                    onClick={() => handleDelete(drawerItem.id)}
                    className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setDrawerItem(null)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
