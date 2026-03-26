'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  PLAN_TYPES,
  CONVERSION_LIKELIHOODS,
  KNEE_PLAN_OPTIONS,
  HIP_PLAN_OPTIONS,
  COMPONENT_LABELS,
  getVariantLabel,
} from '@/lib/plan-config'
import type { PlanType, ConversionLikelihood } from '@/lib/plan-config'

interface Surgeon {
  repsuite_name: string
  display_name: string
}

interface ImplantPlan {
  id: string
  surgeon_name: string
  procedure_type: string
  plan_type: string
  plan_label: string | null
  conversion_likelihood: string | null
  femur_variant: string | null
  tibia_variant: string | null
  patella_variant: string | null
  poly_variants: string[] | null
  notes: string | null
}

const PROCEDURE_TYPES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
]

type VariantOption = { id: string; label: string }

function getComponentConfig(procedureType: string): { key: string; options: VariantOption[] }[] {
  if (procedureType === 'hip') {
    return [
      { key: 'stem', options: HIP_PLAN_OPTIONS.stem },
      { key: 'cup', options: HIP_PLAN_OPTIONS.cup },
      { key: 'liner', options: HIP_PLAN_OPTIONS.liner },
      { key: 'head', options: HIP_PLAN_OPTIONS.head },
    ]
  }
  return [
    { key: 'femur', options: KNEE_PLAN_OPTIONS.femur },
    { key: 'tibia', options: KNEE_PLAN_OPTIONS.tibia },
    { key: 'patella', options: KNEE_PLAN_OPTIONS.patella },
    { key: 'poly', options: KNEE_PLAN_OPTIONS.poly },
  ]
}

// Map plan component keys to DB field names
function getDbField(procedureType: string, componentKey: string): string {
  if (procedureType === 'hip') {
    const map: Record<string, string> = { stem: 'femur_variant', cup: 'tibia_variant', liner: 'patella_variant', head: 'poly_variants' }
    return map[componentKey] ?? componentKey
  }
  return `${componentKey}_variant`
}

function getDbValue(plan: ImplantPlan, procedureType: string, componentKey: string): string | null {
  if (procedureType === 'hip') {
    const map: Record<string, keyof ImplantPlan> = {
      stem: 'femur_variant',
      cup: 'tibia_variant',
      liner: 'patella_variant',
      head: 'poly_variants',
    }
    const field = map[componentKey]
    if (componentKey === 'head') {
      const arr = plan.poly_variants
      return arr && arr.length > 0 ? arr[0] : null
    }
    return plan[field] as string | null
  }
  if (componentKey === 'poly') {
    return plan.poly_variants && plan.poly_variants.length > 0 ? plan.poly_variants.join(', ') : null
  }
  const field = `${componentKey}_variant` as keyof ImplantPlan
  return plan[field] as string | null
}

