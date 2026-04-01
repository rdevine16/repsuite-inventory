'use client'

import DashboardTabs, { type TabId } from './dashboard-tabs'
import FacilityHeader from './facility-header'
import InventoryTable from './inventory-table'

interface InventoryItem {
  id: string
  facility_id: string
  gtin: string | null
  reference_number: string | null
  description: string | null
  lot_number: string | null
  expiration_date: string | null
  added_at: string
  facilities: { name: string } | { name: string }[] | null
}

interface Facility {
  id: string
  name: string
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <p className="text-gray-400 text-sm">{label} — coming soon</p>
    </div>
  )
}

export default function DashboardShell({
  facilities,
  selectedFacilityId,
  activeTab,
  facilityName,
  facilityAddress,
  smartTracking,
  lastAuditDate,
  inventoryItems,
  gtinDisplayName,
}: {
  facilities: Facility[]
  selectedFacilityId: string
  activeTab: string
  facilityName: string
  facilityAddress: string | null
  smartTracking: boolean
  lastAuditDate: string | null
  inventoryItems: InventoryItem[]
  gtinDisplayName: Record<string, string>
}) {
  const validTab = (['overview', 'activity', 'expirations', 'par-levels', 'analytics', 'audit'] as const).includes(activeTab as TabId)
    ? (activeTab as TabId)
    : 'overview'

  return (
    <>
      <FacilityHeader
        name={facilityName}
        address={facilityAddress}
        smartTracking={smartTracking}
        lastAuditDate={lastAuditDate}
      />

      <DashboardTabs
        facilities={facilities}
        selectedFacility={selectedFacilityId}
        activeTab={validTab}
        children={{
          overview: <PlaceholderTab label="Overview with KPIs and discrepancy detection" />,
          activity: (
            <InventoryTable
              items={inventoryItems}
              facilities={facilities}
              gtinDisplayName={gtinDisplayName}
            />
          ),
          expirations: <PlaceholderTab label="Expiration management with urgency tiers and FEFO" />,
          'par-levels': <PlaceholderTab label="Par level compliance with progress bars and gap analysis" />,
          analytics: <PlaceholderTab label="Burn rate analytics with usage trend charts" />,
          audit: <PlaceholderTab label="Audit trail with session history and CSV export" />,
        }}
      />
    </>
  )
}
