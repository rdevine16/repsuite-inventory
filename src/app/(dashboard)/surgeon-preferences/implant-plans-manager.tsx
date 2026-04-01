'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CONVERSION_LIKELIHOODS,
  KNEE_PLAN_OPTIONS,
  HIP_PLAN_OPTIONS,
  COMPONENT_LABELS,
  getVariantLabel,
} from '@/lib/plan-config'
import type { ImplantPlanTemplate, ConversionLikelihood } from '@/lib/plan-config'

interface Surgeon {
  repsuite_name: string
  display_name: string
}

type VariantOption = { id: string; label: string }

function getComponentConfig(procedureType: string): { key: string; label: string; options: VariantOption[] }[] {
  if (procedureType === 'hip') {
    return [
      { key: 'stem', label: 'Stem', options: HIP_PLAN_OPTIONS.stem },
      { key: 'cup', label: 'Cup', options: HIP_PLAN_OPTIONS.cup },
      { key: 'liner', label: 'Liner', options: HIP_PLAN_OPTIONS.liner },
      { key: 'head', label: 'Head', options: HIP_PLAN_OPTIONS.head },
    ]
  }
  return [
    { key: 'femur', label: 'Femur', options: KNEE_PLAN_OPTIONS.femur },
    { key: 'tibia', label: 'Tibia', options: KNEE_PLAN_OPTIONS.tibia },
    { key: 'patella', label: 'Patella', options: KNEE_PLAN_OPTIONS.patella },
    { key: 'poly', label: 'Poly', options: KNEE_PLAN_OPTIONS.poly },
  ]
}

const PROCEDURE_TYPES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
]

