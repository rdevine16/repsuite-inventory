import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabase = getAdminClient()

    // Get today's date in Eastern time
    const eastern = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const nowET = eastern.format(new Date())
    const [emm, edd, eyyyy] = nowET.split('/')
    const todayStart = new Date(`${eyyyy}-${emm}-${edd}T00:00:00-04:00`)
    const todayEnd = new Date(`${eyyyy}-${emm}-${edd}T23:59:59-04:00`)
    const tomorrowEnd = new Date(todayEnd)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

    // Count today's cases by facility
    const { data: todayCases } = await supabase
      .from('cases')
      .select('id, facility_id, status')
      .gte('surgery_date', todayStart.toISOString())
      .lt('surgery_date', todayEnd.toISOString())
      .neq('status', 'Cancelled')

    const { data: tomorrowCases } = await supabase
      .from('cases')
      .select('id')
      .gte('surgery_date', todayEnd.toISOString())
      .lt('surgery_date', tomorrowEnd.toISOString())
      .neq('status', 'Cancelled')

    // Count active alerts
    const { count: alertCount } = await supabase
      .from('inventory_alerts')
      .select('id', { count: 'exact', head: true })

    // Count items needing source
    const { count: needsSourceCount } = await supabase
      .from('case_usage_items')
      .select('id', { count: 'exact', head: true })
      .is('source_location', null)
      .is('user_source_facility_id', null)
      .neq('current_status', 'deducted')

    // Count unread notifications
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)

    // Get distinct facilities for today
    const facilityIds = [...new Set((todayCases ?? []).map((c) => c.facility_id).filter(Boolean))]
    const { data: facilityNames } = await supabase
      .from('facilities')
      .select('id, name')
      .in('id', facilityIds.length > 0 ? facilityIds : ['none'])

    const facilityCount = facilityIds.length
    const caseCount = todayCases?.length ?? 0
    const tomorrowCount = tomorrowCases?.length ?? 0

    // Build digest
    const lines: string[] = []
    lines.push(`Today: ${caseCount} case${caseCount === 1 ? '' : 's'}${facilityCount > 0 ? ` at ${facilityCount} facilit${facilityCount === 1 ? 'y' : 'ies'}` : ''}`)

    if (tomorrowCount > 0) {
      lines.push(`Tomorrow: ${tomorrowCount} case${tomorrowCount === 1 ? '' : 's'}`)
    }

    if ((alertCount ?? 0) > 0) {
      lines.push(`${alertCount} inventory alert${(alertCount ?? 0) === 1 ? '' : 's'}`)
    }

    if ((needsSourceCount ?? 0) > 0) {
      lines.push(`${needsSourceCount} item${(needsSourceCount ?? 0) === 1 ? '' : 's'} need source`)
    }

    const title = 'Good Morning'
    const body = lines.join(' • ')

    // Save notification
    await supabase.from('notifications').insert({
      title,
      body,
      type: 'digest',
      priority: 'info',
      expires_at: new Date(Date.now() + 2 * 86400000).toISOString(), // 2 day expiry
    })

    // Send push
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    await fetch(`${baseUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, data: { type: 'digest' } }),
    })

    return NextResponse.json({ success: true, title, body })
  } catch (err) {
    console.error('Morning digest error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
