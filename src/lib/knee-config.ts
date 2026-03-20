// Knee implant grid configuration
// Each section has either fixationGroups (femurs, tibias, patella) or flat variants (polys)

export const KNEE_SECTIONS = [
  {
    id: 'knee_femur',
    label: 'Femoral Components',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [
          { id: 'right_cr_cemented', label: 'CR Right' },
          { id: 'left_cr_cemented', label: 'CR Left' },
          { id: 'right_ps_cemented', label: 'PS Right' },
          { id: 'left_ps_cemented', label: 'PS Left' },
          { id: 'right_ps_pro_cemented', label: 'PS Pro Right' },
          { id: 'left_ps_pro_cemented', label: 'PS Pro Left' },
        ],
      },
      {
        label: 'Pressfit',
        variants: [
          { id: 'right_cr_pressfit', label: 'CR Right' },
          { id: 'left_cr_pressfit', label: 'CR Left' },
          { id: 'right_ps_pressfit', label: 'PS Right' },
          { id: 'left_ps_pressfit', label: 'PS Left' },
        ],
      },
    ],
    sizes: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  {
    id: 'knee_tibia',
    label: 'Tibial Baseplates',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [
          { id: 'primary', label: 'Primary' },
          { id: 'universal', label: 'Universal' },
          { id: 'mis', label: 'MIS' },
        ],
      },
      {
        label: 'Pressfit',
        variants: [
          { id: 'tritanium', label: 'Tritanium' },
        ],
      },
    ],
    sizes: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  {
    id: 'knee_patella',
    label: 'Patella',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [
          { id: 'asym_cemented', label: 'Asymmetric' },
          { id: 'sym_cemented', label: 'Symmetric' },
        ],
      },
      {
        label: 'Pressfit',
        variants: [
          { id: 'asym_pressfit', label: 'Asymmetric' },
          { id: 'sym_pressfit', label: 'Symmetric' },
        ],
      },
    ],
    sizes: ['27', '29', '31', '32', '33', '35', '36', '38', '39', '40'],
    // Not all sizes apply to all variants
    sizesByVariant: {
      asym_cemented: ['29', '32', '35', '38', '40'],
      asym_pressfit: ['29', '32', '35', '38', '40'],
      sym_cemented: ['27', '29', '31', '33', '36', '39'],
      sym_pressfit: ['29', '31', '33', '36', '39'],
    } as Record<string, string[]>,
  },
  {
    id: 'knee_poly_cs',
    label: 'Poly Inserts — CS',
    fixationGroups: null,
    sizeLabel: 'Thickness',
    rowLabel: 'Size',
    variants: ['1', '2', '3', '4', '5', '6', '7', '8'],
    sizes: ['9', '10', '11', '12', '13', '14', '16', '19'],
  },
  {
    id: 'knee_poly_ps',
    label: 'Poly Inserts — PS',
    fixationGroups: null,
    sizeLabel: 'Thickness',
    rowLabel: 'Size',
    variants: ['1', '2', '3', '4', '5', '6', '7', '8'],
    sizes: ['9', '10', '11', '12', '13', '14', '16', '19'],
  },
  {
    id: 'knee_poly_ts',
    label: 'Poly Inserts — TS',
    fixationGroups: null,
    sizeLabel: 'Thickness',
    rowLabel: 'Size',
    variants: ['1', '2', '3', '4', '5', '6', '7', '8'],
    sizes: ['9', '11', '13', '16', '19', '22', '25', '28', '31'],
  },
] as const

export type KneeSection = (typeof KNEE_SECTIONS)[number]

