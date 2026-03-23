'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface KitName {
  repsuite_name: string
  display_name: string
}

interface BaseRequirement {
  id: string
  procedure_name: string
  kit_template_name: string
  is_required: boolean
}

interface SurgeonOverride {
  id: string
  surgeon_name: string
  procedure_name: string
  kit_template_name: string
  action: string // 'add' or 'remove'
}

interface Surgeon {
  repsuite_name: string
  display_name: string
}

export default function ProcedureKitsManager({
  procedures,
  kitNames,
  baseRequirements,
  surgeonOverrides,
  surgeons,
  userRole,
}: {
  procedures: string[]
  kitNames: KitName[]
  baseRequirements: BaseRequirement[]
  surgeonOverrides: SurgeonOverride[]
  surgeons: Surgeon[]
  userRole: string
}) {
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Base kits for selected procedure
  const baseKits = useMemo(() => {
    if (!selectedProcedure) return []
    return baseRequirements.filter((r) => r.procedure_name === selectedProcedure)
  }, [baseRequirements, selectedProcedure])

  // Surgeon overrides for selected procedure + surgeon
  const overrides = useMemo(() => {
    if (!selectedProcedure || !selectedSurgeon) return []
    return surgeonOverrides.filter(
      (o) => o.procedure_name === selectedProcedure && o.surgeon_name === selectedSurgeon
    )
  }, [surgeonOverrides, selectedProcedure, selectedSurgeon])

  // Effective kit list for selected surgeon
  const effectiveKits = useMemo(() => {
    const base = new Set(baseKits.map((k) => k.kit_template_name))
    if (selectedSurgeon) {
      overrides.forEach((o) => {
        if (o.action === 'add') base.add(o.kit_template_name)
        if (o.action === 'remove') base.delete(o.kit_template_name)
      })
    }
    return base
  }, [baseKits, overrides, selectedSurgeon])

  // Available kits to add
  const availableKits = kitNames.filter((k) => !effectiveKits.has(k.repsuite_name))

  // Counts
  const baseCount = (proc: string) => baseRequirements.filter((r) => r.procedure_name === proc).length
  const overrideCount = (proc: string) => surgeonOverrides.filter((o) => o.procedure_name === proc).length

  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch) return surgeons
    const q = surgeonSearch.toLowerCase()
    return surgeons.filter((s) => s.display_name.toLowerCase().includes(q))
  }, [surgeons, surgeonSearch])

  const addBaseKit = async (kitName: string) => {
    if (!selectedProcedure) return
    await supabase.from('procedure_kit_requirements').insert({
      procedure_name: selectedProcedure,
      kit_template_name: kitName,
    })
    router.refresh()
  }

  const removeBaseKit = async (id: string) => {
    await supabase.from('procedure_kit_requirements').delete().eq('id', id)
    router.refresh()
  }

  const addSurgeonOverride = async (kitName: string, action: string) => {
    if (!selectedProcedure || !selectedSurgeon) return
    await supabase.from('surgeon_kit_overrides').insert({
      surgeon_name: selectedSurgeon,
      procedure_name: selectedProcedure,
      kit_template_name: kitName,
      action,
    })
    router.refresh()
  }

  const removeOverride = async (id: string) => {
    await supabase.from('surgeon_kit_overrides').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[500px]">
      {/* Column 1: Procedures */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/50">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Procedure</span>
        </div>
        <nav className="py-1">
          {procedures.map((proc) => {
            const isActive = selectedProcedure === proc
            const count = baseCount(proc)
            return (
              <button
                key={proc}
                onClick={() => { setSelectedProcedure(proc); setSelectedSurgeon(null) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{proc}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                    }`}>{count}</span>
                  )}
                  <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
          {procedures.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">No procedures found. Sync cases first.</p>
          )}
        </nav>
      </div>

      {/* Column 2: Kit Configuration */}
      {selectedProcedure ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
            <span className="text-sm font-semibold text-gray-900">{selectedProcedure}</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Base kits */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Base Kits</span>
                <span className="text-xs text-gray-400">{baseKits.length} required</span>
              </div>
              <div className="p-4">
                {baseKits.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {baseKits.map((req) => {
                      const display = kitNames.find((k) => k.repsuite_name === req.kit_template_name)?.display_name ?? req.kit_template_name
                      return (
                        <div key={req.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-900">{display}</span>
                          {canEdit && (
                            <button onClick={() => removeBaseKit(req.id)} className="text-gray-400 hover:text-red-600 p-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">No base kits defined for this procedure.</p>
                )}

                {canEdit && availableKits.length > 0 && !selectedSurgeon && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                    {kitNames.filter((k) => !baseKits.some((b) => b.kit_template_name === k.repsuite_name)).map((k) => (
                      <button
                        key={k.repsuite_name}
                        onClick={() => addBaseKit(k.repsuite_name)}
                        className="px-2 py-1 text-xs border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        + {k.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Surgeon overrides */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-900">Surgeon Overrides</span>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search surgeon..."
                    value={surgeonSearch}
                    onChange={(e) => setSurgeonSearch(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto mb-3">
                  {filteredSurgeons.map((s) => {
                    const hasOverrides = surgeonOverrides.some(
                      (o) => o.surgeon_name === s.repsuite_name && o.procedure_name === selectedProcedure
                    )
                    return (
                      <button
                        key={s.repsuite_name}
                        onClick={() => setSelectedSurgeon(s.repsuite_name === selectedSurgeon ? null : s.repsuite_name)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                          s.repsuite_name === selectedSurgeon
                            ? 'bg-blue-600 text-white'
                            : hasOverrides
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {s.display_name}
                      </button>
                    )
                  })}
                </div>

                {selectedSurgeon && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      {surgeons.find((s) => s.repsuite_name === selectedSurgeon)?.display_name}&apos;s overrides for {selectedProcedure}:
                    </p>

                    {/* Show effective kit list */}
                    <div className="space-y-1 mb-3">
                      {Array.from(effectiveKits).map((kitName) => {
                        const display = kitNames.find((k) => k.repsuite_name === kitName)?.display_name ?? kitName
                        const isBase = baseKits.some((b) => b.kit_template_name === kitName)
                        const isAdded = overrides.some((o) => o.kit_template_name === kitName && o.action === 'add')
                        const overrideId = overrides.find((o) => o.kit_template_name === kitName)?.id

                        return (
                          <div key={kitName} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">{display}</span>
                              {isAdded && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Added</span>}
                              {isBase && !isAdded && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Base</span>}
                            </div>
                            {canEdit && (
                              <div className="flex gap-1">
                                {isBase && !isAdded && (
                                  <button
                                    onClick={() => addSurgeonOverride(kitName, 'remove')}
                                    className="text-xs text-red-500 hover:text-red-700"
                                  >
                                    Remove for surgeon
                                  </button>
                                )}
                                {isAdded && overrideId && (
                                  <button onClick={() => removeOverride(overrideId)} className="text-gray-400 hover:text-red-600 p-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Show removed base kits */}
                      {overrides.filter((o) => o.action === 'remove').map((o) => {
                        const display = kitNames.find((k) => k.repsuite_name === o.kit_template_name)?.display_name ?? o.kit_template_name
                        return (
                          <div key={o.id} className="flex items-center justify-between p-2 bg-red-50/50 rounded-lg opacity-60">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500 line-through">{display}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Removed</span>
                            </div>
                            {canEdit && (
                              <button onClick={() => removeOverride(o.id)} className="text-xs text-blue-500 hover:text-blue-700">Restore</button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Add kit for this surgeon */}
                    {canEdit && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                        {kitNames.filter((k) => !effectiveKits.has(k.repsuite_name)).map((k) => (
                          <button
                            key={k.repsuite_name}
                            onClick={() => addSurgeonOverride(k.repsuite_name, 'add')}
                            className="px-2 py-1 text-xs border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            + {k.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          Select a procedure
        </div>
      )}
    </div>
  )
}
