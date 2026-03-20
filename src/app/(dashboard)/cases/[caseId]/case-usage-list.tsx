'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UsageItem {
  id: string
  catalog_number: string
  part_name: string | null
  lot_number: string | null
  expiration_date: string | null
  quantity: number
  source_location: string | null
  inventory_field: string | null
  auto_deducted: boolean
  manually_overridden: boolean
  current_status: string
}

export default function CaseUsageList({
  items,
  facilityId,
  facilitySiteNumber,
  canEdit,
}: {
  items: UsageItem[]
  facilityId: string
  facilitySiteNumber: string | null
  canEdit: boolean
}) {
  const [usageItems, setUsageItems] = useState(items)
  const [processing, setProcessing] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleToggle = async (item: UsageItem) => {
    setProcessing(item.id)

    if (item.current_status === 'deducted') {
      // Restore: move item back from used_items to inventory_items
      const { data: usedItem } = await supabase
        .from('used_items')
        .select('*')
        .eq('case_usage_item_id', item.id)
        .is('restored_at', null)
        .single()

      if (usedItem) {
        // Re-insert into inventory
        await supabase.from('inventory_items').insert({
          id: usedItem.original_inventory_item_id,
          session_id: usedItem.session_id,
          gtin: usedItem.gtin,
          reference_number: usedItem.reference_number,
          description: usedItem.description,
          lot_number: usedItem.lot_number,
          expiration_date: usedItem.expiration_date,
          scanned_at: usedItem.scanned_at,
        })

        // Mark used_item as restored
        await supabase
          .from('used_items')
          .update({ restored_at: new Date().toISOString() })
          .eq('id', usedItem.id)
      }

      // Update usage item status
      await supabase
        .from('case_usage_items')
        .update({
          current_status: 'restored',
          manually_overridden: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      setUsageItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, current_status: 'restored', manually_overridden: true } : i
        )
      )
    } else {
      // Deduct: find matching inventory item and move to used_items
      const { data: matchedItems } = await supabase
        .from('inventory_items')
        .select('*, inventory_sessions!inner(facility_id)')
        .eq('reference_number', item.catalog_number)
        .eq('inventory_sessions.facility_id', facilityId)
        .limit(1)

      if (matchedItems && matchedItems.length > 0) {
        const inventoryItem = matchedItems[0]

        // Move to used_items
        await supabase.from('used_items').insert({
          case_usage_item_id: item.id,
          original_inventory_item_id: inventoryItem.id,
          session_id: inventoryItem.session_id,
          facility_id: facilityId,
          gtin: inventoryItem.gtin,
          reference_number: inventoryItem.reference_number,
          description: inventoryItem.description,
          lot_number: inventoryItem.lot_number,
          expiration_date: inventoryItem.expiration_date,
          scanned_at: inventoryItem.scanned_at,
        })

        // Remove from inventory
        await supabase.from('inventory_items').delete().eq('id', inventoryItem.id)

        // Update usage item
        await supabase
          .from('case_usage_items')
          .update({
            current_status: 'deducted',
            manually_overridden: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        setUsageItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, current_status: 'deducted', manually_overridden: true } : i
          )
        )
      }
    }

    setProcessing(null)
    router.refresh()
  }

  const fromFacility = (item: UsageItem) => item.source_location === facilitySiteNumber
  const deductedItems = usageItems.filter((i) => i.current_status === 'deducted')
  const otherItems = usageItems.filter((i) => i.current_status !== 'deducted')

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 text-sm">
        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium">
          {deductedItems.length} deducted from inventory
        </span>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
          {otherItems.length} from other sources
        </span>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Item</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Ref #</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Lot</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Source</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Status</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-28">Action</th>}
              </tr>
            </thead>
            <tbody>
              {usageItems.map((item) => {
                const isFromFacility = fromFacility(item)
                const isDeducted = item.current_status === 'deducted'
                const isRestored = item.current_status === 'restored'
                const isProcessing = processing === item.id

                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 text-xs">
                        {item.part_name?.replace(/^\S+ - /, '') ?? item.catalog_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{item.catalog_number}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{item.lot_number ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isFromFacility
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isFromFacility ? 'Facility' : item.source_location ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        isDeducted
                          ? 'bg-emerald-50 text-emerald-700'
                          : isRestored
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isDeducted ? 'Deducted' : isRestored ? 'Restored' : 'Not matched'}
                        {item.manually_overridden && (
                          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        )}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        {isDeducted ? (
                          <button
                            onClick={() => handleToggle(item)}
                            disabled={isProcessing}
                            className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Restore'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggle(item)}
                            disabled={isProcessing}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Deduct'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {usageItems.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-gray-400">
                    No usage items recorded for this case.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
