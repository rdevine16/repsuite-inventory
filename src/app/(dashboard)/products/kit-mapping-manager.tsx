'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { KNEE_PLAN_OPTIONS, HIP_PLAN_OPTIONS, getVariantLabel } from '@/lib/plan-config'

interface KitMapping {
  id: string
  repsuite_name: string
  display_name: string
  category: string
}

interface RepSuiteKit {
  kit_name: string
}

interface KitVariantMapping {
  id: string
  set_name: string
  component: string | null
  variant: string | null
  side: string | null
  tub_group: string | null
  tubs_in_group: number
  is_implant: boolean
  notes: string | null
}

const COMPONENT_OPTIONS = [
  { id: 'femur', label: 'Femur', variants: KNEE_PLAN_OPTIONS.femur },
  { id: 'tibia', label: 'Tibia', variants: KNEE_PLAN_OPTIONS.tibia },
  { id: 'patella', label: 'Patella', variants: KNEE_PLAN_OPTIONS.patella },
  { id: 'poly', label: 'Poly', variants: KNEE_PLAN_OPTIONS.poly },
  { id: 'stem', label: 'Stem', variants: HIP_PLAN_OPTIONS.stem },
  { id: 'cup', label: 'Cup', variants: HIP_PLAN_OPTIONS.cup },
  { id: 'liner', label: 'Liner', variants: HIP_PLAN_OPTIONS.liner },
  { id: 'head', label: 'Head', variants: HIP_PLAN_OPTIONS.head },
]