export default function ImplantPlansManager({
  surgeons,
  plans,
  userRole,
}: {
  surgeons: Surgeon[]
  plans: ImplantPlanTemplate[]
  userRole: string
}) {
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState('knee')
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const [editing, setEditing] = useState<ImplantPlanTemplate | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Form state
  const [form, setForm] = useState({
    plan_name: '',
    is_default: false,
    femur: '', tibia: '', patella: '', poly: [] as string[],
    cem_femur: '', cem_tibia: '', cem_patella: '',
    has_alt: false,
    alt_femur: '', alt_tibia: '', alt_patella: '', alt_poly: [] as string[],
    alt_likelihood: 'low' as ConversionLikelihood,
    notes: '',
  })

  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch) return surgeons
    const q = surgeonSearch.toLowerCase()
    return surgeons.filter((s) => s.display_name.toLowerCase().includes(q))
  }, [surgeons, surgeonSearch])

  const surgeonPlans = useMemo(() => {
    if (!selectedSurgeon) return []
    return plans
      .filter((p) => p.surgeon_name === selectedSurgeon && p.procedure_type === selectedProcedure)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1
        if (!a.is_default && b.is_default) return 1
        return a.plan_name.localeCompare(b.plan_name)
      })
  }, [plans, selectedSurgeon, selectedProcedure])

  const planCount = (surgeonName: string) =>
    plans.filter((p) => p.surgeon_name === surgeonName).length

  const configuredSet = useMemo(() => new Set(plans.map((p) => p.surgeon_name)), [plans])

  const startNew = () => {
    const config = getComponentConfig(selectedProcedure)
    setForm({
      plan_name: '',
      is_default: surgeonPlans.length === 0,
      femur: config[0]?.options[0]?.id ?? '',
      tibia: config[1]?.options[0]?.id ?? '',
      patella: config[2]?.options[0]?.id ?? '',
      poly: [config[3]?.options[0]?.id ?? ''],
      cem_femur: '', cem_tibia: '', cem_patella: '',
      has_alt: false,
      alt_femur: '', alt_tibia: '', alt_patella: '', alt_poly: [],
      alt_likelihood: 'low',
      notes: '',
    })
    setEditing('new')
  }

  const startEditing = (plan: ImplantPlanTemplate) => {
    setForm({
      plan_name: plan.plan_name,
      is_default: plan.is_default,
      femur: plan.femur_variant ?? '',
      tibia: plan.tibia_variant ?? '',
      patella: plan.patella_variant ?? '',
      poly: plan.poly_variants ?? [],
      cem_femur: plan.cemented_femur_variant ?? '',
      cem_tibia: plan.cemented_tibia_variant ?? '',
      cem_patella: plan.cemented_patella_variant ?? '',
      has_alt: plan.has_clinical_alternate,
      alt_femur: plan.alt_femur_variant ?? '',
      alt_tibia: plan.alt_tibia_variant ?? '',
      alt_patella: plan.alt_patella_variant ?? '',
      alt_poly: plan.alt_poly_variants ?? [],
      alt_likelihood: plan.alt_conversion_likelihood ?? 'low',
      notes: plan.notes ?? '',
    })
    setEditing(plan)
  }

  const savePlan = async () => {
    if (!selectedSurgeon || !editing) return
    setSaving(true)

    const data = {
      surgeon_name: selectedSurgeon,
      plan_name: form.plan_name || 'Untitled Plan',
      procedure_type: selectedProcedure,
      is_default: form.is_default,
      femur_variant: form.femur || null,
      tibia_variant: form.tibia || null,
      patella_variant: form.patella || null,
      poly_variants: form.poly.filter(Boolean),
      cemented_femur_variant: form.cem_femur || null,
      cemented_tibia_variant: form.cem_tibia || null,
      cemented_patella_variant: form.cem_patella || null,
      has_clinical_alternate: form.has_alt,
      alt_femur_variant: form.has_alt ? (form.alt_femur || null) : null,
      alt_tibia_variant: form.has_alt ? (form.alt_tibia || null) : null,
      alt_patella_variant: form.has_alt ? (form.alt_patella || null) : null,
      alt_poly_variants: form.has_alt ? form.alt_poly.filter(Boolean) : [],
      alt_conversion_likelihood: form.has_alt ? form.alt_likelihood : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    // If setting as default, unset others
    if (form.is_default) {
      await supabase
        .from('surgeon_implant_plans')
        .update({ is_default: false })
        .eq('surgeon_name', selectedSurgeon)
        .eq('procedure_type', selectedProcedure)
    }

    if (editing === 'new') {
      await supabase.from('surgeon_implant_plans').insert(data)
    } else {
      await supabase.from('surgeon_implant_plans').update(data).eq('id', editing.id)
    }

    setEditing(null)
    setSaving(false)
    router.refresh()
  }

  const deletePlan = async (planId: string) => {
    await supabase.from('surgeon_implant_plans').delete().eq('id', planId)
    setEditing(null)
    router.refresh()
  }

  const togglePoly = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((p) => p !== id) : [...arr, id]

  const currentSurgeonDisplay = surgeons.find((s) => s.repsuite_name === selectedSurgeon)?.display_name
  const compConfig = getComponentConfig(selectedProcedure)

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
                onClick={() => { setSelectedSurgeon(surgeon.repsuite_name); setEditing(null) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{surgeon.display_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-blue-100 text-blue-600' : configuredSet.has(surgeon.repsuite_name) ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {count}
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

      {/* Plans */}
      {selectedSurgeon ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0 z-10 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{currentSurgeonDisplay}</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {PROCEDURE_TYPES.map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => { setSelectedProcedure(pt.id); setEditing(null) }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedProcedure === pt.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
              {canEdit && !editing && (
                <button
                  onClick={startNew}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  + New Plan
                </button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Existing plans */}
            {surgeonPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                compConfig={compConfig}
                canEdit={canEdit}
                onEdit={() => startEditing(plan)}
                onDelete={() => deletePlan(plan.id)}
              />
            ))}

            {surgeonPlans.length === 0 && !editing && (
              <div className="text-center py-8 text-sm text-gray-400">
                No plans for {selectedProcedure}. Click &ldquo;+ New Plan&rdquo; to create one.
              </div>
            )}

            {/* Edit / New form */}
            {editing && (
              <PlanForm
                form={form}
                setForm={setForm}
                compConfig={compConfig}
                selectedProcedure={selectedProcedure}
                isNew={editing === 'new'}
                saving={saving}
                onSave={savePlan}
                onCancel={() => setEditing(null)}
                togglePoly={togglePoly}
              />
            )}
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

// ---- Plan Card (read-only) ----

function PlanCard({
  plan, compConfig, canEdit, onEdit, onDelete,
}: {
  plan: ImplantPlanTemplate
  compConfig: { key: string; label: string; options: VariantOption[] }[]
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{plan.plan_name}</span>
          {plan.is_default && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">Default</span>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Edit</button>
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600">Delete</button>
          </div>
        )}
      </div>

      {/* Primary */}
      <div className="px-4 py-3">
        <div className="text-[10px] font-medium text-blue-500 uppercase tracking-wider mb-2">Primary</div>
        <div className="grid grid-cols-4 gap-3">
          {compConfig.map((comp, i) => {
            const val = i === 0 ? plan.femur_variant : i === 1 ? plan.tibia_variant : i === 2 ? plan.patella_variant : null
            const polyVal = i === 3 ? plan.poly_variants : null
            return (
              <div key={comp.key}>
                <div className="text-[10px] text-gray-400 uppercase">{comp.label}</div>
                <div className="text-sm font-medium text-gray-900">
                  {polyVal && polyVal.length > 0
                    ? polyVal.map((v) => getVariantLabel(v)).join(' + ')
                    : val ? getVariantLabel(val) : <span className="text-gray-300">—</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cemented fallback */}
      {(plan.cemented_femur_variant || plan.cemented_tibia_variant || plan.cemented_patella_variant) && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Cemented Fallback</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 font-medium">1:1 with primary</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {compConfig.map((comp, i) => {
              const val = i === 0 ? plan.cemented_femur_variant : i === 1 ? plan.cemented_tibia_variant : i === 2 ? plan.cemented_patella_variant : null
              if (i === 3) return <div key={comp.key} />
              return (
                <div key={comp.key}>
                  <div className="text-[10px] text-gray-400 uppercase">{comp.label}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {val ? getVariantLabel(val) : <span className="text-gray-300">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Clinical alternate */}
      {plan.has_clinical_alternate && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Clinical Alternate</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500 font-medium">
              {plan.alt_conversion_likelihood} conversion
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {compConfig.map((comp, i) => {
              const val = i === 0 ? plan.alt_femur_variant : i === 1 ? plan.alt_tibia_variant : i === 2 ? plan.alt_patella_variant : null
              const polyVal = i === 3 ? plan.alt_poly_variants : null
              return (
                <div key={comp.key}>
                  <div className="text-[10px] text-gray-400 uppercase">{comp.label}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {polyVal && polyVal.length > 0
                      ? polyVal.map((v) => getVariantLabel(v)).join(' + ')
                      : val ? getVariantLabel(val) : <span className="text-gray-300">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {plan.notes && (
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">{plan.notes}</div>
      )}
    </div>
  )
}

// ---- Plan Form ----

interface FormState {
  plan_name: string; is_default: boolean
  femur: string; tibia: string; patella: string; poly: string[]
  cem_femur: string; cem_tibia: string; cem_patella: string
  has_alt: boolean
  alt_femur: string; alt_tibia: string; alt_patella: string; alt_poly: string[]
  alt_likelihood: ConversionLikelihood
  notes: string
}

function PlanForm({
  form, setForm, compConfig, selectedProcedure, isNew, saving, onSave, onCancel, togglePoly,
}: {
  form: FormState
  setForm: (f: FormState) => void
  compConfig: { key: string; label: string; options: VariantOption[] }[]
  selectedProcedure: string
  isNew: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
  togglePoly: (arr: string[], id: string) => string[]
}) {
  const u = (patch: Partial<FormState>) => setForm({ ...form, ...patch })

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-5 bg-blue-50/20 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'New' : 'Edit'} Plan</h3>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      {/* Plan name + default */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name</label>
          <input
            type="text"
            value={form.plan_name}
            onChange={(e) => u({ plan_name: e.target.value })}
            placeholder="e.g., CR Pressfit Knee, PS Pro Knee"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="pt-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => u({ is_default: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600">Default plan</span>
          </label>
        </div>
      </div>

      {/* Primary components */}
      <div>
        <div className="text-xs font-semibold text-blue-600 mb-2">Primary Components</div>
        <div className="grid grid-cols-2 gap-3">
          {compConfig.map((comp, i) => (
            <div key={comp.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{comp.label}</label>
              {i === 3 && selectedProcedure === 'knee' ? (
                <div className="flex flex-wrap gap-1.5">
                  {comp.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => u({ poly: togglePoly(form.poly, o.id) })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        form.poly.includes(o.id)
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
                  value={i === 0 ? form.femur : i === 1 ? form.tibia : i === 2 ? form.patella : form.poly[0] ?? ''}
                  onChange={(e) => {
                    if (i === 0) u({ femur: e.target.value })
                    else if (i === 1) u({ tibia: e.target.value })
                    else if (i === 2) u({ patella: e.target.value })
                    else u({ poly: e.target.value ? [e.target.value] : [] })
                  }}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">None</option>
                  {comp.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cemented fallback */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-semibold text-amber-600">Cemented Fallback</div>
          <span className="text-[10px] text-amber-500">1:1 with primary — only set components that change when cementing</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {compConfig.slice(0, 3).map((comp, i) => (
            <div key={comp.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{comp.label}</label>
              <select
                value={i === 0 ? form.cem_femur : i === 1 ? form.cem_tibia : form.cem_patella}
                onChange={(e) => {
                  if (i === 0) u({ cem_femur: e.target.value })
                  else if (i === 1) u({ cem_tibia: e.target.value })
                  else u({ cem_patella: e.target.value })
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="">No change</option>
                {comp.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical alternate toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.has_alt}
            onChange={(e) => u({ has_alt: e.target.checked })}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-xs font-semibold text-purple-600">Include Clinical Alternate</span>
          <span className="text-[10px] text-gray-400">Different constraint system if patient anatomy demands it</span>
        </label>

        {form.has_alt && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {compConfig.map((comp, i) => (
                <div key={comp.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{comp.label}</label>
                  {i === 3 && selectedProcedure === 'knee' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {comp.options.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => u({ alt_poly: togglePoly(form.alt_poly, o.id) })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            form.alt_poly.includes(o.id)
                              ? 'bg-purple-100 border-purple-300 text-purple-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <select
                      value={i === 0 ? form.alt_femur : i === 1 ? form.alt_tibia : i === 2 ? form.alt_patella : form.alt_poly[0] ?? ''}
                      onChange={(e) => {
                        if (i === 0) u({ alt_femur: e.target.value })
                        else if (i === 1) u({ alt_tibia: e.target.value })
                        else if (i === 2) u({ alt_patella: e.target.value })
                        else u({ alt_poly: e.target.value ? [e.target.value] : [] })
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">None</option>
                      {comp.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Conversion Likelihood</label>
              <div className="flex gap-2">
                {CONVERSION_LIKELIHOODS.map((cl) => (
                  <button
                    key={cl.id}
                    onClick={() => u({ alt_likelihood: cl.id })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs transition ${
                      form.alt_likelihood === cl.id
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
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => u({ notes: e.target.value })}
          placeholder="e.g., Patient has ligament laxity, use for revision cases"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving || !form.plan_name.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>
    </div>
  )
}
