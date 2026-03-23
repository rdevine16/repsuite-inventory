import { createClient } from '@supabase/supabase-js'
import { getAllCases, getCaseById, formatDateForAPI, refreshJwt } from '@/lib/repsuite-api'
import { NextRequest, NextResponse } from 'next/server'

// Use service role to bypass RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function syncCases() {
  const supabase = getAdminClient()

  // Get the active RepSuite token
  const { data: tokenRow, error: tokenError } = await supabase
    .from('repsuite_tokens')
    .select('access_token, refresh_token, token_expiry, sales_team_ids, user_id')
    .eq('token_status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: 'No active RepSuite token found. Open the iOS app to authenticate.' },
      { status: 401 }
    )
  }

  if (!tokenRow.sales_team_ids) {
    return NextResponse.json(
      { error: 'No sales team IDs found. Open the iOS app — it will sync team IDs on next launch.' },
      { status: 400 }
    )
  }

  let accessToken = tokenRow.access_token

  // Check if token is expired and refresh if needed
  if (tokenRow.token_expiry && new Date(tokenRow.token_expiry) < new Date()) {
    const refreshResult = await refreshJwt(tokenRow.refresh_token)
    if (!refreshResult) {
      await supabase
        .from('repsuite_tokens')
        .update({ token_status: 'expired', error_message: 'Token refresh failed', updated_at: new Date().toISOString() })
        .eq('user_id', tokenRow.user_id)
      return NextResponse.json(
        { error: 'RepSuite token expired and refresh failed. Open the iOS app to re-authenticate.' },
        { status: 401 }
      )
    }

    accessToken = refreshResult.accessToken
    const expiry = refreshResult.expiresIn
      ? new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString()
      : tokenRow.token_expiry
    await supabase
      .from('repsuite_tokens')
      .update({
        access_token: refreshResult.accessToken,
        refresh_token: refreshResult.refreshToken ?? tokenRow.refresh_token,
        token_expiry: expiry,
        token_status: 'active',
        error_message: '',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', tokenRow.user_id)
  }

  // Fetch upcoming cases (today + 3 days)
  const today = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 3)

  const upcomingCases = await getAllCases(
    accessToken,
    tokenRow.sales_team_ids,
    formatDateForAPI(today),
    formatDateForAPI(endDate)
  )

  // Fetch completed cases from today onward
  const completedCases = await getAllCases(
    accessToken,
    tokenRow.sales_team_ids,
    '03/22/2026', // App start date
    formatDateForAPI(endDate),
    'Completed'
  )

  // Merge cases, preferring completed status when a case appears in both lists
  const caseMap = new Map<string, typeof upcomingCases[number]>()
  for (const c of upcomingCases) {
    caseMap.set(c.sfId, c)
  }
  for (const c of completedCases) {
    // Completed status takes priority over requested/shipped
    caseMap.set(c.sfId, c)
  }
  const uniqueCases = Array.from(caseMap.values())

  // Get facility mapping (repsuite site number → facility id, sub-inventory → facility id)
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, repsuite_site_number, repsuite_sub_inventory_id')

  const facilityBySiteNumber: Record<string, string> = {}
  const facilityBySubInventory: Record<string, string> = {}
  facilities?.forEach((f: { id: string; repsuite_site_number?: string; repsuite_sub_inventory_id?: string }) => {
    if (f.repsuite_site_number) facilityBySiteNumber[f.repsuite_site_number] = f.id
    if (f.repsuite_sub_inventory_id) facilityBySubInventory[f.repsuite_sub_inventory_id] = f.id
  })

  function extractSiteNumber(hospitalName: string | null): string | null {
    if (!hospitalName) return null
    const match = hospitalName.match(/^(\d+)\s*-/)
    return match ? match[1] : null
  }

  // Get existing cases to detect changes
  const { data: existingCases } = await supabase
    .from('cases')
    .select('sf_id, status')

  const existingStatusMap: Record<string, string> = {}
  existingCases?.forEach((c) => { if (c.sf_id) existingStatusMap[c.sf_id] = c.status })

  // Upsert cases and track which are new or changed
  const changedCaseSfIds: string[] = []
  const newlyCompletedSfIds: string[] = []
  const newKitIssues: { caseSfId: string; kitName: string; missingCount: number }[] = []
  let synced = 0
  for (const c of uniqueCases) {
    const siteNumber = extractSiteNumber(c.hospitalName)
    const facilityId = siteNumber ? facilityBySiteNumber[siteNumber] ?? null : null

    const procedureName = c.procedures?.[0]?.name ?? null
    const side = procedureName?.includes('Left') ? 'L' : procedureName?.includes('Right') ? 'R' : null

    const caseRecord = {
      case_id: c.caseId,
      external_id: c.externalId,
      sf_id: c.sfId,
      facility_id: facilityId,
      hospital_name: c.hospitalName,
      hospital_site_number: siteNumber,
      surgeon_name: c.surgeonName,
      procedure_name: procedureName,
      surgery_date: c.surgeryDate,
      patient_id: c.patientId,
      side,
      sales_rep: c.salesRep,
      covering_reps: c.covering_reps__c,
      status: c.status,
      synced_at: new Date().toISOString(),
    }

    // Track if this case is new or status changed
    const oldStatus = existingStatusMap[c.sfId]
    if (!oldStatus || oldStatus !== c.status) {
      changedCaseSfIds.push(c.sfId)
    }

    // Track cases that just became Completed (for auto-deduction)
    if (c.status === 'Completed' && oldStatus !== 'Completed') {
      newlyCompletedSfIds.push(c.sfId)
    }

    const { error: upsertError } = await supabase
      .from('cases')
      .upsert(caseRecord, { onConflict: 'sf_id' })

    if (!upsertError) synced++
  }

  // Backfill facility_id on any cases that match a mapped facility
  const { data: mappedFacilities } = await supabase
    .from('facilities')
    .select('id, repsuite_site_number')
    .not('repsuite_site_number', 'is', null)

  for (const f of mappedFacilities ?? []) {
    await supabase
      .from('cases')
      .update({ facility_id: f.id })
      .eq('hospital_site_number', f.repsuite_site_number)
      .is('facility_id', null)
  }

  // Pull case details (sets, parts) for upcoming cases
  // On first run or when cases change, pull details
  const { count: existingPartsCount } = await supabase
    .from('case_parts')
    .select('id', { count: 'exact', head: true })

  // Pull details for changed cases and any cases missing parts
  const { data: casesWithoutParts } = await supabase
    .from('cases')
    .select('sf_id')
    .gte('surgery_date', new Date().toISOString())
    .not('external_id', 'is', null)
    .neq('status', 'Completed')

  const sfIdsWithoutParts: string[] = []
  if (casesWithoutParts) {
    const { data: existingPartsSfIds } = await supabase
      .from('case_parts')
      .select('case_sf_id')
    const partsSet = new Set(existingPartsSfIds?.map((p) => p.case_sf_id) ?? [])
    for (const c of casesWithoutParts) {
      if (c.sf_id && !partsSet.has(c.sf_id)) {
        sfIdsWithoutParts.push(c.sf_id)
      }
    }
  }

  const allSfIdsToFetch = [...new Set([...changedCaseSfIds, ...sfIdsWithoutParts])]

  let detailsQuery = supabase
    .from('cases')
    .select('sf_id, external_id')
    .gte('surgery_date', new Date().toISOString())
    .not('external_id', 'is', null)

  if (allSfIdsToFetch.length > 0) {
    detailsQuery = detailsQuery.in('sf_id', allSfIdsToFetch)
  } else {
    detailsQuery = detailsQuery.limit(0)
  }

  const { data: upcomingCasesForDetails } = await detailsQuery

  let detailsSynced = 0
  for (const caseRow of upcomingCasesForDetails ?? []) {
    if (!caseRow.external_id || !caseRow.sf_id) continue
    try {
      const detail = await getCaseById(accessToken, caseRow.external_id, caseRow.sf_id)
      if (!detail) continue

      // Sync sets
      const setsArr = detail.sets as Array<Record<string, unknown>> | undefined
      if (setsArr && Array.isArray(setsArr)) {
        for (const s of setsArr) {
          const setName = (s.requested_set_name ?? s.set_name ?? '') as string
          const setType = (s.setType ?? 'Other') as string
          if (setName) {
            await supabase.from('repsuite_set_names')
              .upsert({ set_name: setName, set_type: setType }, { onConflict: 'set_name' })
          }
        }
      }

      // Sync parts to case_parts
      const partsArr = detail.parts as Array<Record<string, unknown>> | undefined
      if (partsArr && Array.isArray(partsArr)) {
        for (const part of partsArr) {
          const catalogNumber = part.catalog_number as string | undefined
          if (!catalogNumber) continue

          const quantity = typeof part.quantity__c === 'number' ? part.quantity__c :
            typeof part.quantity__c === 'string' ? parseInt(part.quantity__c) || 1 : 1
          const isLoaner = part.loaner__c === true || part.loaner__c === 'true'

          await supabase.from('case_parts').upsert({
            case_sf_id: caseRow.sf_id,
            catalog_number: catalogNumber,
            part_name: (part.part_name ?? part.part_desc ?? '') as string,
            set_id: (part.set_id ?? '') as string,
            status: (part.status__c ?? '') as string,
            quantity: quantity as number,
            is_loaner: isLoaner,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'case_sf_id,catalog_number,set_id' })
        }
        detailsSynced++
      }
      // Sync kit issues (missing parts) and send push if new
      const partsArr2 = detail.parts as Array<Record<string, unknown>> | undefined
      if (setsArr && partsArr2) {
        for (const set of setsArr) {
          const setId = (set.id ?? '') as string
          const kitName = (set.requested_set_name ?? set.set_name ?? set.templateName ?? '') as string
          const kitNo = (set.kitNo ?? '') as string
          const setParts = partsArr2.filter((p) => (p.set_id as string) === setId)
          const missingParts = setParts.filter((p) => {
            const mq = typeof p.missingqty === 'number' ? p.missingqty : 0
            return mq > 0
          })

          if (missingParts.length > 0) {
            const missingData = missingParts.map((p) => ({
              catalog_number: (p.catalog_number ?? '') as string,
              part_name: (p.part_name ?? p.part_desc ?? 'Unknown') as string,
              missing_qty: typeof p.missingqty === 'number' ? p.missingqty : 1,
            }))

            await supabase.from('case_kit_issues').upsert({
              case_sf_id: caseRow.sf_id,
              kit_name: kitName,
              kit_no: kitNo,
              missing_parts: JSON.stringify(missingData),
              total_parts: setParts.length,
              missing_count: missingParts.length,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'case_sf_id,kit_no' })

            newKitIssues.push({ caseSfId: caseRow.sf_id, kitName, missingCount: missingParts.length })
          } else if (kitNo) {
            // Clear resolved issues
            await supabase.from('case_kit_issues')
              .delete()
              .eq('case_sf_id', caseRow.sf_id)
              .eq('kit_no', kitNo)
          }
        }
      }
    } catch (detailErr) {
      console.error(`Error syncing details for ${caseRow.sf_id}:`, detailErr)
    }
  }

  // Send push notification for new kit issues
  if (newKitIssues.length > 0) {
    try {
      const { data: tokens } = await supabase.from('device_tokens').select('device_token')
      if (tokens && tokens.length > 0) {
        const summary = newKitIssues.slice(0, 3).map((i) =>
          `${i.kitName}: ${i.missingCount} missing`
        ).join(' • ')

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'
        await fetch(`${baseUrl}/api/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${newKitIssues.length} Kit${newKitIssues.length === 1 ? '' : 's'} with Missing Parts`,
            body: summary,
            data: { type: 'kit_issue', case_sf_id: newKitIssues[0].caseSfId },
          }),
        })
      }
    } catch {
      // Push is non-critical
    }
  }

  // Auto-deduct inventory for newly completed cases + completed cases missing usage items
  let autoDeducted = 0

  // Also find completed cases that have no usage items (e.g. reprocessing after a fix)
  const { data: completedWithoutUsage } = await supabase
    .from('cases')
    .select('sf_id')
    .eq('status', 'Completed')
    .not('external_id', 'is', null)
    .not('facility_id', 'is', null)

  const completedSfIds = completedWithoutUsage?.map((c) => c.sf_id).filter(Boolean) ?? []
  const { data: existingUsageSfIds } = await supabase
    .from('case_usage_items')
    .select('case_id, cases!inner(sf_id)')

  const sfIdsWithUsage = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingUsageSfIds?.map((u: any) => u.cases?.sf_id).filter(Boolean) ?? []
  )
  const missingUsageSfIds = completedSfIds.filter((id) => id && !sfIdsWithUsage.has(id))

  const allCompletedToProcess = [...new Set([...newlyCompletedSfIds, ...missingUsageSfIds])]

  if (allCompletedToProcess.length > 0) {
    // Get the case rows for completed cases needing processing
    const { data: completedCaseRows } = await supabase
      .from('cases')
      .select('id, sf_id, external_id, facility_id, hospital_site_number')
      .in('sf_id', allCompletedToProcess)
      .not('external_id', 'is', null)

    for (const caseRow of completedCaseRows ?? []) {
      if (!caseRow.external_id || !caseRow.sf_id) continue

      // Check if we already processed usage for this case
      const { count: existingUsageCount } = await supabase
        .from('case_usage_items')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', caseRow.id)

      if ((existingUsageCount ?? 0) > 0) continue // Already processed

      try {
        const detail = await getCaseById(accessToken, caseRow.external_id, caseRow.sf_id)
        if (!detail) continue

        const usages = detail.usages as Array<Record<string, unknown>> | undefined
        if (!usages || !Array.isArray(usages) || usages.length === 0) continue

        for (const usage of usages) {
          const catalogNumber = (usage.catalog_number ?? '') as string
          if (!catalogNumber) continue

          const lotNumber = (usage.lot_number__c ?? null) as string | null
          const sourceLocation = (usage.inventory__c ?? null) as string | null
          const partName = (usage.part_name ?? usage.part_desc ?? usage.name ?? '') as string
          const productSfid = (usage.sfid ?? usage.product_sfid ?? null) as string | null
          const usageName = (usage.usage_name ?? usage.name ?? null) as string | null
          const quantity = typeof usage.quantity__c === 'number' ? usage.quantity__c :
            typeof usage.quantity__c === 'string' ? parseInt(usage.quantity__c as string) || 1 : 1

          // Insert usage item
          const { data: usageItem, error: usageError } = await supabase
            .from('case_usage_items')
            .insert({
              case_id: caseRow.id,
              catalog_number: catalogNumber,
              part_name: partName || null,
              lot_number: lotNumber,
              quantity,
              source_location: sourceLocation,
              usage_name: usageName,
              product_sfid: productSfid,
              auto_deducted: false,
              manually_overridden: false,
              current_status: 'not_matched',
            })
            .select('id')
            .single()

          if (usageError || !usageItem) continue

          // Auto-deduct if the item has a source location that maps to a facility
          if (!sourceLocation || !caseRow.facility_id) continue

          // Resolve source location to a facility via sub-inventory mapping
          const sourceFacilityId = facilityBySubInventory[sourceLocation] ?? caseRow.facility_id

          // Find matching facility_inventory item (match by ref# and lot if available)
          let matchQuery = supabase
            .from('facility_inventory')
            .select('*')
            .eq('reference_number', catalogNumber)
            .eq('facility_id', sourceFacilityId)
            .limit(1)

          if (lotNumber) {
            matchQuery = matchQuery.eq('lot_number', lotNumber)
          }

          const { data: matchedItems } = await matchQuery

          // If no lot match, try without lot
          let inventoryItem = matchedItems?.[0]
          if (!inventoryItem && lotNumber) {
            const { data: fallbackItems } = await supabase
              .from('facility_inventory')
              .select('*')
              .eq('reference_number', catalogNumber)
              .eq('facility_id', sourceFacilityId)
              .limit(1)

            inventoryItem = fallbackItems?.[0]
          }

          if (!inventoryItem) continue

          // Move to used_items
          await supabase.from('used_items').insert({
            case_usage_item_id: usageItem.id,
            original_inventory_item_id: inventoryItem.id,
            facility_id: sourceFacilityId,
            gtin: inventoryItem.gtin,
            reference_number: inventoryItem.reference_number,
            description: inventoryItem.description,
            lot_number: inventoryItem.lot_number,
            expiration_date: inventoryItem.expiration_date,
          })

          // Remove from facility_inventory
          await supabase.from('facility_inventory').delete().eq('id', inventoryItem.id)

          // Mark as auto-deducted
          await supabase
            .from('case_usage_items')
            .update({
              current_status: 'deducted',
              auto_deducted: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', usageItem.id)

          autoDeducted++
        }
      } catch (usageErr) {
        console.error(`Error processing usage for ${caseRow.sf_id}:`, usageErr)
      }
    }
  }

  // Run inventory check after sync
  let alertCount = 0
  try {
    const { runInventoryCheck } = await import('@/lib/inventory-check')
    alertCount = await runInventoryCheck(supabase)
  } catch (checkErr) {
    console.error('Inventory check error:', checkErr)
  }

  return NextResponse.json({
    success: true,
    synced,
    total: uniqueCases.length,
    detailsSynced,
    autoDeducted,
    alertCount,
    dateRange: `${formatDateForAPI(today)} - ${formatDateForAPI(endDate)}`,
  })
}

// GET — called by Vercel Cron
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return await syncCases()
  } catch (err) {
    console.error('Cron sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST — called by the manual sync button (authenticated via session cookie)
export async function POST() {
  try {
    return await syncCases()
  } catch (err) {
    console.error('Manual sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
