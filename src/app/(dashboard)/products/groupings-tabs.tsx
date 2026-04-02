'use client'

import { useState, ReactNode } from 'react'

const TABS = [
  { id: 'facilities', label: 'Facilities' },
  { id: 'surgeons', label: 'Surgeons' },
  { id: 'products', label: 'Implants' },
  { id: 'kits', label: 'Kits' },
  { id: 'set_sizes', label: 'Set Sizes' },
  { id: 'trays', label: 'Instrument Trays' },
  { id: 'instruments', label: 'Instruments' },
]

export default function GroupingsTabs({
  facilitiesContent,
  surgeonsContent,
  productsContent,
  kitsContent,
  setSizesContent,
  traysContent,
  instrumentsContent,
  facilityCount,
  surgeonCount,
  productCount,
  kitCount,
  setSizesCount,
  trayCount,
  instrumentCount,
}: {
  facilitiesContent: ReactNode
  surgeonsContent: ReactNode
  productsContent: ReactNode
  kitsContent: ReactNode
  setSizesContent: ReactNode
  traysContent: ReactNode
  instrumentsContent: ReactNode
  facilityCount: number
  surgeonCount: number
  productCount: number
  kitCount: number
  setSizesCount: number
  trayCount: number
  instrumentCount: number
}) {
  const [tab, setTab] = useState('facilities')

  const counts: Record<string, number> = {
    facilities: facilityCount,
    surgeons: surgeonCount,
    products: productCount,
    kits: kitCount,
    set_sizes: setSizesCount,
    trays: trayCount,
    instruments: instrumentCount,
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
              {counts[t.id] > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>{counts[t.id]}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div key="facilities">{tab === 'facilities' && facilitiesContent}</div>
      <div key="surgeons">{tab === 'surgeons' && surgeonsContent}</div>
      <div key="products">{tab === 'products' && productsContent}</div>
      <div key="kits">{tab === 'kits' && kitsContent}</div>
      <div key="set_sizes">{tab === 'set_sizes' && setSizesContent}</div>
      <div key="trays">{tab === 'trays' && traysContent}</div>
      <div key="instruments">{tab === 'instruments' && instrumentsContent}</div>
    </div>
  )
}
