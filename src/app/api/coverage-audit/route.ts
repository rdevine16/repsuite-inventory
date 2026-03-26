import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { calculateDailyCoverage } from '@/lib/daily-coverage'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId')
    const date = searchParams.get('date')

    if (!facilityId || !date) {
      return NextResponse.json(
        { error: 'facilityId and date are required' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()
    const result = await calculateDailyCoverage(supabase, facilityId, date)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Coverage audit error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
