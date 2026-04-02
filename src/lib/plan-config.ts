// Implant plan configuration
// Plans are templates with sub-plans (A, B, C). Each sub-plan has a frequency
// and individual component/variant items. Items only appear in one sub-plan.

// ------- Types -------

export interface PlanTemplate {
  id: string
  surgeon_name: string
  plan_name: string
  procedure_type: 'knee' | 'hip'
  is_default: boolean
  notes: string | null
  sub_plans: SubPlan[]
}

export interface SubPlan {
  id: string
  template_id: string
  name: string
  frequency: Frequency
  sort_order: number
  items: SubPlanItem[]
}

export interface SubPlanItem {
  id: string
  sub_plan_id: string
  component: string
  variant: string
  side: string | null
}

export type Frequency = 'every_case' | 'low' | 'medium' | 'high'

// ------- Frequency config -------

export const FREQUENCIES = [
  { id: 'every_case' as const, label: 'Every Case', description: '1 set per case', rule: '1:1' },
  { id: 'low' as const, label: 'Low', description: 'Rarely needed', rule: '1 set total' },
  { id: 'medium' as const, label: 'Medium', description: 'Occasionally needed', rule: '1 per 3 cases' },
  { id: 'high' as const, label: 'High', description: 'Frequently needed', rule: '1 per 2 cases' },
]

export function frequencySets(frequency: Frequency, caseCount: number): number {
  switch (frequency) {
    case 'every_case': return caseCount
    case 'low': return 1
    case 'medium': return Math.ceil(caseCount / 3)
    case 'high': return Math.ceil(caseCount / 2)
  }
}

// ------- Component / Variant options -------

export const KNEE_PLAN_OPTIONS = {
  femur: [
    { id: 'cr_pressfit', label: 'CR Pressfit' },
    { id: 'cr_cemented', label: 'CR Cemented' },
    { id: 'ps_pressfit', label: 'PS Pressfit' },
    { id: 'ps_cemented', label: 'PS Cemented' },
    { id: 'ps_pro_cemented', label: 'PS Pro Cemented' },
  ],
  tibia: [
    { id: 'tritanium', label: 'Tritanium Pressfit' },
    { id: 'primary', label: 'Primary Cemented' },
    { id: 'universal', label: 'Universal Cemented' },
    { id: 'mis', label: 'MIS Cemented' },
  ],
  patella: [
    { id: 'asym_pressfit', label: 'Asymmetric Pressfit' },
    { id: 'asym_cemented', label: 'Asymmetric Cemented' },
    { id: 'sym_pressfit', label: 'Symmetric Pressfit' },
    { id: 'sym_cemented', label: 'Symmetric Cemented' },
  ],
  poly: [
    { id: 'cs', label: 'CS (pairs with CR)' },
    { id: 'ps', label: 'PS (pairs with PS)' },
    { id: 'ts', label: 'TS (pairs with PS)' },
  ],
}

export const HIP_PLAN_OPTIONS = {
  stem: [
    { id: 'accolade_ii_132', label: 'Accolade II 132°' },
    { id: 'accolade_ii_127', label: 'Accolade II 127°' },
    { id: 'accolade_c_132', label: 'Accolade C 132°' },
    { id: 'accolade_c_127', label: 'Accolade C 127°' },
    { id: 'insignia_standard', label: 'Insignia Standard' },
    { id: 'insignia_high', label: 'Insignia High' },
  ],
  cup: [
    { id: 'trident_ii_tritanium', label: 'Trident II Tritanium' },
    { id: 'trident_psl_ha', label: 'Trident PSL HA' },
  ],
  liner: [
    { id: 'x3_0', label: 'X3 0°' },
    { id: 'x3_10', label: 'X3 10°' },
    { id: 'x3_0_constrained', label: 'X3 0° Constrained' },
    { id: 'x3_10_constrained', label: 'X3 10° Constrained' },
    { id: 'x3_ecc', label: 'X3 Eccentric' },
    { id: 'mdm_cocr', label: 'MDM CoCr' },
    { id: 'mdm_x3', label: 'MDM X3' },
  ],
  head: [
    { id: 'delta_ceramic', label: 'Delta Ceramic' },
    { id: 'v40_cocr', label: 'V40 CoCr' },
  ],
}

// Component labels
export const COMPONENT_LABELS: Record<string, string> = {
  femur: 'Femur', tibia: 'Tibia', patella: 'Patella', poly: 'Poly',
  stem: 'Stem', cup: 'Cup', liner: 'Liner', head: 'Head',
}

// All component options in a flat structure for easy lookup
type VariantOption = { id: string; label: string }
const ALL_OPTIONS: VariantOption[] = [
  ...KNEE_PLAN_OPTIONS.femur, ...KNEE_PLAN_OPTIONS.tibia,
  ...KNEE_PLAN_OPTIONS.patella, ...KNEE_PLAN_OPTIONS.poly,
  ...HIP_PLAN_OPTIONS.stem, ...HIP_PLAN_OPTIONS.cup,
  ...HIP_PLAN_OPTIONS.liner, ...HIP_PLAN_OPTIONS.head,
]

// Additional labels for variants not in plan options but used in inventory grid
const EXTRA_LABELS: Record<string, string> = {
  delta_universal_40mm: 'Delta Universal 40mm Head',
  v40_adapter_sleeve: 'V40 Adapter Sleeve',
  hex_6_5mm: 'Hex 6.5mm',
  torx_6_5mm: 'Torx 6.5mm',
  mdm_cocr: 'MDM CoCr',
}

export function getVariantLabel(variantId: string): string {
  return ALL_OPTIONS.find((o) => o.id === variantId)?.label ?? EXTRA_LABELS[variantId] ?? variantId
}

export function getTubName(component: string, variantId: string, side?: string): string {
  const label = getVariantLabel(variantId)
  const compLabel = COMPONENT_LABELS[component] ?? component
  const sidePrefix = side ? `${side === 'left' ? 'Left' : 'Right'} ` : ''
  return `${sidePrefix}${label} ${compLabel} Tub`
}

// Component config for UI dropdowns
export function getComponentConfig(procedureType: string): { key: string; label: string; options: VariantOption[]; hasSide?: boolean }[] {
  if (procedureType === 'hip') {
    return [
      { key: 'stem', label: 'Stem', options: HIP_PLAN_OPTIONS.stem },
      { key: 'cup', label: 'Cup', options: HIP_PLAN_OPTIONS.cup },
      { key: 'liner', label: 'Liner', options: HIP_PLAN_OPTIONS.liner },
      { key: 'head', label: 'Head', options: HIP_PLAN_OPTIONS.head },
    ]
  }
  return [
    { key: 'femur', label: 'Femur', options: KNEE_PLAN_OPTIONS.femur, hasSide: true },
    { key: 'tibia', label: 'Tibia', options: KNEE_PLAN_OPTIONS.tibia },
    { key: 'patella', label: 'Patella', options: KNEE_PLAN_OPTIONS.patella },
    { key: 'poly', label: 'Poly', options: KNEE_PLAN_OPTIONS.poly },
  ]
}
