'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  FREQUENCIES,
  getVariantLabel,
  getComponentConfig,
  COMPONENT_LABELS,
} from '@/lib/plan-config'
import type { PlanTemplate, SubPlan, SubPlanItem, Frequency } from '@/lib/plan-config'

interface Surgeon { repsuite_name: string; display_name: string }

const PROCEDURE_TYPES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
]

export default function ImplantPlansManager({
  surgeons, templates, userRole,
}: {
  surgeons: Surgeon[]
  templates: PlanTemplate[]
  userRole: string
}) {
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState('knee')
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Template creation
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  // Sub-plan editing
  const [editingSubPlan, setEditingSubPlan] = useState<string | null>(null) // sub_plan id
  const [editSubPlanName, setEditSubPlanName] = useState('')
  const [editSubPlanFreq, setEditSubPlanFreq] = useState<Frequency>('every_case')

  // Add item
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null) // sub_plan id
  const [addComponent, setAddComponent] = useState('')
  const [addVariant, setAddVariant] = useState('')
  const [addSide, setAddSide] = useState('')

  // New sub-plan
  const [addingSubPlanTo, setAddingSubPlanTo] = useState<string | null>(null) // template id
  const [newSubPlanName, setNewSubPlanName] = useState('')
  const [newSubPlanFreq, setNewSubPlanFreq] = useState<Frequency>('every_case')

  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch) return surgeons
    const q = surgeonSearch.toLowerCase()
    return surgeons.filter((s) => s.display_name.toLowerCase().includes(q))
  }, [surgeons, surgeonSearch])

  const surgeonTemplates = useMemo(() => {
    if (!selectedSurgeon) return []
    return templates
      .filter((t) => t.surgeon_name === selectedSurgeon && t.procedure_type === selectedProcedure)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1
        if (!a.is_default && b.is_default) return 1
        return a.plan_name.localeCompare(b.plan_name)
      })
  }, [templates, selectedSurgeon, selectedProcedure])

  const planCount = (name: string) => templates.filter((t) => t.surgeon_name === name).length
  const configuredSet = useMemo(() => new Set(templates.map((t) => t.surgeon_name)), [templates])
  const currentDisplay = surgeons.find((s) => s.repsuite_name === selectedSurgeon)?.display_name
  const compConfig = getComponentConfig(selectedProcedure)

  // --- Actions ---

  const createTemplate = async () => {
    if (!selectedSurgeon || !newTemplateName.trim()) return
    setSaving(true)
    await supabase.from('surgeon_implant_plans').insert({
      surgeon_name: selectedSurgeon,
      plan_name: newTemplateName.trim(),
      procedure_type: selectedProcedure,
      is_default: surgeonTemplates.length === 0,
    })
    setShowNewTemplate(false)
    setNewTemplateName('')
    setSaving(false)
    router.refresh()
  }

  const deleteTemplate = async (id: string) => {
    await supabase.from('surgeon_implant_plans').delete().eq('id', id)
    router.refresh()
  }

  const toggleDefault = async (id: string, surgeonName: string, procType: string) => {
    await supabase.from('surgeon_implant_plans')
      .update({ is_default: false })
      .eq('surgeon_name', surgeonName)
      .eq('procedure_type', procType)
    await supabase.from('surgeon_implant_plans')
      .update({ is_default: true })
      .eq('id', id)
    router.refresh()
  }

  const createSubPlan = async (templateId: string) => {
    if (!newSubPlanName.trim()) return
    setSaving(true)
    const existing = templates.find((t) => t.id === templateId)
    const nextOrder = (existing?.sub_plans.length ?? 0)
    await supabase.from('plan_sub_plans').insert({
      template_id: templateId,
      name: newSubPlanName.trim(),
      frequency: newSubPlanFreq,
      sort_order: nextOrder,
    })
    setAddingSubPlanTo(null)
    setNewSubPlanName('')
    setNewSubPlanFreq('every_case')
    setSaving(false)
    router.refresh()
  }

  const updateSubPlan = async (subPlanId: string) => {
    setSaving(true)
    await supabase.from('plan_sub_plans')
      .update({ name: editSubPlanName.trim(), frequency: editSubPlanFreq })
      .eq('id', subPlanId)
    setEditingSubPlan(null)
    setSaving(false)
    router.refresh()
  }

  const deleteSubPlan = async (subPlanId: string) => {
    await supabase.from('plan_sub_plans').delete().eq('id', subPlanId)
    router.refresh()
  }

  const addItem = async (subPlanId: string) => {
    if (!addComponent || !addVariant) return
    setSaving(true)
    await supabase.from('plan_sub_plan_items').insert({
      sub_plan_id: subPlanId,
      component: addComponent,
      variant: addVariant,
      side: addComponent === 'femur' || (compConfig.find((c) => c.key === addComponent)?.hasSide) ? (addSide || null) : null,
    })
    setAddingItemTo(null)
    setAddComponent('')
    setAddVariant('')
    setAddSide('')
    setSaving(false)
    router.refresh()
  }

  const deleteItem = async (itemId: string) => {
    await supabase.from('plan_sub_plan_items').delete().eq('id', itemId)
    router.refresh()
  }

  const freqLabel = (f: string) => FREQUENCIES.find((fr) => fr.id === f)?.label ?? f
  const freqColor = (f: string) => {
    switch (f) {
      case 'every_case': return 'bg-blue-50 text-blue-600 border-blue-200'
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-200'
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200'
      case 'high': return 'bg-purple-50 text-purple-600 border-purple-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px]">
      {/* Surgeon list */}
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
            const count = planCount(surgeon.repsuite_name)
            return (
              <button
                key={surgeon.repsuite_name}
                onClick={() => { setSelectedSurgeon(surgeon.repsuite_name); setShowNewTemplate(false); setAddingSubPlanTo(null); setEditingSubPlan(null); setAddingItemTo(null) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{surgeon.display_name}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    isActive ? 'bg-blue-100 text-blue-600' : configuredSet.has(surgeon.repsuite_name) ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      {selectedSurgeon ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0 z-10 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{currentDisplay}</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {PROCEDURE_TYPES.map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => { setSelectedProcedure(pt.id); setShowNewTemplate(false) }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedProcedure === pt.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{pt.label}</button>
                ))}
              </div>
              {canEdit && (
                <button
                  onClick={() => { setShowNewTemplate(true); setNewTemplateName('') }}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                >+ New Plan</button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* New template form */}
            {showNewTemplate && (
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/20">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g., Primary Knee, PS Pro Knee"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') createTemplate() }}
                    />
                  </div>
                  <button onClick={createTemplate} disabled={saving || !newTemplateName.trim()} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => setShowNewTemplate(false)} className="px-3 py-1.5 text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {/* Templates */}
            {surgeonTemplates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Template header */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{template.plan_name}</span>
                    {template.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">Default</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      {!template.is_default && (
                        <button onClick={() => toggleDefault(template.id, template.surgeon_name, template.procedure_type)} className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Set Default</button>
                      )}
                      <button onClick={() => deleteTemplate(template.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600">Delete</button>
                    </div>
                  )}
                </div>

                {/* Sub-plans */}
                <div className="divide-y divide-gray-100">
                  {template.sub_plans.map((sp, spIdx) => (
                    <div key={sp.id} className="px-4 py-3">
                      {/* Sub-plan header */}
                      {editingSubPlan === sp.id ? (
                        <div className="flex gap-2 items-end mb-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editSubPlanName}
                              onChange={(e) => setEditSubPlanName(e.target.value)}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-sm outline-none"
                              autoFocus
                            />
                          </div>
                          <select
                            value={editSubPlanFreq}
                            onChange={(e) => setEditSubPlanFreq(e.target.value as Frequency)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                          </select>
                          <button onClick={() => updateSubPlan(sp.id)} className="text-xs text-blue-600 font-medium">Save</button>
                          <button onClick={() => setEditingSubPlan(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-5">{'ABCDEFGH'[spIdx]}</span>
                            <span className="text-sm font-medium text-gray-900">{sp.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${freqColor(sp.frequency)}`}>
                              {freqLabel(sp.frequency)}
                            </span>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setEditingSubPlan(sp.id); setEditSubPlanName(sp.name); setEditSubPlanFreq(sp.frequency) }}
                                className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                              >Edit</button>
                              <button
                                onClick={() => deleteSubPlan(sp.id)}
                                className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >Remove</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Items */}
                      <div className="flex flex-wrap gap-1.5 ml-7">
                        {sp.items.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-900 group/item"
                          >
                            {item.side && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                                {item.side === 'left' ? 'L' : 'R'}
                              </span>
                            )}
                            {getVariantLabel(item.variant)} {COMPONENT_LABELS[item.component] ?? item.component}
                            {canEdit && (
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-500 ml-0.5"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </span>
                        ))}

                        {/* Add item inline */}
                        {canEdit && addingItemTo !== sp.id && (
                          <button
                            onClick={() => { setAddingItemTo(sp.id); setAddComponent(''); setAddVariant(''); setAddSide('') }}
                            className="inline-flex items-center px-2 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500"
                          >+ Add item</button>
                        )}
                      </div>

                      {/* Add item form */}
                      {addingItemTo === sp.id && (
                        <div className="ml-7 mt-2 flex flex-wrap gap-2 items-end">
                          <select
                            value={addComponent}
                            onChange={(e) => { setAddComponent(e.target.value); setAddVariant(''); setAddSide('') }}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Component...</option>
                            {compConfig.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                          {addComponent && (
                            <select
                              value={addVariant}
                              onChange={(e) => setAddVariant(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Variant...</option>
                              {(compConfig.find((c) => c.key === addComponent)?.options ?? []).map((v) => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                              ))}
                            </select>
                          )}
                          {addComponent && compConfig.find((c) => c.key === addComponent)?.hasSide && (
                            <select
                              value={addSide}
                              onChange={(e) => setAddSide(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Any side</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                            </select>
                          )}
                          <button
                            onClick={() => addItem(sp.id)}
                            disabled={!addComponent || !addVariant || saving}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                          >Add</button>
                          <button onClick={() => setAddingItemTo(null)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add sub-plan */}
                  {canEdit && addingSubPlanTo !== template.id && (
                    <div className="px-4 py-2">
                      <button
                        onClick={() => { setAddingSubPlanTo(template.id); setNewSubPlanName(''); setNewSubPlanFreq('every_case') }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >+ Add sub-plan</button>
                    </div>
                  )}

                  {addingSubPlanTo === template.id && (
                    <div className="px-4 py-3 bg-blue-50/30">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-[10px] text-gray-500 mb-0.5">Sub-plan Name</label>
                          <input
                            type="text"
                            value={newSubPlanName}
                            onChange={(e) => setNewSubPlanName(e.target.value)}
                            placeholder="e.g., CR Cemented, PS Backup"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Frequency</label>
                          <select
                            value={newSubPlanFreq}
                            onChange={(e) => setNewSubPlanFreq(e.target.value as Frequency)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.rule}</option>)}
                          </select>
                        </div>
                        <button onClick={() => createSubPlan(template.id)} disabled={saving || !newSubPlanName.trim()} className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 disabled:opacity-50">Add</button>
                        <button onClick={() => setAddingSubPlanTo(null)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>

                {template.sub_plans.length === 0 && addingSubPlanTo !== template.id && (
                  <div className="px-4 py-4 text-center text-xs text-gray-400">
                    No sub-plans yet. Add a sub-plan to start defining implant requirements.
                  </div>
                )}
              </div>
            ))}

            {surgeonTemplates.length === 0 && !showNewTemplate && (
              <div className="text-center py-8 text-sm text-gray-400">
                No plans for {selectedProcedure}. Click &ldquo;+ New Plan&rdquo; to create one.
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-400">
            {FREQUENCIES.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded ${freqColor(f.id).split(' ')[0]}`}></span>
                {f.label} — {f.rule}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          Select a surgeon to manage their implant plans
        </div>
      )}
    </div>
  )
}
