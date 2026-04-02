import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildOnHandCounts } from '@/lib/inventory-mapper'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Returns all distinct sizes found in facility_inventory for a given grid category + variant
// e.g., GET /api/inventory-sizes?category=hip_cup&variant=trident_ii_tritanium
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const variant = searchParams.get('variant')

    if (!category || !variant) {
      return NextResponse.json({ error: 'category and variant required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Get ALL inventory across all facilities
    const { data: items } = await supabase
      .from('facility_inventory')
      .select('gtin, reference_number')

    if (!items || items.length === 0) {
      return NextResponse.json({ sizes: [] })
    }

    // Build on-hand counts and extract matching sizes
    const counts = buildOnHandCounts(items)
    const sizes: { size: string; count: number }[] = []

    // Try exact category|variant|size match first
    const prefix = `${category}|${variant}|`
    for (const [key, count] of Object.entries(counts)) {
      if (key.startsWith(prefix)) {
        const size = key.slice(prefix.length)
        sizes.push({ size, count })
      }
    }

    // If no exact match, try category-wide: find all keys starting with category|
    // This handles liners/heads where the "variant" in grid is a sub-dimension (e.g., 22mm, 28mm)
    if (sizes.length === 0) {
      const catPrefix = `${category}|`
      for (const [key, count] of Object.entries(counts)) {
        if (key.startsWith(catPrefix)) {
          // key format: category|subVariant|size — combine subVariant+size as the "size" identifier
          const rest = key.slice(catPrefix.length)
          sizes.push({ size: rest.replace('|', ' / '), count })
        }
      }
    }

    // Sort sizes naturally
    sizes.sort((a, b) => {
      const aNum = parseInt(a.size)
      const bNum = parseInt(b.size)
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
      return a.size.localeCompare(b.size)
    })

    return NextResponse.json({ sizes })
  } catch (err) {
    console.error('Inventory sizes error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
