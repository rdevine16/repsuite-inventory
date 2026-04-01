'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode } from 'react'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'expirations', label: 'Expirations' },
  { id: 'par-levels', label: 'Par Levels' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
] as const

export type TabId = (typeof TABS)[number]['id']

interface Facility {
  id: string
  name: string
}

export default function DashboardTabs({
  facilities,
  selectedFacility,
  activeTab,
  children,
}: {
  facilities: Facility[]
  selectedFacility: string
  activeTab: TabId
  children: Record<TabId, ReactNode>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value)
    }
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Facility selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Facility</label>
        <select
          value={selectedFacility}
          onChange={(e) => updateParams({ facility: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Dashboard tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateParams({ tab: tab.id })}
              className={`whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active tab content */}
      <div>{children[activeTab]}</div>
    </div>
  )
}