const SIDE_OPTIONS = [
  { id: '', label: 'Not side-specific' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

export default function KitMappingManager({
  mappings,
  repsuiteKits,
  variantMappings,
  userRole,
}: {
  mappings: KitMapping[]
  repsuiteKits: RepSuiteKit[]
  variantMappings: KitVariantMapping[]
  userRole: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'implant' | 'instrument' | 'unmapped'>('all')
  const [drawerKit, setDrawerKit] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Drawer form state
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formIsImplant, setFormIsImplant] = useState(true)
  const [formComponent, setFormComponent] = useState('')
  const [formVariant, setFormVariant] = useState('')
  const [formSide, setFormSide] = useState('')
  const [formTubGroup, setFormTubGroup] = useState('')
  const [formTubsInGroup, setFormTubsInGroup] = useState(1)
  const [formNotes, setFormNotes] = useState('')

  // Build variant mapping lookup
  const variantMap = useMemo(() => {
    const map: Record<string, KitVariantMapping> = {}
    variantMappings.forEach((v) => { map[v.set_name] = v })
    return map
  }, [variantMappings])

  // Build combined kit list
  const kitList = useMemo(() => {
    const mappingByName: Record<string, KitMapping> = {}
    mappings.forEach((m) => { mappingByName[m.repsuite_name] = m })

    const fromCases = repsuiteKits.map((k) => {
      const mapping = mappingByName[k.kit_name]
      const vm = variantMap[k.kit_name]
      return {
        repsuite_name: k.kit_name,
        display_name: mapping?.display_name ?? k.kit_name,
        isRenamed: !!mapping,
        mappingId: mapping?.id ?? null,
        variantMapping: vm ?? null,
      }
    })

    const caseNames = new Set(repsuiteKits.map((k) => k.kit_name))
    const manualOnly = mappings
      .filter((m) => !caseNames.has(m.repsuite_name))
      .map((m) => ({
        repsuite_name: m.repsuite_name,
        display_name: m.display_name,
        isRenamed: true,
        mappingId: m.id,
        variantMapping: variantMap[m.repsuite_name] ?? null,
      }))

    return [...fromCases, ...manualOnly]
  }, [mappings, repsuiteKits, variantMap])

  const filtered = useMemo(() => {
    let result = kitList
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (k) => k.display_name.toLowerCase().includes(q) || k.repsuite_name.toLowerCase().includes(q)
      )
    }
    if (filter === 'implant') result = result.filter((k) => k.variantMapping?.is_implant === true)
    if (filter === 'instrument') result = result.filter((k) => k.variantMapping?.is_implant === false)
    if (filter === 'unmapped') result = result.filter((k) => !k.variantMapping)
    return result
  }, [kitList, search, filter])

  const implantCount = kitList.filter((k) => k.variantMapping?.is_implant === true).length
  const instrumentCount = kitList.filter((k) => k.variantMapping?.is_implant === false).length
  const unmappedCount = kitList.filter((k) => !k.variantMapping).length

  // Existing tub groups for autocomplete
  const existingGroups = useMemo(() => {
    const groups = new Set<string>()
    variantMappings.forEach((v) => { if (v.tub_group) groups.add(v.tub_group) })
    return Array.from(groups).sort()
  }, [variantMappings])

  // Open drawer
  const openDrawer = (kitName: string) => {
    const vm = variantMap[kitName]
    const km = mappings.find((m) => m.repsuite_name === kitName)
    setFormDisplayName(km?.display_name ?? kitName)
    setFormIsImplant(vm?.is_implant ?? true)
    setFormComponent(vm?.component ?? '')
    setFormVariant(vm?.variant ?? '')
    setFormSide(vm?.side ?? '')
    setFormTubGroup(vm?.tub_group ?? '')
    setFormTubsInGroup(vm?.tubs_in_group ?? 1)
    setFormNotes(vm?.notes ?? '')
    setDrawerKit(kitName)
  }

  // Save
  const handleSave = async () => {
    if (!drawerKit) return
    setSaving(true)

    // Save display name
    const existingMapping = mappings.find((m) => m.repsuite_name === drawerKit)
    if (formDisplayName !== drawerKit) {
      if (existingMapping) {
        await supabase.from('kit_mappings')
          .update({ display_name: formDisplayName.trim(), updated_at: new Date().toISOString() })
          .eq('id', existingMapping.id)
      } else {
        await supabase.from('kit_mappings')
          .insert({ repsuite_name: drawerKit, display_name: formDisplayName.trim() })
      }
    }

    // Save variant mapping
    const existingVariant = variantMap[drawerKit]
    const variantData = {
      set_name: drawerKit,
      component: formIsImplant ? (formComponent || null) : null,
      variant: formIsImplant ? (formVariant || null) : null,
      side: formIsImplant && formComponent === 'femur' ? (formSide || null) : null,
      tub_group: formIsImplant ? (formTubGroup || null) : null,
      tubs_in_group: formIsImplant && formTubGroup ? formTubsInGroup : 1,
      is_implant: formIsImplant,
      notes: formNotes || null,
      updated_at: new Date().toISOString(),
    }

    if (existingVariant) {
      await supabase.from('kit_variant_mappings')
        .update(variantData)
        .eq('id', existingVariant.id)
    } else {
      await supabase.from('kit_variant_mappings').insert(variantData)
    }

    setSaving(false)
    setDrawerKit(null)
    router.refresh()
  }

  // Get variant options for selected component
  const variantOptions = COMPONENT_OPTIONS.find((c) => c.id === formComponent)?.variants ?? []

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900 ml-2">{kitList.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Implants</span>
            <span className="text-lg font-bold text-blue-600 ml-2">{implantCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Instruments</span>
            <span className="text-lg font-bold text-gray-600 ml-2">{instrumentCount}</span>
          </div>
          {unmappedCount > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 px-5 py-3">
              <span className="text-sm text-amber-500">Unmapped</span>
              <span className="text-lg font-bold text-amber-600 ml-2">{unmappedCount}</span>
            </div>
          )}
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
              placeholder="Search kits..."
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
            <option value="implant">Implants ({implantCount})</option>
            <option value="instrument">Instruments ({instrumentCount})</option>
            <option value="unmapped">Unmapped ({unmappedCount})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Kit Name</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Mapping</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Group</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Type</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((kit) => {
                const vm = kit.variantMapping
                return (
                  <tr
                    key={kit.repsuite_name}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 group/row ${canEdit ? 'cursor-pointer' : ''}`}
                    onClick={canEdit ? () => openDrawer(kit.repsuite_name) : undefined}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-gray-900">{kit.display_name}</span>
                        {kit.isRenamed && kit.display_name !== kit.repsuite_name && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{kit.repsuite_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {vm && vm.is_implant && vm.component ? (
                        <div className="flex items-center gap-1.5">
                          {vm.side && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                              {vm.side === 'left' ? 'L' : 'R'}
                            </span>
                          )}
                          <span className="text-xs text-gray-700">
                            {getVariantLabel(vm.variant ?? '')} {vm.component.charAt(0).toUpperCase() + vm.component.slice(1)}
                          </span>
                        </div>
                      ) : vm && !vm.is_implant ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <span className="text-xs text-amber-500">Not mapped</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {vm?.tub_group ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                          {vm.tub_group} ({vm.tubs_in_group} tubs)
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {vm ? (
                        vm.is_implant ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Implant</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Instrument</span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">Unmapped</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDrawer(kit.repsuite_name) }}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-gray-400">
                    {kitList.length === 0 ? 'No kits found. Sync cases first.' : 'No kits match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Drawer */}
      {drawerKit && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerKit(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">Kit Mapping</h3>
              <button onClick={() => setDrawerKit(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* RepSuite name (read-only) */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">RepSuite Name</label>
                <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  {drawerKit}
                </div>
              </div>

              {/* Display name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Type toggle */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Kit Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormIsImplant(true)}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                      formIsImplant
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Implant Tub
                  </button>
                  <button
                    onClick={() => setFormIsImplant(false)}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                      !formIsImplant
                        ? 'bg-gray-100 border-gray-300 text-gray-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Instrument / Trial
                  </button>
                </div>
              </div>

              {/* Implant mapping fields */}
              {formIsImplant && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Component</label>
                    <select
                      value={formComponent}
                      onChange={(e) => { setFormComponent(e.target.value); setFormVariant('') }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select component...</option>
                      {COMPONENT_OPTIONS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {formComponent && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Variant</label>
                      <select
                        value={formVariant}
                        onChange={(e) => setFormVariant(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select variant...</option>
                        {variantOptions.map((v) => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formComponent === 'femur' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Side</label>
                      <div className="flex gap-2">
                        {SIDE_OPTIONS.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setFormSide(s.id)}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                              formSide === s.id
                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tub group */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Tub Group
                      <span className="text-gray-400 font-normal ml-1">— for tubs that pair together as 1 set</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formTubGroup}
                        onChange={(e) => setFormTubGroup(e.target.value)}
                        placeholder="e.g., cs_poly"
                        list="tub-groups"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <datalist id="tub-groups">
                        {existingGroups.map((g) => <option key={g} value={g} />)}
                      </datalist>
                      {formTubGroup && (
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Tubs in group:</label>
                          <input
                            type="number"
                            value={formTubsInGroup}
                            onChange={(e) => setFormTubsInGroup(parseInt(e.target.value) || 1)}
                            min={1}
                            max={10}
                            className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                    {formTubGroup && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formTubsInGroup} tub{formTubsInGroup !== 1 ? 's' : ''} in group &ldquo;{formTubGroup}&rdquo; = 1 complete set
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Summary */}
              {formIsImplant && formComponent && formVariant && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-blue-700">Mapping Summary</div>
                  <div className="text-sm text-blue-900 mt-1">
                    This tub satisfies: <span className="font-semibold">
                      {formSide ? `${formSide === 'left' ? 'Left' : 'Right'} ` : ''}
                      {getVariantLabel(formVariant)} {formComponent.charAt(0).toUpperCase() + formComponent.slice(1)}
                    </span>
                    {formTubGroup && (
                      <span className="text-blue-600"> (part of {formTubsInGroup}-tub group &ldquo;{formTubGroup}&rdquo;)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Saving...' : 'Save Mapping'}
                </button>
                <button
                  onClick={() => setDrawerKit(null)}
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
