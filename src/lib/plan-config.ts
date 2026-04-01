// Implant plan configuration
// Defines plan template structure, component variant options, and tub mapping
//
// Plans are reusable templates: a surgeon can have multiple named plans.
// Each case gets assigned one plan. The coverage engine reads the plan
// from each case to calculate sets needed.

export interface ImplantPlanTemplate {
  id: string
  surgeon_name: string
  plan_name: string
  procedure_type: 'knee' | 'hip'
  is_default: boolean
  // Primary
  femur_variant: string | null
  tibia_variant: string | null
  patella_variant: string | null
  poly_variants: string[]
  // Cemented fallback (1:1 with primary)
  cemented_femur_variant: string | null
  cemented_tibia_variant: string | null
  cemented_patella_variant: string | null
  // Clinical alternate
  has_clinical_alternate: boolean
  alt_femur_variant: string | null
  alt_tibia_variant: string | null
  alt_patella_variant: string | null
  alt_poly_variants: string[]
  alt_conversion_likelihood: ConversionLikelihood | null
  notes: string | null
}

export const CONVERSION_LIKELIHOODS = [
  { id: 'low', label: 'Low', description: 'Rarely switches (~1 in 20 cases)', rule: 'Always 1 set' },
  { id: 'medium', label: 'Medium', description: 'Occasionally switches (~1 in 5)', rule: '1 set per 3 cases' },
  { id: 'high', label: 'High', description: 'Frequently switches (~1 in 3)', rule: '1 set per 2 cases' },
] as const

export type ConversionLikelihood = (typeof CONVERSION_LIKELIHOODS)[number]['id']

// Calculate sets needed for clinical alternate based on likelihood and case count
export function clinicalAlternateSets(likelihood: ConversionLikelihood, caseCount: number): number {
  switch (likelihood) {
    case 'low': return 1
    case 'medium': return Math.ceil(caseCount / 3)
    case 'high': return Math.ceil(caseCount / 2)
  }
}

// Variant options per component for the plan builder
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
    { id: 'x3_ecc', label: 'X3 Eccentric' },
    { id: 'mdm_cocr', label: 'MDM CoCr' },
    { id: 'mdm_x3', label: 'MDM X3' },
  ],
  head: [
    { id: 'delta_ceramic', label: 'Delta Ceramic' },
    { id: 'v40_cocr', label: 'V40 CoCr' },
  ],
}

// Component labels for display
export const COMPONENT_LABELS: Record<string, string> = {
  femur: 'Femur',
  tibia: 'Tibia',
  patella: 'Patella',
  poly: 'Poly',
  stem: 'Stem',
  cup: 'Cup',
  liner: 'Liner',
  head: 'Head',
}

// Get variant label by id across all components
export function getVariantLabel(variantId: string): string {
  const allOptions = [
    ...KNEE_PLAN_OPTIONS.femur,
    ...KNEE_PLAN_OPTIONS.tibia,
    ...KNEE_PLAN_OPTIONS.patella,
    ...KNEE_PLAN_OPTIONS.poly,
    ...HIP_PLAN_OPTIONS.stem,
    ...HIP_PLAN_OPTIONS.cup,
    ...HIP_PLAN_OPTIONS.liner,
    ...HIP_PLAN_OPTIONS.head,
  ]
  return allOptions.find((o) => o.id === variantId)?.label ?? variantId
}

// Map variant to physical tub name
export function getTubName(component: string, variantId: string, side?: string): string {
  const label = getVariantLabel(variantId)
  const compLabel = COMPONENT_LABELS[component] ?? component
  const sidePrefix = side ? `${side === 'left' ? 'Left' : 'Right'} ` : ''
  return `${sidePrefix}${label} ${compLabel} Tub`
}

// Size definitions per variant for counting complete sets
export const SET_SIZES: Record<string, string[]> = {
  // Knee femurs — 8 sizes per side
  cr_pressfit: ['1', '2', '3', '4', '5', '6', '7', '8'],
  cr_cemented: ['1', '2', '3', '4', '5', '6', '7', '8'],
  ps_pressfit: ['1', '2', '3', '4', '5', '6', '7', '8'],
  ps_cemented: ['1', '2', '3', '4', '5', '6', '7', '8'],
  ps_pro_cemented: ['1', '2', '3', '4', '5', '6', '7', '8'],
  // Knee tibias
  tritanium: ['1', '2', '3', '4', '5', '6', '7', '8'],
  primary: ['1', '2', '3', '4', '5', '6', '7', '8'],
  universal: ['1', '2', '3', '4', '5', '6', '7', '8'],
  mis: ['1', '2', '3', '4', '5', '6', '7', '8'],
  // Knee patellas
  asym_pressfit: ['29', '32', '35', '38', '40'],
  asym_cemented: ['29', '32', '35', '38', '40'],
  sym_pressfit: ['29', '31', '33', '36', '39'],
  sym_cemented: ['27', '29', '31', '33', '36', '39'],
  // Polys — sizes are knee sizes (1-8), each with multiple thicknesses
  cs: ['1', '2', '3', '4', '5', '6', '7', '8'],
  ps: ['1', '2', '3', '4', '5', '6', '7', '8'],
  ts: ['1', '2', '3', '4', '5', '6', '7', '8'],
}
