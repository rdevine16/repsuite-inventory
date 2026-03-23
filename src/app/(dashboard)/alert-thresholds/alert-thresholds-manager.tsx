'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { COMPONENTS } from '@/lib/preference-config'

interface Threshold {
  id: string
  category: string
  variant: string
  size: string
  min_quantity: number
}

interface Facility {
  id: string
  name: string
  smart_tracking_enabled: boolean
}

export default function AlertThresholdsManager({
  thresholds,
  facilities,
  userRole,
}: {
  thresholds: Threshold[]
  facilities: Facility[]
  userRole: string
}) {
  const [tab, setTab] = useState<'thresholds' | 'facilities'>('facilities')
  const [rechecking, setRechecking] = useState(false)
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const scheduleRecheck = useCallback(() => {
    if (recheckTimer.current) clearTimeout(recheckTimer.current)
    recheckTimer.current = setTimeout(async () => {
      setRechecking(true)
      try {
        await fetch('/api/check-inventory', { method: 'POST' })
        router.refresh()
      } catch {
        // silent
      } finally {
        setRechecking(false)
      }
    }, 2000)
  }, [router])

  const thresholdMap: Record<string, number> = {}
  thresholds.forEach((t) => {
    thresholdMap[`${t.category}|${t.variant}|${t.size}`] = t.min_quantity
  })

  const enabledCount = facilities.filter((f) => f.smart_tracking_enabled).length

  const toggleFacility = async (facilityId: string, enabled: boolean) => {
    await supabase
      .from('facilities')
      .update({ smart_tracking_enabled: enabled })
      .eq('id', facilityId)
    router.refresh()
  }

  const setThreshold = async (category: string, variant: string, size: string, qty: number) => {
    const key = `${category}|${variant}|${size}`
    const existing = thresholds.find(
      (t) => t.category === category && t.variant === variant && t.size === size
    )
    if (existing) {
      await supabase.from('alert_thresholds').update({ min_quantity: qty }).eq('id', existing.id)
    } else {
      await supabase.from('alert_thresholds').insert({ category, variant, size, min_quantity: qty })
    }
    router.refresh()
    scheduleRecheck()
  }

  return (
    <div className="space-y-4">
      {rechecking && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Recalculating alerts...
        </div>
      )}
      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('facilities')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'facilities' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Facilities ({enabledCount}/{facilities.length} enabled)
        </button>
        <button
          onClick={() => setTab('thresholds')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'thresholds' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Implant Thresholds ({thresholds.length} set)
        </button>
      </div>

      {tab === 'facilities' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm text-gray-500">
              Enable smart tracking per facility. Only facilities with completed inventory scans should be enabled.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Facility</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Smart Tracking</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id} className="border-b border-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{f.name}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => canEdit && toggleFacility(f.id, !f.smart_tracking_enabled)}
                      disabled={!canEdit}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        f.smart_tracking_enabled ? 'bg-blue-600' : 'bg-gray-200'
                      } ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        f.smart_tracking_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'thresholds' && (
        <ThresholdGrid
          thresholdMap={thresholdMap}
          canEdit={canEdit}
          onSet={setThreshold}
        />
      )}
    </div>
  )
}

// Size ranges for each component
const COMPONENT_SIZES: Record<string, string[]> = {
  knee_femur: ['1', '2', '3', '4', '5', '6', '7', '8'],
  knee_tibia: ['1', '2', '3', '4', '5', '6', '7', '8'],
  knee_poly: ['9', '10', '11', '12', '13', '14', '16', '19', '22', '25', '28', '31'],
  knee_patella: ['27', '29', '31', '32', '33', '35', '36', '38', '39', '40'],
  hip_stem: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
  hip_cup: ['42A', '44B', '46C', '48D', '50D', '52E', '54E', '56F', '58F', '60G', '62G'],
  hip_liner: ['28mm', '32mm', '36mm', '40mm'],
  hip_head: ['28mm', '32mm', '36mm'],
}

// Variant-specific size overrides (only sizes that apply to that variant)
const VARIANT_SIZES: Record<string, Record<string, string[]>> = {
  knee_poly: {
    cs: ['9', '10', '11', '12', '13', '14', '16', '19'],
    ps: ['9', '10', '11', '12', '13', '14', '16', '19'],
    ts: ['9', '11', '13', '16', '19', '22', '25', '28', '31'],
  },
  knee_patella: {
    asym_cemented: ['29', '32', '35', '38', '40'],
    asym_pressfit: ['29', '32', '35', '38', '40'],
    sym_cemented: ['27', '29', '31', '33', '36', '39'],
    sym_pressfit: ['29', '31', '33', '36', '39'],
  },
}

function ThresholdGrid({
  thresholdMap,
  canEdit,
  onSet,
}: {
  thresholdMap: Record<string, number>
  canEdit: boolean
  onSet: (category: string, variant: string, size: string, qty: number) => void
}) {
  const [section, setSection] = useState('knee')

  const components = COMPONENTS[section] ?? []

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSection('knee')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            section === 'knee' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Knee
        </button>
        <button
          onClick={() => setSection('hip')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            section === 'hip' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Hip
        </button>
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
        Set the minimum number of each implant you want on hand (left + right combined for femur). Alert fires when inventory drops below this number.
        Default is <strong>1</strong> (alert when zero remaining). Set to <strong>2</strong> for sizes you want a backup.
      </div>

      {components.map((comp) => {
        const sizes = COMPONENT_SIZES[comp.id] ?? []
        if (sizes.length === 0) return null

        return (
          <div key={comp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{comp.label}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium sticky left-0 bg-white">Variant</th>
                    {sizes.map((size) => (
                      <th key={size} className="text-center py-2 px-2 text-gray-500 font-medium min-w-[40px]">{size}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comp.variants.map((v) => {
                    const variantSizes = VARIANT_SIZES[comp.id]?.[v.id]
                    return (
                      <tr key={v.id} className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-700 font-medium sticky left-0 bg-white whitespace-nowrap">{v.label}</td>
                        {sizes.map((size) => {
                          // If variant has specific sizes, skip non-applicable ones
                          if (variantSizes && !variantSizes.includes(size)) {
                            return <td key={size} className="py-1 px-1 text-center bg-gray-50" />
                          }
                          const key = `${comp.id}|${v.id}|${size}`
                          const current = thresholdMap[key] ?? 1
                          return (
                            <td key={size} className="py-1 px-1 text-center">
                              {canEdit ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={9}
                                  value={current}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    if (!isNaN(val) && val >= 0) onSet(comp.id, v.id, size, val)
                                  }}
                                  className={`w-8 h-7 text-center text-xs border rounded ${
                                    current >= 2 ? 'border-blue-300 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-600'
                                  } focus:ring-1 focus:ring-blue-500 outline-none`}
                                />
                              ) : (
                                <span className={`${current >= 2 ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>
                                  {current}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
