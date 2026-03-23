import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { runInventoryCheck } from '@/lib/inventory-check'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST() {
  try {
    const supabase = getAdminClient()
    const alertCount = await runInventoryCheck(supabase)
    return NextResponse.json({ success: true, total: alertCount })
  } catch (err) {
    console.error('Inventory check error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