export default function ImplantPlansManager({
  surgeons,
  plans,
  userRole,
}: {
  surgeons: Surgeon[]
  plans: ImplantPlan[]
  userRole: string
}) {
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState('knee')
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const [editingPlan, setEditingPlan] = useState<PlanType | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Form state for editing
  const [formFemur, setFormFemur] = useState('')
  const [formTibia, setFormTibia] = useState('')
  const [formPatella, setFormPatella] = useState('')
  const [formPoly, setFormPoly] = useState<string[]>([])
  const [formLikelihood, setFormLikelihood] = useState<ConversionLikelihood>('low')
  const [formLabel, setFormLabel] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const configuredSet = useMemo(() => {
    return new Set(plans.map((p) => p.surgeon_name))
  }, [plans])

  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch) return surgeons
    const q = surgeonSearch.toLowerCase()
    return surgeons.filter((s) => s.display_name.toLowerCase().includes(q))
  }, [surgeons, surgeonSearch])

  // Plans for selected surgeon + procedure
  const surgeonPlans = useMemo(() => {
    if (!selectedSurgeon) return []
    return plans
      .filter((p) => p.surgeon_name === selectedSurgeon && p.procedure_type === selectedProcedure)
      .sort((a, b) => {
        const order: Record<string, number> = { primary: 0, cemented_fallback: 1, clinical_alternate: 2 }
        return (order[a.plan_type] ?? 9) - (order[b.plan_type] ?? 9)
      })
  }, [plans, selectedSurgeon, selectedProcedure])

  const planCount = (surgeonName: string) => {
    return plans.filter((p) => p.surgeon_name === surgeonName && p.procedure_type === selectedProcedure).length
  }

  const existingPlanTypes = new Set(surgeonPlans.map((p) => p.plan_type))

  const startEditing = (planType: PlanType, existingPlan?: ImplantPlan) => {
    const config = getComponentConfig(selectedProcedure)

    if (existingPlan) {
      setFormFemur(existingPlan.femur_variant ?? '')
      setFormTibia(existingPlan.tibia_variant ?? '')
      setFormPatella(existingPlan.patella_variant ?? '')
      setFormPoly(existingPlan.poly_variants ?? [])
      setFormLikelihood((existingPlan.conversion_likelihood as ConversionLikelihood) ?? 'low')
      setFormLabel(existingPlan.plan_label ?? '')
      setFormNotes(existingPlan.notes ?? '')
    } else {
      setFormFemur(config[0]?.options[0]?.id ?? '')
      setFormTibia(config[1]?.options[0]?.id ?? '')
      setFormPatella(config[2]?.options[0]?.id ?? '')
      setFormPoly([config[3]?.options[0]?.id ?? ''])
      setFormLikelihood('low')
      setFormLabel('')
      setFormNotes('')
    }
    setEditingPlan(planType)
  }

  const savePlan = async () => {
    if (!selectedSurgeon || !editingPlan) return
    setSaving(true)

    const existing = surgeonPlans.find((p) => p.plan_type === editingPlan)
    const data = {
      surgeon_name: selectedSurgeon,
      procedure_type: selectedProcedure,
      plan_type: editingPlan,
      plan_label: formLabel || null,
      conversion_likelihood: editingPlan === 'clinical_alternate' ? formLikelihood : null,
      femur_variant: formFemur || null,
      tibia_variant: formTibia || null,
      patella_variant: formPatella || null,
      poly_variants: formPoly.filter(Boolean),
      notes: formNotes || null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase.from('surgeon_implant_plans').update(data).eq('id', existing.id)
    } else {
      await supabase.from('surgeon_implant_plans').insert(data)
    }

    setEditingPlan(null)
    setSaving(false)
    router.refresh()
  }

  const deletePlan = async (planId: string) => {
    await supabase.from('surgeon_implant_plans').delete().eq('id', planId)
    router.refresh()
  }

  const togglePoly = (polyId: string) => {
    setFormPoly((prev) =>
      prev.includes(polyId) ? prev.filter((p) => p !== polyId) : [...prev, polyId]
    )
  }

  const currentSurgeonDisplay = surgeons.find((s) => s.repsuite_name === selectedSurgeon)?.display_name
  const compConfig = getComponentConfig(selectedProcedure)
  const componentKeys = compConfig.map((c) => c.key)

  const planTypeColors: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    cemented_fallback: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    clinical_alternate: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  }

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px]">
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
            const count = planCount(surgeon.repsuite_name)
            return (
              <button
                key={surgeon.repsuite_name}
                onClick={() => { setSelectedSurgeon(surgeon.repsuite_name); setEditingPlan(null) }}
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
                      {count} plan{count !== 1 ? 's' : ''}
                    </span>
                  )}
                  <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Column 2: Plans */}
      {selectedSurgeon ? (
        <div className="flex-1 overflow-x-auto">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{currentSurgeonDisplay}</span>
            <div className="flex gap-1">
              {PROCEDURE_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => { setSelectedProcedure(pt.id); setEditingPlan(null) }}
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
            {/* Existing plans */}
            {surgeonPlans.map((plan) => {
              const pt = PLAN_TYPES.find((p) => p.id === plan.plan_type)
              const colors = planTypeColors[plan.plan_type] ?? planTypeColors.primary

              return (
                <div key={plan.id} className={`border rounded-lg ${colors.border}`}>
                  <div className={`px-4 py-2.5 ${colors.bg} border-b ${colors.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${colors.text}`}>
                        {pt?.label ?? plan.plan_type}
                      </span>
                      {plan.plan_label && (
                        <span className="text-xs text-gray-500">— {plan.plan_label}</span>
                      )}
                      {plan.plan_type === 'cemented_fallback' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">1:1 with primary</span>
                      )}
                      {plan.conversion_likelihood && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                          {plan.conversion_likelihood} conversion
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(plan.plan_type as PlanType, plan)}
                          className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-white/50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          className="text-xs px-2 py-1 rounded text-red-400 hover:bg-white/50 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-4 gap-3">
                      {componentKeys.map((key) => {
                        const value = getDbValue(plan, selectedProcedure, key)
                        return (
                          <div key={key}>
                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                              {COMPONENT_LABELS[key] ?? key}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {key === 'poly' && plan.poly_variants && plan.poly_variants.length > 0
                                ? plan.poly_variants.map((v) => getVariantLabel(v)).join(' + ')
                                : value ? getVariantLabel(value) : (
                                  <span className="text-gray-300">—</span>
                                )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {plan.notes && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                        {plan.notes}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Edit/Add form */}
            {editingPlan && (
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {existingPlanTypes.has(editingPlan) ? 'Edit' : 'Add'}{' '}
                    {PLAN_TYPES.find((p) => p.id === editingPlan)?.label} Plan
                  </h3>
                  <button
                    onClick={() => setEditingPlan(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Plan label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Plan Label (optional)</label>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="e.g., CR Pressfit, PS Backup"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Component selectors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{COMPONENT_LABELS[compConfig[0]?.key]}</label>
                      <select
                        value={formFemur}
                        onChange={(e) => setFormFemur(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">None</option>
                        {compConfig[0]?.options.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{COMPONENT_LABELS[compConfig[1]?.key]}</label>
                      <select
                        value={formTibia}
                        onChange={(e) => setFormTibia(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">None</option>
                        {compConfig[1]?.options.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{COMPONENT_LABELS[compConfig[2]?.key]}</label>
                      <select
                        value={formPatella}
                        onChange={(e) => setFormPatella(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">None</option>
                        {compConfig[2]?.options.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {COMPONENT_LABELS[compConfig[3]?.key]}
                        {selectedProcedure === 'knee' && <span className="text-gray-400 ml-1">(multi-select)</span>}
                      </label>
                      {selectedProcedure === 'knee' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {compConfig[3]?.options.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => togglePoly(o.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                                formPoly.includes(o.id)
                                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={formPoly[0] ?? ''}
                          onChange={(e) => setFormPoly(e.target.value ? [e.target.value] : [])}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">None</option>
                          {compConfig[3]?.options.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Conversion likelihood for clinical alternate */}
                  {editingPlan === 'clinical_alternate' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Conversion Likelihood</label>
                      <div className="flex gap-2">
                        {CONVERSION_LIKELIHOODS.map((cl) => (
                          <button
                            key={cl.id}
                            onClick={() => setFormLikelihood(cl.id)}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs transition ${
                              formLikelihood === cl.id
                                ? 'bg-purple-100 border-purple-300 text-purple-700 font-medium'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            <div className="font-medium">{cl.label}</div>
                            <div className="text-[10px] mt-0.5 opacity-75">{cl.rule}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="e.g., Only if patient has ligament laxity"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingPlan(null)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePlan}
                      disabled={saving}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {saving ? 'Saving...' : 'Save Plan'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add plan buttons */}
            {canEdit && !editingPlan && (
              <div className="flex gap-2">
                {PLAN_TYPES.filter((pt) => !existingPlanTypes.has(pt.id)).map((pt) => {
                  // Can't add cemented fallback without primary
                  if (pt.id === 'cemented_fallback' && !existingPlanTypes.has('primary')) return null
                  // Can't add clinical alternate without primary
                  if (pt.id === 'clinical_alternate' && !existingPlanTypes.has('primary')) return null

                  const colors = planTypeColors[pt.id]
                  return (
                    <button
                      key={pt.id}
                      onClick={() => startEditing(pt.id)}
                      className={`px-4 py-2.5 rounded-lg border-2 border-dashed text-xs font-medium transition hover:shadow-sm ${colors.border} ${colors.text} hover:${colors.bg}`}
                    >
                      + Add {pt.label}
                    </button>
                  )
                })}
                {surgeonPlans.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Start by adding a Primary plan for this surgeon.</p>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span>
              Primary — 1 set per case
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></span>
              Cemented — 1:1 with primary
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-50 border border-purple-200"></span>
              Clinical Alt — configurable
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          Select a surgeon to configure their implant plans
        </div>
      )}
    </div>
  )
}
