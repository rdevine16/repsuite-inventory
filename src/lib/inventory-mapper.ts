import { REF_TO_GRID_MAP, decodePatellaSize } from './knee-config'

// Maps a reference number to its grid position: category|variant|size
export function refToGridKey(ref: string): string | null {
  // Femurs
  for (const rule of REF_TO_GRID_MAP.femur) {
    const match = ref.match(rule.pattern)
    if (match) {
      return `${rule.category}|${rule.variant}|${match[1]}`
    }
  }

  // Tibias
  for (const rule of REF_TO_GRID_MAP.tibia) {
    const match = ref.match(rule.pattern)
    if (match) {
      return `${rule.category}|${rule.variant}|${match[1]}`
    }
  }

  // Patella
  for (const rule of REF_TO_GRID_MAP.patella) {
    const match = ref.match(rule.pattern)
    if (match) {
      const size = rule.sizeMap ? decodePatellaSize(match[1]) : match[1]
      return `${rule.category}|${rule.variant}|${size}`
    }
  }

  // Polys (capture group 1 = size, group 2 = thickness)
  for (const rule of REF_TO_GRID_MAP.poly) {
    const match = ref.match(rule.pattern)
    if (match) {
      const size = match[1]
      const thickness = parseInt(match[2]).toString() // strip leading zero: '09' → '9'
      return `${rule.category}|${size}|${thickness}`
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
