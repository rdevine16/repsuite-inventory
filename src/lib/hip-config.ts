// Hip implant grid configuration

export const HIP_SECTIONS = [
  {
    id: 'hip_stem',
    label: 'Stems',
    fixationGroups: [
      {
        label: 'Cemented',
        variants: [
          { id: 'accolade_c_127', label: 'Accolade C 127°' },
          { id: 'accolade_c_132', label: 'Accolade C 132°' },
        ],
        sizes: ['2', '3', '4', '5', '6', '7'],
      },
      {
        label: 'Pressfit',
        variants: [
          { id: 'accolade_ii_127', label: 'Accolade II 127°' },
          { id: 'accolade_ii_132', label: 'Accolade II 132°' },
          { id: 'insignia_standard', label: 'Insignia Standard' },
          { id: 'insignia_high', label: 'Insignia High' },
        ],
        sizes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      },
    ],
    sizes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
  },
  {
    id: 'hip_cup',
    label: 'Cups',
    fixationGroups: null,
    rowLabel: 'Type',
    sizeLabel: '',
    variants: ['Trident II Tritanium', 'Trident PSL HA'],
    sizes: ['42A', '44B', '46C', '48D', '50D', '52E', '54E', '56F', '58F', '60G', '62G', '64H', '66H'],
    sizesByVariant: {
      'Trident PSL HA': ['46D', '50E', '52E'],
    } as Record<string, string[]>,
  },
  {
    id: 'hip_liner_x3_0',
    label: 'Liners — X3 0°',
    fixationGroups: null,
    rowLabel: 'ID',
    sizeLabel: '',
    variants: ['22mm', '28mm', '32mm', '36mm', '40mm', '44mm'],
    sizes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  },
  {
    id: 'hip_liner_x3_10',
    label: 'Liners — X3 10°',
    fixationGroups: null,
    rowLabel: 'ID',
    sizeLabel: '',
    variants: ['22mm', '26mm', '28mm', '32mm', '36mm'],
    sizes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  },
  {
    id: 'hip_liner_x3_ecc',
    label: 'Liners — X3 Eccentric 0°',
    fixationGroups: null,
    rowLabel: 'ID',
    sizeLabel: '',
    variants: ['28mm', '32mm', '36mm'],
    sizes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  },
  {
    id: 'hip_liner_mdm_cocr',
    label: 'Liners — MDM CoCr',
    fixationGroups: null,
    rowLabel: '',
    sizeLabel: '',
    variants: ['MDM CoCr'],
    sizes: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  },
  {
    id: 'hip_liner_mdm_x3',
    label: 'Liners — MDM X3',
    fixationGroups: null,
    rowLabel: 'ID',
    sizeLabel: '',
    variants: ['22mm', '28mm'],
    sizes: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    sizesByVariant: {
      '22mm': ['C', 'D'],
    } as Record<string, string[]>,
  },
  {
    id: 'hip_head_delta',
    label: 'Heads — Delta Ceramic',
    fixationGroups: null,
    rowLabel: 'Diameter',
    sizeLabel: '',
    variants: ['28mm', '32mm', '36mm'],
    sizes: ['-5', '-4', '-2.7', '-2.5', '0', '+2.5', '+4', '+5', '+7.5'],
    sizesByVariant: {
      '28mm': ['-4', '-2.7', '0', '+4'],
      '32mm': ['-4', '0', '+4'],
      '36mm': ['-5', '-2.5', '0', '+2.5', '+5', '+7.5'],
    } as Record<string, string[]>,
  },
  {
    id: 'hip_head_v40',
    label: 'Heads — V40 CoCr',
    fixationGroups: null,
    rowLabel: 'Diameter',
    sizeLabel: '',
    variants: ['22mm', '28mm', '32mm', '36mm', '40mm'],
    sizes: ['-4', '0', '+3', '+8', '+10', '+12'],
    sizesByVariant: {
      '22mm': ['0', '+3', '+8'],
      '28mm': ['+8'],
      '32mm': ['+8', '+12'],
      '36mm': ['+10'],
      '40mm': ['-4', '+8', '+12'],
    } as Record<string, string[]>,
  },
  {
    id: 'hip_screw',
    label: 'Screws',
    fixationGroups: null,
    rowLabel: 'Type',
    sizeLabel: '',
    variants: ['Hex 6.5mm', 'Torx 6.5mm'],
    sizes: ['15', '16', '20', '25', '30', '35', '40', '45', '50', '55', '60'],
    sizesByVariant: {
      'Hex 6.5mm': ['15', '20', '25', '30', '35', '40', '45', '50', '55', '60'],
      'Torx 6.5mm': ['16', '20', '25', '30', '35', '40', '45', '50', '55', '60'],
    } as Record<string, string[]>,
  },
] as const

export type HipSection = (typeof HIP_SECTIONS)[number]
