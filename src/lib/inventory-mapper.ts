import { REF_TO_GRID_MAP, decodePatellaSize } from './knee-config'

// Hip ref patterns for inventory mapping
const HIP_RULES = {
  stems: [
    // Accolade C 127: 6057-0{size}{neck}D
    { pattern: /^6057-0(\d)\d{2}D$/, category: 'hip_stem', variant: 'accolade_c_127' },
    // Accolade C 132: 6058-0{size}{neck}D
    { pattern: /^6058-0(\d)\d{2}D$/, category: 'hip_stem', variant: 'accolade_c_132' },
    // Accolade II 132: 6720-{size}{neck} (size can be 2 digits for 10, 11)
    { pattern: /^W?6720-(\d{1,2})\d{2}$/, category: 'hip_stem', variant: 'accolade_ii_132' },
    // Accolade II 127: 6721-{size}{neck}
    { pattern: /^W?6721-(\d{1,2})\d{2}$/, category: 'hip_stem', variant: 'accolade_ii_127' },
    // Insignia Standard: 7000-55{size}
    { pattern: /^7000-55(\d{1,2})$/, category: 'hip_stem', variant: 'insignia_standard' },
    // Insignia High: 7000-66{size}
    { pattern: /^7000-66(\d{1,2})$/, category: 'hip_stem', variant: 'insignia_high' },
  ],
  cups: [
    // Trident II Tritanium: 702-04-{size}{letter}
    { pattern: /^702-04-(\d{2}[A-Z])$/, category: 'hip_cup', variant: 'Trident II Tritanium' },
    // Trident PSL HA: 542-11-{size}{letter}
    { pattern: /^542-11-(\d{2}[A-Z])$/, category: 'hip_cup', variant: 'Trident PSL HA' },
  ],
  liners: [
    // Trident X3 0°: 723-00-{ID}{letter}
    { pattern: /^723-00-(\d{2})([A-Z])$/, category: 'hip_liner_x3_0' },
    // Trident X3 10°: 723-10-{ID}{letter}
    { pattern: /^723-10-(\d{2})([A-Z])$/, category: 'hip_liner_x3_10' },
    // Trident X3 Eccentric: 763-00-{ID}{letter}
    { pattern: /^763-00-(\d{2})([A-Z])$/, category: 'hip_liner_x3_ecc' },
    // MDM CoCr: 626-00-{size}{letter}
    { pattern: /^W?626-00-(\d{2})([A-Z])$/, category: 'hip_liner_mdm_cocr' },
  ],
  mdm_x3: [
    // MDM X3 22mm: 7236-2-2{xx} or 1236-2-2{xx}
    { pattern: /^[17]236-2-2\d{2}$/, category: 'hip_liner_mdm_x3', variant: '22mm' },
    // MDM X3 28mm: 7236-2-8{xx}
    { pattern: /^7236-2-8\d{2}$/, category: 'hip_liner_mdm_x3', variant: '28mm' },
  ],
  heads: [
    // Delta Ceramic: 6570-0-{offset}{size}
    { pattern: /^6570-0-(\d)(\d{2})$/, category: 'hip_head_delta' },
    // V40 CoCr: 6260-9-{offset}{size}
    { pattern: /^6260-9-(\d)(\d{2})$/, category: 'hip_head_v40' },
  ],
  screws: [
    // Hex: 7030-65{length}
    { pattern: /^7030-65(\d{2})$/, category: 'hip_screw', variant: 'Hex 6.5mm' },
    // Torx: 2030-65{length}-1
    { pattern: /^2030-65(\d{2})-1$/, category: 'hip_screw', variant: 'Torx 6.5mm' },
  ],
}

// MDM X3 insert ref → letter lookup (from the MDM compatibility table)
const MDM_X3_LETTER_MAP: Record<string, string> = {
  '7236-2-242': 'C', '1236-2-242': 'C',
  '7236-2-244': 'D', '1236-2-244': 'D',
  '7236-2-848': 'E', '1236-2-848': 'E',
  '7236-2-852': 'F', '1236-2-852': 'F',
  '7236-2-854': 'G', '1236-2-854': 'G',
  '7236-2-858': 'H', '1236-2-858': 'H',
  '7236-2-860': 'I', '1236-2-860': 'I',
  '7236-2-864': 'J', '1236-2-864': 'J',
}

