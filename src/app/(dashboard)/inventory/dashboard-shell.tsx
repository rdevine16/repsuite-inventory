'use client'

import DashboardTabs, { type TabId } from './dashboard-tabs'
import FacilityHeader from './facility-header'
import OverviewTab, { type OverviewData } from './overview-tab'
import ActivityTab, { type ActivityEvent } from './activity-tab'
import ExpirationsTab, { type InventoryItemForExpiration } from './expirations-tab'
import ParLevelsTab, { type ParLevelEntry, type ReplenishmentRequest } from './par-levels-tab'
import AnalyticsTab, { type AnalyticsData } from './analytics-tab'
import { type Discrepancy } from './discrepancies'
import AuditTab, { type AuditSession } from './audit-tab'

interface Facility {
  id: string
  name: string
}

export default function DashboardShell({
  facilities,
  selectedFacilityId,
  activeTab,
  facilityName,
  facilityAddress,
  smartTracking,
  lastAuditDate,
  overviewData,
  activityEvents,
  expirationItems,
  upcomingRefNumbers,
  parLevels,
  onHandMap,
  replenishments,
  analyticsData,
  discrepancies,
  auditSessions,
}: {
  facilities: Facility[]
  selectedFacilityId: string
  activeTab: string
  facilityName: string
  facilityAddress: string | null
  smartTracking: boolean
  lastAuditDate: string | null
  overviewData: OverviewData
  activityEvents: ActivityEvent[]
  expirationItems: InventoryItemForExpiration[]
  upcomingRefNumbers: string[]
  parLevels: ParLevelEntry[]
  onHandMap: Record<string, number>
  replenishments: ReplenishmentRequest[]
  analyticsData: AnalyticsData
  discrepancies: Discrepancy[]
  auditSessions: AuditSession[]
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
        badges={discrepancies.length > 0 ? { overview: discrepancies.length } : undefined}
        children={{
          overview: <OverviewTab data={overviewData} discrepancies={discrepancies} />,
          activity: <ActivityTab events={activityEvents} />,
          expirations: <ExpirationsTab items={expirationItems} upcomingRefNumbers={upcomingRefNumbers} />,
          'par-levels': <ParLevelsTab parLevels={parLevels} onHandMap={onHandMap} replenishments={replenishments} />,
          analytics: <AnalyticsTab data={analyticsData} />,
          audit: <AuditTab sessions={auditSessions} activityEvents={activityEvents} facilityName={facilityName} />,
        }}
      />
    </>
  )
}