// Reference number → grid position mapping for inventory counting
// Maps product catalog ref patterns to category|variant|size keys
export const REF_TO_GRID_MAP = {
  // Femoral Components
  // 5510 = CR Cemented, 5517 = CR Pressfit, 5515 = PS Cemented, 8515 = PS Pro Cemented
  // Last 2 digits: 01 = Left, 02 = Right
  femur: [
    { pattern: /^5510-F-(\d)01$/, category: 'knee_femur', variant: 'left_cr_cemented' },
    { pattern: /^5510-F-(\d)02$/, category: 'knee_femur', variant: 'right_cr_cemented' },
    { pattern: /^5517-F-(\d)01$/, category: 'knee_femur', variant: 'left_cr_pressfit' },
    { pattern: /^5517-F-(\d)02$/, category: 'knee_femur', variant: 'right_cr_pressfit' },
    { pattern: /^5515-F-(\d)01$/, category: 'knee_femur', variant: 'left_ps_cemented' },
    { pattern: /^5515-F-(\d)02$/, category: 'knee_femur', variant: 'right_ps_cemented' },
    { pattern: /^W5515-F-(\d)01$/, category: 'knee_femur', variant: 'left_ps_cemented' },
    { pattern: /^8515-F-(\d)01$/, category: 'knee_femur', variant: 'left_ps_pro_cemented' },
    { pattern: /^8515-F-(\d)02$/, category: 'knee_femur', variant: 'right_ps_pro_cemented' },
  ],

  // Tibial Baseplates
  // 5520-B = Primary (Cemented), 5521-B = Universal (Cemented), 5520-M = MIS (Cemented), 5536-B = Tritanium (Pressfit)
  tibia: [
    { pattern: /^5520-B-(\d)00$/, category: 'knee_tibia', variant: 'primary' },
    { pattern: /^W5520-B-(\d)00$/, category: 'knee_tibia', variant: 'primary' },
    { pattern: /^5521-B-(\d)00$/, category: 'knee_tibia', variant: 'universal' },
    { pattern: /^W5521-B-(\d)00$/, category: 'knee_tibia', variant: 'universal' },
    { pattern: /^5520-M-(\d)00$/, category: 'knee_tibia', variant: 'mis' },
    { pattern: /^5536-B-(\d)00$/, category: 'knee_tibia', variant: 'tritanium' },
    { pattern: /^W5536-B-(\d)00$/, category: 'knee_tibia', variant: 'tritanium' },
  ],

  // Patella
  // 5551-G = Asymmetric Cemented, 5552-L = Asymmetric Pressfit, 5550-G = Symmetric Cemented
  // Size encoded as 3 digits: 299→29, 320→32, 350→35, 381→38, 401→40, 278→27
  patella: [
    { pattern: /^5551-G-(\d{3})-E$/, category: 'knee_patella', variant: 'asym_cemented', sizeMap: true },
    { pattern: /^5552-L-(\d{3})$/, category: 'knee_patella', variant: 'asym_pressfit', sizeMap: true },
    { pattern: /^5550-G-(\d{3})-E$/, category: 'knee_patella', variant: 'sym_cemented', sizeMap: true },
  ],

  // Poly Inserts
  // 5531-G = CS X3, 5531-P = CS Poly, 5531-T = CS Trial
  // 5532-G = PS X3
  // Pattern: {prefix}-{letter}-{size}{thickness}
  poly: [
    { pattern: /^5531-[GPT]-(\d)(\d{2})/, category: 'knee_poly_cs' },
    { pattern: /^5532-[GPT]-(\d)(\d{2})/, category: 'knee_poly_ps' },
    { pattern: /^5537-[GPT]-(\d)(\d{2})/, category: 'knee_poly_ts' },
  ],
}

// Decode patella 3-digit size to display size
export function decodePatellaSize(threeDigit: string): string {
  const num = parseInt(threeDigit)
  // 299→29, 320→32, 350→35, 381→38, 401→40, 278→27
  // Pattern: first 2 digits = size, last digit varies
  if (num >= 270 && num < 280) return '27'
  if (num >= 290 && num < 300) return '29'
  if (num >= 310 && num < 320) return '31'
  if (num >= 320 && num < 330) return '32'
  if (num >= 330 && num < 340) return '33'
  if (num >= 350 && num < 360) return '35'
  if (num >= 360 && num < 370) return '36'
  if (num >= 380 && num < 390) return '38'
  if (num >= 390 && num < 400) return '39'
  if (num >= 400 && num < 410) return '40'
  return threeDigit
}
