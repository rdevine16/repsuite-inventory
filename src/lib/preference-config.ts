// Component options for surgeon preferences
// Maps procedure types to their components and available variant systems

export const PROCEDURE_TYPES = [
  { id: 'knee', label: 'Knee' },
  { id: 'hip', label: 'Hip' },
]

export const COMPONENTS: Record<string, { id: string; label: string; variants: { id: string; label: string }[] }[]> = {
  knee: [
    {
      id: 'knee_femur',
      label: 'Femoral Component',
      variants: [
        { id: 'cr_pressfit', label: 'CR Pressfit' },
        { id: 'cr_cemented', label: 'CR Cemented' },
        { id: 'ps_pressfit', label: 'PS Pressfit' },
        { id: 'ps_cemented', label: 'PS Cemented' },
        { id: 'ps_pro_cemented', label: 'PS Pro Cemented' },
      ],
    },
    {
      id: 'knee_tibia',
      label: 'Tibial Baseplate',
      variants: [
        { id: 'primary', label: 'Primary Cemented' },
        { id: 'universal', label: 'Universal Cemented' },
        { id: 'mis', label: 'MIS Cemented' },
        { id: 'tritanium', label: 'Tritanium Pressfit' },
      ],
    },
    {
      id: 'knee_poly',
      label: 'Poly Insert',
      variants: [
        { id: 'cs', label: 'CS (CR)' },
        { id: 'ps', label: 'PS' },
        { id: 'ts', label: 'TS' },
      ],
    },
    {
      id: 'knee_patella',
      label: 'Patella',
      variants: [
        { id: 'asym_cemented', label: 'Asymmetric Cemented' },
        { id: 'sym_cemented', label: 'Symmetric Cemented' },
        { id: 'asym_pressfit', label: 'Asymmetric Pressfit' },
      ],
    },
    {
      id: 'knee_tibial_stem',
      label: 'Tibial Stem',
      variants: [
        { id: 'cemented', label: 'Cemented' },
      ],
    },
  ],
  hip: [
    {
      id: 'hip_stem',
      label: 'Stem',
      variants: [
        { id: 'accolade_ii_132', label: 'Accolade II 132°' },
        { id: 'accolade_ii_127', label: 'Accolade II 127°' },
        { id: 'accolade_c_132', label: 'Accolade C 132°' },
        { id: 'accolade_c_127', label: 'Accolade C 127°' },
        { id: 'insignia_standard', label: 'Insignia Standard' },
        { id: 'insignia_high', label: 'Insignia High' },
      ],
    },
    {
      id: 'hip_cup',
      label: 'Cup',
      variants: [
        { id: 'trident_ii_tritanium', label: 'Trident II Tritanium' },
        { id: 'trident_psl_ha', label: 'Trident PSL HA' },
      ],
    },
    {
      id: 'hip_liner',
      label: 'Liner',
      variants: [
        { id: 'x3_0', label: 'X3 0°' },
        { id: 'x3_10', label: 'X3 10°' },
        { id: 'x3_ecc', label: 'X3 Eccentric' },
        { id: 'mdm_cocr', label: 'MDM CoCr' },
        { id: 'mdm_x3', label: 'MDM X3' },
      ],
    },
    {
      id: 'hip_head',
      label: 'Head',
      variants: [
        { id: 'delta_ceramic', label: 'Delta Ceramic' },
        { id: 'v40_cocr', label: 'V40 CoCr' },
      ],
    },
  ],
}
