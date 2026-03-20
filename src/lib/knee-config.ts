// Knee implant grid configuration
// category → fixation groups → variants (rows) × sizes (columns)

export const KNEE_SECTIONS = [
  {
    id: 'knee_femur',
    label: 'Femoral Components',
    fixationGroups: [
      {
        label: 'CR Cemented',
        variants: [
          { id: 'right_cr_cemented', label: 'Right' },
          { id: 'left_cr_cemented', label: 'Left' },
        ],
      },
      {
        label: 'CR Pressfit',
        variants: [
          { id: 'right_cr_pressfit', label: 'Right' },
          { id: 'left_cr_pressfit', label: 'Left' },
        ],
      },
      {
        label: 'PS Cemented',
        variants: [
          { id: 'right_ps_cemented', label: 'Right' },
          { id: 'left_ps_cemented', label: 'Left' },
        ],
      },
      {
        label: 'PS Pressfit',
        variants: [
          { id: 'right_ps_pressfit', label: 'Right' },
          { id: 'left_ps_pressfit', label: 'Left' },
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
        variants: [{ id: 'cemented', label: 'Cemented' }],
      },
      {
        label: 'Pressfit',
        variants: [{ id: 'pressfit', label: 'Pressfit' }],
      },
    ],
    sizes: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  {
    id: 'knee_patella_asym',
    label: 'Patella — Asymmetric',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [{ id: 'cemented', label: 'Cemented' }],
      },
      {
        label: 'Pressfit',
        variants: [{ id: 'pressfit', label: 'Pressfit' }],
      },
    ],
    sizes: ['29', '32', '35', '38', '40'],
  },
  {
    id: 'knee_patella_sym',
    label: 'Patella — Symmetric',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [{ id: 'cemented', label: 'Cemented' }],
      },
      {
        label: 'Pressfit',
        variants: [{ id: 'pressfit', label: 'Pressfit' }],
      },
    ],
    sizes: ['27', '29', '31', '33', '36', '39'],
    sizeExclusions: {
      pressfit: ['27'],
    },
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
