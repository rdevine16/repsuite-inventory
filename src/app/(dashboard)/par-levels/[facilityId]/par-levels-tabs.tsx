'use client'

import { useState } from 'react'
import KneeParGrid from './knee-par-grid'
import HipParGrid from './hip-par-grid'

export default function ParLevelsTabs({
  facilityId,
  parMap,
  onHandMap,
  canEdit,
  kneePars,
  hipPars,
}: {
  facilityId: string
  parMap: Record<string, number>
  onHandMap: Record<string, number>
  canEdit: boolean
  kneePars: number
  hipPars: number
}) {
  const [tab, setTab] = useState<'knee' | 'hip'>('knee')

  return (
    <>
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('knee')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
              tab === 'knee'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Knee
            {kneePars > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                tab === 'knee' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>{kneePars}</span>
            )}
          </button>
          <button
            onClick={() => setTab('hip')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
              tab === 'hip'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Hip
            {hipPars > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                tab === 'hip' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>{hipPars}</span>
            )}
          </button>
        </nav>
      </div>

      {tab === 'knee' ? (
        <KneeParGrid
          facilityId={facilityId}
          parMap={parMap}
          onHandMap={onHandMap}
          canEdit={canEdit}
        />
      ) : (
        <HipParGrid
          facilityId={facilityId}
          parMap={parMap}
          onHandMap={onHandMap}
          canEdit={canEdit}
        />
      )}
    </>
  )
}
