import { buildOnHandCounts } from '@/lib/inventory-mapper'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Alert {
  facility_id: string
  facility_name: string
  surgeon_name: string
  surgery_date: string
  case_id: string
  component: string
  variant: string
  missing_sizes: string[]
  on_hand: Record<string, number>
  threshold: Record<string, number>
}

// Maps preference variant IDs to inventory grid variant IDs
function expandVariantToGridKeys(component: string, variant: string): string[] {
  if (component === 'knee_femur') {
    return [`right_${variant}`, `left_${variant}`]
  }
  return [variant]
}

// Poly inserts are a 2D grid: category=knee_poly_cs, variant=kneeSize(1-8), size=thickness(9-19)
// The preference just says "cs" — we need to check each knee size has at least one thickness
// Returns { category, sizes, isPolyStyle } to handle the different grid structure
function getCheckConfig(component: string, variant: string): {
  category: string
  sizes: string[]
  isPolyStyle: boolean
  polyThicknesses?: string[]
} {
  // Polys: preference component=knee_poly, variant=cs/ps/ts
  // Grid: category=knee_poly_cs, variant=1-8 (knee size), size=9-19 (thickness)
  if (component === 'knee_poly') {
    const cat = `knee_poly_${variant}`
    const thicknesses = variant === 'ts'
      ? ['9', '11', '13', '16', '19', '22', '25', '28', '31']
      : ['9', '10', '11', '12', '13', '14', '16', '19']
    return {
      category: cat,
      sizes: ['1', '2', '3', '4', '5', '6', '7', '8'],
      isPolyStyle: true,
      polyThicknesses: thicknesses,
    }
  }

  // Patella: sizes depend on variant
  if (component === 'knee_patella') {
    const sizeMap: Record<string, string[]> = {
      asym_cemented: ['29', '32', '35', '38', '40'],
      sym_cemented: ['27', '29', '31', '33', '36', '39'],
      asym_pressfit: ['29', '32', '35', '38', '40'],
      sym_pressfit: ['29', '31', '33', '36', '39'],
    }
    return { category: component, sizes: sizeMap[variant] ?? ['29', '32', '35', '38'], isPolyStyle: false }
  }

  const sizeMap: Record<string, string[]> = {
    knee_femur: ['1', '2', '3', '4', '5', '6', '7', '8'],
    knee_tibia: ['1', '2', '3', '4', '5', '6', '7', '8'],
    hip_stem: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    hip_cup: ['42A', '44B', '46C', '48D', '50D', '52E', '54E', '56F', '58F', '60G', '62G'],
    hip_liner: ['28mm', '32mm', '36mm', '40mm'],
    hip_head: ['28mm', '32mm', '36mm'],
  }
  return { category: component, sizes: sizeMap[component] ?? [], isPolyStyle: false }
}