// Delta ceramic head offset decode
const DELTA_OFFSET: Record<string, string> = {
  '0': '-4', '1': '0', '2': '+4', '3': '-2.7', '4': '-2.5', '5': '+2.5', '7': '+7.5',
}

// V40 CoCr head offset decode
const V40_OFFSET: Record<string, string> = {
  '0': '-4', '1': '0', '2': '+3', '3': '+8', '4': '+12',
}

// V40 has a special case for 36mm
const V40_OFFSET_36: Record<string, string> = {
  '3': '+10',
}

// Maps a reference number to its grid position: category|variant|size
export function refToGridKey(ref: string): string | null {
  // === KNEE ===
  for (const rule of REF_TO_GRID_MAP.femur) {
    const match = ref.match(rule.pattern)
    if (match) return `${rule.category}|${rule.variant}|${match[1]}`
  }
  for (const rule of REF_TO_GRID_MAP.tibia) {
    const match = ref.match(rule.pattern)
    if (match) return `${rule.category}|${rule.variant}|${match[1]}`
  }
  for (const rule of REF_TO_GRID_MAP.patella) {
    const match = ref.match(rule.pattern)
    if (match) {
      const size = rule.sizeMap ? decodePatellaSize(match[1]) : match[1]
      return `${rule.category}|${rule.variant}|${size}`
    }
  }
  for (const rule of REF_TO_GRID_MAP.poly) {
    const match = ref.match(rule.pattern)
    if (match) {
      return `${rule.category}|${match[1]}|${parseInt(match[2]).toString()}`
    }
  }

  // === HIP ===
  // Stems
  for (const rule of HIP_RULES.stems) {
    const match = ref.match(rule.pattern)
    if (match) {
      const size = parseInt(match[1]).toString() // strip leading zero
      return `${rule.category}|${rule.variant}|${size}`
    }
  }

  // Cups
  for (const rule of HIP_RULES.cups) {
    const match = ref.match(rule.pattern)
    if (match) return `${rule.category}|${rule.variant}|${match[1]}`
  }

  // Liners (X3 and MDM CoCr): variant = "{ID}mm", size = letter
  for (const rule of HIP_RULES.liners) {
    const match = ref.match(rule.pattern)
    if (match) {
      const id = parseInt(match[1]).toString() + 'mm'
      const letter = match[2]
      if (rule.category === 'hip_liner_mdm_cocr') {
        return `${rule.category}|MDM CoCr|${letter}`
      }
      return `${rule.category}|${id}|${letter}`
    }
  }

  // MDM X3 inserts (special lookup)
  for (const rule of HIP_RULES.mdm_x3) {
    const match = ref.match(rule.pattern)
    if (match) {
      const letter = MDM_X3_LETTER_MAP[ref]
      if (letter) return `${rule.category}|${rule.variant}|${letter}`
    }
  }

  // Heads
  for (const rule of HIP_RULES.heads) {
    const match = ref.match(rule.pattern)
    if (match) {
      const diameter = parseInt(match[2]).toString() + 'mm'
      const offsetCode = match[1]
      let offset: string | undefined
      if (rule.category === 'hip_head_delta') {
        offset = DELTA_OFFSET[offsetCode]
      } else {
        // V40 36mm has special offset
        if (match[2] === '36') offset = V40_OFFSET_36[offsetCode] ?? V40_OFFSET[offsetCode]
        else offset = V40_OFFSET[offsetCode]
      }
      if (offset) return `${rule.category}|${diameter}|${offset}`
    }
  }

  // Screws
  for (const rule of HIP_RULES.screws) {
    const match = ref.match(rule.pattern)
    if (match) {
      const length = parseInt(match[1]).toString()
      return `${rule.category}|${rule.variant}|${length}`
    }
  }

  return null
}

// Build a map of grid keys → on-hand counts from inventory items
export function buildOnHandCounts(
  inventoryItems: { gtin: string | null; reference_number: string | null }[]
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const item of inventoryItems) {
    const ref = item.reference_number
    if (!ref) continue

    const key = refToGridKey(ref)
    if (key) {
      counts[key] = (counts[key] || 0) + 1
    }
  }

  return counts
}
