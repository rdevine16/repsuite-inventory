import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { id, type } = await req.json()

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })
    }

    if (type === 'source_conflict') {
      const { error } = await supabase
        .from('case_usage_items')
        .update({ source_conflict_resolved: true, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    } else if (type === 'not_matched') {
      const { error } = await supabase
        .from('case_usage_items')
        .update({ current_status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    } else if (type === 'unmatched_deduction') {
      // For used_items with no case link, we mark by setting a placeholder case_usage_item_id
      // Instead, we'll delete the used_item and restore to facility_inventory
      // Actually — safest approach: just delete the used_item record since there's no case link
      // The item is already gone from inventory, dismissing acknowledges it
      const { data: usedItem, error: fetchErr } = await supabase
        .from('used_items')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr || !usedItem) throw fetchErr || new Error('Item not found')

      // Restore to facility_inventory
      await supabase.from('facility_inventory').insert({
        facility_id: usedItem.facility_id,
        gtin: usedItem.gtin,
        reference_number: usedItem.reference_number,
        description: usedItem.description,
        lot_number: usedItem.lot_number,
        expiration_date: usedItem.expiration_date,
      })

      await supabase.from('used_items').delete().eq('id', id)
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('dismiss-discrepancy error:', err)
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
  }
}