function getKitName(component: string, variant: string): string {
  // variant may include side prefix like "Left cr_pressfit"
  const variantLabels: Record<string, string> = {
    cr_pressfit: 'CR Pressfit',
    cr_cemented: 'CR Cemented',
    ps_pressfit: 'PS Pressfit',
    ps_cemented: 'PS Cemented',
    ps_pro_cemented: 'PS Pro',
  }

  const componentLabels: Record<string, string> = {
    knee_femur: 'Femoral Tub',
    knee_tibia: 'Tibial Tub',
    knee_poly: 'Insert Tub',
    knee_patella: 'Patella Tub',
    hip_stem: 'Stem Tub',
    hip_cup: 'Cup Tub',
    hip_liner: 'Liner Tub',
    hip_head: 'Head Tub',
  }

  // Parse side from variant if present
  const sideMatch = variant.match(/^(Left |Right )(.+)$/)
  const side = sideMatch ? sideMatch[1] : ''
  const variantId = sideMatch ? sideMatch[2] : variant

  const variantLabel = variantLabels[variantId] ?? variantId
  const compLabel = componentLabels[component] ?? `${component} Tub`

  return `${side}${variantLabel} ${compLabel}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runInventoryCheck(supabase: SupabaseClient<any, any, any>): Promise<number> {
  // Get facilities with smart tracking enabled
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('smart_tracking_enabled', true)

  if (!facilities || facilities.length === 0) return 0

  const facilityIds = facilities.map((f) => f.id)
  const facilityMap = Object.fromEntries(facilities.map((f) => [f.id, f.name]))

  // Get today's and tomorrow's cases (Eastern timezone)
  const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
  const nowET = eastern.format(new Date())
  const [emm, edd, eyyyy] = nowET.split('/')
  const todayDate = new Date(`${eyyyy}-${emm}-${edd}T00:00:00-04:00`)
  const dayAfterTomorrow = new Date(todayDate)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

  const { data: upcomingCases } = await supabase
    .from('cases')
    .select('id, case_id, facility_id, surgeon_name, surgery_date, procedure_name')
    .in('facility_id', facilityIds)
    .gte('surgery_date', todayDate.toISOString())
    .lt('surgery_date', dayAfterTomorrow.toISOString())
    .neq('status', 'Completed')

  if (!upcomingCases || upcomingCases.length === 0) return 0

  // Get surgeon preferences
  const surgeonNames = [...new Set(upcomingCases.map((c) => c.surgeon_name).filter(Boolean))]
  const { data: preferences } = await supabase
    .from('surgeon_preferences')
    .select('*')
    .in('surgeon_name', surgeonNames)
    .order('priority')

  if (!preferences || preferences.length === 0) return 0

  // Get alert thresholds
  const { data: thresholds } = await supabase
    .from('alert_thresholds')
    .select('category, variant, size, min_quantity')

  const thresholdMap: Record<string, number> = {}
  thresholds?.forEach((t) => {
    thresholdMap[`${t.category}|${t.variant}|${t.size}`] = t.min_quantity
  })

  const alerts: Alert[] = []

  for (const facilityId of facilityIds) {
    const facilityCases = upcomingCases.filter((c) => c.facility_id === facilityId)
    if (facilityCases.length === 0) continue

    const { data: inventoryItems } = await supabase
      .from('facility_inventory')
      .select('gtin, reference_number')
      .eq('facility_id', facilityId)

    if (!inventoryItems || inventoryItems.length === 0) continue

    const onHandCounts = buildOnHandCounts(inventoryItems)

    // Also count loaner kit parts shipped to this facility
    // Loaner kits stay at the facility even after a case completes — only the
    // actually-used implants get deducted from facility_inventory. So we count
    // loaner parts from ALL cases (including completed) as available inventory.
    const { data: facilityCaseSfIds } = await supabase
      .from('cases')
      .select('sf_id')
      .eq('facility_id', facilityId)

    const sfIds = facilityCaseSfIds?.map((c) => c.sf_id).filter(Boolean) ?? []

    if (sfIds.length > 0) {
      const { data: caseParts } = await supabase
        .from('case_parts')
        .select('catalog_number, quantity, is_loaner')
        .in('case_sf_id', sfIds)
        .eq('is_loaner', true)

      if (caseParts) {
        const kitItems = caseParts
          .filter((p) => p.catalog_number)
          .map((p) => ({ gtin: null, reference_number: p.catalog_number }))

        const kitCounts = buildOnHandCounts(kitItems)
        for (const [key, count] of Object.entries(kitCounts)) {
          onHandCounts[key] = (onHandCounts[key] ?? 0) + count
        }
      }
    }

    // Deduplicate: only check each surgeon+side combo once per facility
    const checkedKeys = new Set<string>()

    for (const caseRow of facilityCases) {
      if (!caseRow.surgeon_name) continue

      const procName = (caseRow.procedure_name ?? '').toLowerCase()
      const procedureType = procName.includes('hip') ? 'hip' : 'knee'

      // Determine side from procedure name
      const side = procName.includes('left') ? 'left' : procName.includes('right') ? 'right' : null

      const checkKey = `${caseRow.surgeon_name}|${procedureType}|${side}`
      if (checkedKeys.has(checkKey)) continue
      checkedKeys.add(checkKey)

      const surgeonPrefs = preferences.filter(
        (p) => p.surgeon_name === caseRow.surgeon_name && p.procedure_type === procedureType
      )

      if (surgeonPrefs.length === 0) continue

      const byComponent: Record<string, typeof preferences> = {}
      surgeonPrefs.forEach((p) => {
        if (!byComponent[p.component]) byComponent[p.component] = []
        byComponent[p.component].push(p)
      })

      for (const [component, prefs] of Object.entries(byComponent)) {
        const sorted = [...prefs].sort((a, b) => a.priority - b.priority)
        const primaryVariant = sorted[0]?.variant
        if (!primaryVariant) continue

        const config = getCheckConfig(component, primaryVariant)

        // For femur: only check the side that's needed
        let gridVariants: string[]
        if (component === 'knee_femur' && side) {
          gridVariants = [`${side}_${primaryVariant}`]
        } else if (config.isPolyStyle) {
          gridVariants = []
        } else {
          gridVariants = expandVariantToGridKeys(component, primaryVariant)
        }

        const sideLabel = component === 'knee_femur' && side ? `${side === 'left' ? 'Left' : 'Right'} ` : ''
        const missingSizes: string[] = []
        const onHandForComponent: Record<string, number> = {}
        const thresholdForComponent: Record<string, number> = {}

        if (config.isPolyStyle && config.polyThicknesses) {
          // Poly: check each size × thickness combo individually
          const polyThicknesses: string[] = config.polyThicknesses
          for (const kneeSize of config.sizes) {
            for (const thickness of polyThicknesses) {
              const onHand = onHandCounts[`${config.category}|${kneeSize}|${thickness}`] ?? 0
              const key = `${kneeSize}×${thickness}`

              let threshold = thresholdMap[`${component}|${primaryVariant}|${key}`] ?? 0
              if (threshold === 0) threshold = 1

              onHandForComponent[key] = onHand
              thresholdForComponent[key] = threshold

              if (onHand < threshold) {
                missingSizes.push(key)
              }
            }
          }
        } else {
          for (const size of config.sizes) {
            let onHand = 0
            for (const gv of gridVariants) {
              onHand += onHandCounts[`${config.category}|${gv}|${size}`] ?? 0
            }

            let threshold = thresholdMap[`${component}|${primaryVariant}|${size}`] ?? 0
            if (threshold === 0) threshold = 1

            onHandForComponent[size] = onHand
            thresholdForComponent[size] = threshold

            if (onHand < threshold) {
              missingSizes.push(size)
            }
          }
        }

        if (missingSizes.length > 0) {
          alerts.push({
            facility_id: facilityId,
            facility_name: facilityMap[facilityId],
            surgeon_name: caseRow.surgeon_name,
            surgery_date: caseRow.surgery_date,
            case_id: caseRow.case_id,
            component,
            variant: `${sideLabel}${primaryVariant}`,
            missing_sizes: missingSizes,
            on_hand: onHandForComponent,
            threshold: thresholdForComponent,
          })
        }
      }
    }
  }

  // Deduplicate alerts by facility + component + variant + missing sizes
  const seenAlertKeys = new Set<string>()
  const dedupedAlerts = alerts.filter((a) => {
    const key = `${a.facility_id}|${a.component}|${a.variant}|${a.missing_sizes.sort().join(',')}`
    if (seenAlertKeys.has(key)) return false
    seenAlertKeys.add(key)
    return true
  })

  // Get previous alerts to detect changes
  const { data: previousAlerts } = await supabase.from('inventory_alerts').select('component, variant, missing_sizes')
  const previousAlertKeys = new Set(
    (previousAlerts ?? []).map((a) => `${a.component}|${a.variant}|${(a.missing_sizes as string[]).sort().join(',')}`)
  )
  const currentAlertKeys = new Set(
    dedupedAlerts.map((a) => `${a.component}|${a.variant}|${a.missing_sizes.sort().join(',')}`)
  )
  const alertsChanged = currentAlertKeys.size !== previousAlertKeys.size ||
    [...currentAlertKeys].some((k) => !previousAlertKeys.has(k))

  // Clear old alerts and insert new ones
  await supabase.from('inventory_alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  for (const alert of dedupedAlerts) {
    await supabase.from('inventory_alerts').insert({
      facility_id: alert.facility_id,
      surgeon_name: alert.surgeon_name,
      case_id: alert.case_id,
      surgery_date: alert.surgery_date,
      component: alert.component,
      variant: alert.variant,
      missing_sizes: alert.missing_sizes,
      details: JSON.stringify({ on_hand: alert.on_hand, threshold: alert.threshold }),
      created_at: new Date().toISOString(),
    })
  }

  // Generate replenishment proposals
  await supabase.from('replenishment_requests').delete().eq('status', 'proposed')
  for (const alert of dedupedAlerts) {
    const kitName = getKitName(alert.component, alert.variant)
    await supabase.from('replenishment_requests').insert({
      facility_id: alert.facility_id,
      facility_name: alert.facility_name,
      surgeon_name: alert.surgeon_name,
      case_id: alert.case_id,
      surgery_date: alert.surgery_date,
      kit_template_name: kitName,
      component: alert.component,
      variant: alert.variant,
      missing_sizes: alert.missing_sizes,
      reason: `${alert.missing_sizes.length} sizes below threshold for ${alert.variant}`,
      status: 'proposed',
    })
  }

  // Determine priority per alert: critical if case within 24hrs, warning if 2+ days
  const componentNames: Record<string, string> = {
    cr_pressfit: 'CR PF Femur', cr_cemented: 'CR Cem Femur',
    ps_cemented: 'PS Femur', ps_pro_cemented: 'PS Pro Femur',
    ps_pressfit: 'PS PF Femur', tritanium: 'Tritanium Tibia',
    primary: 'Primary Tibia', universal: 'Universal Tibia', mis: 'MIS Tibia',
    cs: 'CS Poly', ps: 'PS Poly', ts: 'TS Poly',
    asym_cemented: 'Asym Patella', sym_cemented: 'Sym Patella',
    asym_pressfit: 'Asym PF Patella',
  }

  function formatAlertTitle(a: Alert): string {
    const sideMatch = a.variant.match(/^(Left |Right )(.+)$/)
    const variantId = sideMatch ? sideMatch[2] : a.variant
    const name = componentNames[variantId] ?? variantId
    return `Low Inventory: ${name}`
  }

  function formatAlertBody(a: Alert): string {
    const sideMatch = a.variant.match(/^(Left |Right )(.+)$/)
    const side = sideMatch ? sideMatch[1].trim() : ''
    const isPoly = a.component === 'knee_poly'
    const lines: string[] = []

    for (const sizeKey of a.missing_sizes.slice(0, 5)) {
      const onHand = a.on_hand[sizeKey] ?? 0
      const threshold = a.threshold[sizeKey] ?? 1

      if (isPoly) {
        const [sz, thick] = sizeKey.split('×')
        if (onHand === 0) {
          lines.push(`No size ${sz}, ${thick}mm remaining`)
        } else {
          lines.push(`Only ${onHand} size ${sz}, ${thick}mm remaining (need ${threshold})`)
        }
      } else {
        const sizeLabel = side ? `${side} size ${sizeKey}` : `size ${sizeKey}`
        if (onHand === 0) {
          lines.push(`No ${sizeLabel} remaining`)
        } else {
          lines.push(`Only ${onHand} ${sizeLabel} remaining (need ${threshold})`)
        }
      }
    }

    if (a.missing_sizes.length > 5) {
      lines.push(`+${a.missing_sizes.length - 5} more sizes below threshold`)
    }

    return lines.join('\n')
  }

  function formatPushBody(a: Alert): string {
    const sideMatch = a.variant.match(/^(Left |Right )(.+)$/)
    const side = sideMatch ? sideMatch[1].trim() : ''
    const isPoly = a.component === 'knee_poly'
    const parts: string[] = []

    for (const sizeKey of a.missing_sizes.slice(0, 3)) {
      const onHand = a.on_hand[sizeKey] ?? 0
      if (isPoly) {
        const [sz, thick] = sizeKey.split('×')
        parts.push(onHand === 0 ? `no sz${sz} ${thick}mm` : `${onHand} sz${sz} ${thick}mm left`)
      } else {
        const label = side ? `${side} sz${sizeKey}` : `sz${sizeKey}`
        parts.push(onHand === 0 ? `no ${label}` : `${onHand} ${label} left`)
      }
    }
    if (a.missing_sizes.length > 3) parts.push(`+${a.missing_sizes.length - 3} more`)
    return parts.join(' • ')
  }

  // Check for active replenishments to downgrade alerts
  const { data: activeReplenishments } = await supabase
    .from('replenishment_requests')
    .select('component, variant')
    .in('status', ['proposed', 'approved', 'in_transit'])

  const replenishmentSet = new Set(
    (activeReplenishments ?? []).map((r) => `${r.component}|${r.variant}`)
  )

  // Get quiet hours preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('quiet_hours_start, quiet_hours_end, quiet_hours_tz, push_critical, push_warning, push_info')
    .limit(1)
    .maybeSingle()

  const isQuietHours = (() => {
    if (!prefs) return false
    const tz = prefs.quiet_hours_tz || 'America/New_York'
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    const nowTime = formatter.format(now)
    const start = prefs.quiet_hours_start || '22:00'
    const end = prefs.quiet_hours_end || '06:00'
    // Handle overnight range (22:00 - 06:00)
    if (start > end) return nowTime >= start || nowTime < end
    return nowTime >= start && nowTime < end
  })()

  // Send notifications only if alerts changed
  if (dedupedAlerts.length > 0 && alertsChanged) {
    const now = new Date()

    for (const alert of dedupedAlerts) {
      const surgeryDate = alert.surgery_date ? new Date(alert.surgery_date) : null
      const hoursUntilSurgery = surgeryDate ? (surgeryDate.getTime() - now.getTime()) / 3600000 : 999
      const hasReplenishment = replenishmentSet.has(`${alert.component}|${alert.variant}`)

      let priority: 'critical' | 'warning' | 'info'
      if (hasReplenishment) {
        priority = 'info' // Replenishment in progress, downgrade
      } else if (hoursUntilSurgery <= 24) {
        priority = 'critical'
      } else {
        priority = 'warning'
      }

      const title = priority === 'critical'
        ? `URGENT: ${formatAlertTitle(alert)}`
        : formatAlertTitle(alert)

      // Duplicate suppression: check if identical unread notification exists in last 4 hours
      const fourHoursAgo = new Date(now.getTime() - 4 * 3600000).toISOString()
      const { count: existingCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'inventory_alert')
        .eq('action_id', `${alert.component}|${alert.variant}`)
        .eq('read', false)
        .gte('created_at', fourHoursAgo)

      if ((existingCount ?? 0) > 0) continue // Skip duplicate

      const notifBody = formatAlertBody(alert)
      const pushBody = formatPushBody(alert)

      // Save notification (full detail for in-app view)
      await supabase.from('notifications').insert({
        title,
        body: notifBody,
        type: 'inventory_alert',
        priority,
        action_type: 'view_alert',
        action_id: `${alert.component}|${alert.variant}`,
        facility_id: alert.facility_id,
        expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
        data: { component: alert.component, variant: alert.variant, missing_sizes: alert.missing_sizes, on_hand: alert.on_hand, threshold: alert.threshold },
      })

      // Send push (compact version, respecting quiet hours)
      const shouldPush = !isQuietHours && (
        (priority === 'critical' && (prefs?.push_critical !== false)) ||
        (priority === 'warning' && (prefs?.push_warning !== false)) ||
        (priority === 'info' && prefs?.push_info === true)
      )

      if (shouldPush) {
        try {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'
          await fetch(`${baseUrl}/api/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              body: pushBody,
              data: { type: 'inventory_alert', action_type: 'view_alert', action_id: `${alert.component}|${alert.variant}` },
            }),
          })
        } catch { /* push is non-critical */ }
      }
    }
  }

  // Escalation: re-notify for critical alerts unacknowledged for 4+ hours
  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString()
    const { data: unacked } = await supabase
      .from('notifications')
      .select('id, title, body')
      .eq('priority', 'critical')
      .eq('read', false)
      .is('acknowledged_at', null)
      .lt('created_at', fourHoursAgo)
      .limit(5)

    if (unacked && unacked.length > 0 && !isQuietHours) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      try {
        await fetch(`${baseUrl}/api/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[URGENT] ${unacked.length} unresolved critical alert${unacked.length === 1 ? '' : 's'}`,
            body: unacked.map((n) => n.title).slice(0, 2).join(' • '),
            data: { type: 'escalation' },
          }),
        })
      } catch { /* non-critical */ }
    }
  } catch { /* escalation is non-critical */ }

  return dedupedAlerts.length
}
