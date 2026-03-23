'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PROCEDURE_TYPES, COMPONENTS } from '@/lib/preference-config'

interface Surgeon {
  repsuite_name: string
  display_name: string
}

interface Preference {
  id: string
  surgeon_name: string
  procedure_type: string
  component: string
  priority: number
  variant: string
}

export default function SurgeonPreferencesManager({
  surgeons,
  preferences,
  userRole,
}: {
  surgeons: Surgeon[]
  preferences: Preference[]
  userRole: string
}) {
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState<string>('knee')
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const configuredSet = useMemo(() => {
    return new Set(preferences.map((p) => p.surgeon_name))
  }, [preferences])

  const components = COMPONENTS[selectedProcedure] ?? []

  // Filter surgeons
  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch) return surgeons
    const q = surgeonSearch.toLowerCase()
    return surgeons.filter((s) => s.display_name.toLowerCase().includes(q))
  }, [surgeons, surgeonSearch])

  // Get preferences for selected surgeon + procedure
  const surgeonPrefs = useMemo(() => {
    if (!selectedSurgeon) return {}
    const map: Record<string, Preference[]> = {}
    preferences
      .filter((p) => p.surgeon_name === selectedSurgeon && p.procedure_type === selectedProcedure)
      .forEach((p) => {
        if (!map[p.component]) map[p.component] = []
        map[p.component].push(p)
      })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.priority - b.priority))
    return map
  }, [preferences, selectedSurgeon, selectedProcedure])

  // Count configured components for a surgeon in current procedure type
  const surgeonConfigCount = (surgeonName: string) => {
    const comps = new Set(
      preferences
        .filter((p) => p.surgeon_name === surgeonName && p.procedure_type === selectedProcedure)
        .map((p) => p.component)
    )
    return comps.size
  }

  const addVariant = async (component: string, variant: string, priority: number) => {
    if (!selectedSurgeon) return
    await supabase.from('surgeon_preferences').insert({
      surgeon_name: selectedSurgeon,
      procedure_type: selectedProcedure,
      component,
      priority,
      variant,
    })
    router.refresh()
  }

  const removeVariant = async (prefId: string) => {
    await supabase.from('surgeon_preferences').delete().eq('id', prefId)
    router.refresh()
  }

  const changePriority = async (prefId: string, newPriority: number) => {
    await supabase.from('surgeon_preferences').update({ priority: newPriority }).eq('id', prefId)
    router.refresh()
  }

  const currentSurgeonDisplay = surgeons.find((s) => s.repsuite_name === selectedSurgeon)?.display_name

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[500px]">
      {/* Column 1: Surgeon List */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="px-3 py-3 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search surgeons..."
            value={surgeonSearch}
            onChange={(e) => setSurgeonSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <nav className="py-1 overflow-y-auto flex-1">
          {filteredSurgeons.map((surgeon) => {
            const isActive = selectedSurgeon === surgeon.repsuite_name
            const isConfigured = configuredSet.has(surgeon.repsuite_name)
            const count = surgeonConfigCount(surgeon.repsuite_name)
            return (
              <button
                key={surgeon.repsuite_name}
                onClick={() => setSelectedSurgeon(surgeon.repsuite_name)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{surgeon.display_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-blue-100 text-blue-600' : isConfigured ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {count}/{components.length}
                    </span>
                  )}
                  <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
          {filteredSurgeons.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">No surgeons match.</p>
          )}
        </nav>
      </div>

      {/* Column 2: Preferences Grid */}
      {selectedSurgeon ? (
        <div className="flex-1 overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{currentSurgeonDisplay}</span>
            <div className="flex gap-1">
              {PROCEDURE_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => setSelectedProcedure(pt.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedProcedure === pt.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {components.map((comp) => {
              const prefs = surgeonPrefs[comp.id] ?? []
              const usedVariants = prefs.map((p) => p.variant)
              const available = comp.variants.filter((v) => !usedVariants.includes(v.id))

              // Group by priority
              const tiers: Record<number, Preference[]> = {}
              prefs.forEach((p) => {
                if (!tiers[p.priority]) tiers[p.priority] = []
                tiers[p.priority].push(p)
              })
              const tierKeys = Object.keys(tiers).map(Number).sort()
              const tierLabels: Record<number, string> = { 1: 'Primary', 2: 'Backup', 3: 'Fallback' }
              const tierColors: Record<number, string> = {
                1: 'bg-blue-50 text-blue-700',
                2: 'bg-amber-50 text-amber-700',
                3: 'bg-gray-100 text-gray-500',
              }

              return (
                <div key={comp.id} className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{comp.label}</span>
                    {prefs.length === 0 && <span className="text-xs text-gray-400">Not configured</span>}
                  </div>
                  <div className="p-4">
                    {/* Existing tiers */}
                    {tierKeys.length > 0 && (
                      <table className="w-full text-sm mb-3">
                        <tbody>
                          {tierKeys.map((tier) => (
                            <tr key={tier} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 pr-3 w-20 align-top">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierColors[tier] ?? tierColors[3]}`}>
                                  {tierLabels[tier] ?? `Tier ${tier}`}
                                </span>
                              </td>
                              <td className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {tiers[tier].map((pref) => {
                                    const vLabel = comp.variants.find((v) => v.id === pref.variant)?.label ?? pref.variant
                                    return (
                                      <span key={pref.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-900">
                                        {vLabel}
                                        {canEdit && (
                                          <>
                                            {tier > 1 && (
                                              <button onClick={() => changePriority(pref.id, tier - 1)} className="text-gray-400 hover:text-blue-600" title="Move up">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                              </button>
                                            )}
                                            {tier < 3 && (
                                              <button onClick={() => changePriority(pref.id, tier + 1)} className="text-gray-400 hover:text-amber-600" title="Move down">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                              </button>
                                            )}
                                            <button onClick={() => removeVariant(pref.id)} className="text-gray-400 hover:text-red-600" title="Remove">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </>
                                        )}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Add variants */}
                    {canEdit && available.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((v) => (
                          <div key={v.id} className="inline-flex rounded-lg overflow-hidden border border-dashed border-gray-300">
                            <span className="px-2 py-1 text-xs text-gray-600 bg-gray-50 border-r border-dashed border-gray-300">
                              {v.label}
                            </span>
                            <button
                              onClick={() => addVariant(comp.id, v.id, 1)}
                              className="px-1.5 py-1 text-xs text-blue-500 hover:bg-blue-50"
                              title="Add as Primary"
                            >
                              P
                            </button>
                            <button
                              onClick={() => addVariant(comp.id, v.id, 2)}
                              className="px-1.5 py-1 text-xs text-amber-500 hover:bg-amber-50 border-l border-dashed border-gray-200"
                              title="Add as Backup"
                            >
                              B
                            </button>
                            <button
                              onClick={() => addVariant(comp.id, v.id, 3)}
                              className="px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-50 border-l border-dashed border-gray-200"
                              title="Add as Fallback"
                            >
                              F
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span> Primary</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></span> Backup</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span> Fallback</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          Select a surgeon
        </div>
      )}
    </div>
  )
}
