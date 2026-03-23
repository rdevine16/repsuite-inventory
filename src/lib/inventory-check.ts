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

  // Get tomorrow's cases (Eastern timezone)
  const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
  const nowET = eastern.format(new Date())
  const [emm, edd, eyyyy] = nowET.split('/')
  const todayDate = new Date(`${eyyyy}-${emm}-${edd}T00:00:00-04:00`)
  const tomorrow = new Date(todayDate)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const { data: tomorrowCases } = await supabase
    .from('cases')
    .select('id, case_id, facility_id, surgeon_name, surgery_date, procedure_name')
    .in('facility_id', facilityIds)
    .gte('surgery_date', tomorrow.toISOString())
    .lt('surgery_date', dayAfter.toISOString())
    .neq('status', 'Completed')

  if (!tomorrowCases || tomorrowCases.length === 0) return 0

  // Get surgeon preferences
  const surgeonNames = [...new Set(tomorrowCases.map((c) => c.surgeon_name).filter(Boolean))]
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
    const facilityCases = tomorrowCases.filter((c) => c.facility_id === facilityId)
    if (facilityCases.length === 0) continue

    const { data: sessions } = await supabase
      .from('inventory_sessions')
      .select('id')
      .eq('facility_id', facilityId)

    if (!sessions || sessions.length === 0) continue

    const sessionIds = sessions.map((s) => s.id)
    const { data: inventoryItems } = await supabase
      .from('inventory_items')
      .select('gtin, reference_number')
      .in('session_id', sessionIds)

    if (!inventoryItems) continue

    const onHandCounts = buildOnHandCounts(inventoryItems)

    // Also count implants from kits shipped for cases at this facility
    // These are parts assigned to cases (from getCaseById parts[])
    // Get all non-completed cases at this facility
    const { data: facilityCaseIds } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)
      .neq('status', 'Completed')

    if (facilityCaseIds && facilityCaseIds.length > 0) {
      // Get sf_ids for these cases
      const { data: facilityCaseSfIds } = await supabase
        .from('cases')
        .select('sf_id')
        .eq('facility_id', facilityId)
        .neq('status', 'Completed')

      const sfIds = facilityCaseSfIds?.map((c) => c.sf_id).filter(Boolean) ?? []

      if (sfIds.length > 0) {
        const { data: caseParts } = await supabase
          .from('case_parts')
          .select('catalog_number, quantity')
          .in('case_sf_id', sfIds)

        if (caseParts) {
          // Convert case parts to the same format as inventory items and add to on-hand counts
          const kitItems = caseParts
            .filter((p) => p.catalog_number)
            .map((p) => ({ gtin: null, reference_number: p.catalog_number }))

          const kitCounts = buildOnHandCounts(kitItems)
          for (const [key, count] of Object.entries(kitCounts)) {
            onHandCounts[key] = (onHandCounts[key] ?? 0) + count
          }
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

        for (const size of config.sizes) {
          let onHand = 0

          if (config.isPolyStyle && config.polyThicknesses) {
            for (const thickness of config.polyThicknesses) {
              onHand += onHandCounts[`${config.category}|${size}|${thickness}`] ?? 0
            }
          } else {
            for (const gv of gridVariants) {
              onHand += onHandCounts[`${config.category}|${gv}|${size}`] ?? 0
            }
          }

          // Check threshold at preference level
          let threshold = thresholdMap[`${component}|${primaryVariant}|${size}`] ?? 0
          if (threshold === 0) threshold = 1 // default: alert when zero

          onHandForComponent[size] = onHand
          thresholdForComponent[size] = threshold

          if (onHand < threshold) {
            missingSizes.push(size)
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

  // Clear old alerts and insert new ones
  await supabase.from('inventory_alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  for (const alert of alerts) {
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
  for (const alert of alerts) {
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

  // Send push notification if there are new alerts
  if (alerts.length > 0) {
    const alertSummary = alerts.map((a) => {
      const sideMatch = a.variant.match(/^(Left |Right )(.+)$/)
      const side = sideMatch ? sideMatch[1] : ''
      const variantId = sideMatch ? sideMatch[2] : a.variant
      const names: Record<string, string> = {
        cr_pressfit: 'CR PF Femur', cr_cemented: 'CR Cem Femur',
        ps_cemented: 'PS Femur', tritanium: 'Tritanium Tibia',
        cs: 'CS Poly', ps: 'PS Poly',
      }
      return `${side}${names[variantId] ?? variantId} sz ${a.missing_sizes.join(',')}`
    })

    // Get device tokens and send push
    const { data: tokens } = await supabase.from('device_tokens').select('device_token')
    if (tokens && tokens.length > 0) {
      try {
        // Use the send-push API route
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'
        await fetch(`${baseUrl}/api/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${alerts.length} Inventory Alert${alerts.length === 1 ? '' : 's'}`,
            body: alertSummary.slice(0, 3).join(' • '),
            data: { type: 'inventory_alert' },
          }),
        })
      } catch {
        // Push is non-critical
      }
    }
  }

  return alerts.length
}
