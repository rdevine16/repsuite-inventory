'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { KNEE_SECTIONS } from '@/lib/knee-config'

export default function KneeParGrid({
  facilityId,
  parMap: initialParMap,
  canEdit,
}: {
  facilityId: string
  parMap: Record<string, number>
  canEdit: boolean
}) {
  const [parMap, setParMap] = useState(initialParMap)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const savePar = useCallback(
    async (category: string, variant: string, size: string, value: number) => {
      const key = `${category}|${variant}|${size}`
      setSaving(key)
      setParMap((prev) => ({ ...prev, [key]: value }))

      const { error } = await supabase.from('component_par_levels').upsert(
        {
          facility_id: facilityId,
          category,
          variant,
          size,
          par_quantity: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'facility_id,category,variant,size' }
      )

      if (error) console.error('Failed to save:', error)
      setSaving(null)
    },
    [facilityId, supabase]
  )

  return (
    <div className="space-y-4">
      {KNEE_SECTIONS.map((section) => {
        const isCollapsed = collapsed[section.id] ?? false

        // Count pars set in this section
        const sectionParCount = Object.keys(parMap).filter(
          (k) => k.startsWith(section.id + '|') && parMap[k] > 0
        ).length

        return (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h3 className="font-semibold text-gray-900">{section.label}</h3>
                {sectionParCount > 0 && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    {sectionParCount} set
                  </span>
                )}
              </div>
            </button>

            {/* Section Content */}
            {!isCollapsed && (
              <div className="border-t border-gray-100 overflow-x-auto">
                {section.fixationGroups ? (
                  <FixationGrid
                    section={section}
                    parMap={parMap}
                    saving={saving}
                    canEdit={canEdit}
                    onSave={savePar}
                  />
                ) : (
                  <PolyGrid
                    section={section}
                    parMap={parMap}
                    saving={saving}
                    canEdit={canEdit}
                    onSave={savePar}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Grid for fixation-based components (femurs, tibias, patella)
function FixationGrid({
  section,
  parMap,
  saving,
  canEdit,
  onSave,
}: {
  section: (typeof KNEE_SECTIONS)[number]
  parMap: Record<string, number>
  saving: string | null
  canEdit: boolean
  onSave: (category: string, variant: string, size: string, value: number) => void
}) {
  if (!section.fixationGroups) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sizeExclusions: Record<string, string[]> | null = 'sizeExclusions' in section ? (section as any).sizeExclusions : null

  return (
    <div className="divide-y divide-gray-100">
      {section.fixationGroups.map((group) => (
        <div key={group.label}>
          {/* Fixation type header */}
          <div className="px-5 py-2.5 bg-gray-50/70">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {group.label}
            </span>
          </div>

          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-2 px-5 text-xs font-medium text-gray-400 w-44"></th>
                {section.sizes.map((size) => (
                  <th key={size} className="text-center py-2 px-1 text-xs font-medium text-gray-400 min-w-[60px]">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.variants.map((variant) => (
                <tr key={variant.id} className="border-t border-gray-50">
                  <td className="py-2 px-5 text-sm font-medium text-gray-700">{variant.label}</td>
                  {section.sizes.map((size) => {
                    const excluded = sizeExclusions?.[variant.id]?.includes(size)
                    if (excluded) {
                      return <td key={size} className="py-2 px-1 text-center"><span className="text-gray-200">—</span></td>
                    }
                    return (
                      <td key={size} className="py-2 px-1">
                        <ParCell
                          parKey={`${section.id}|${variant.id}|${size}`}
                          value={parMap[`${section.id}|${variant.id}|${size}`] ?? 0}
                          saving={saving}
                          canEdit={canEdit}
                          onSave={(val) => onSave(section.id, variant.id, size, val)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// Grid for poly inserts (no fixation, size × thickness)
function PolyGrid({
  section,
  parMap,
  saving,
  canEdit,
  onSave,
}: {
  section: (typeof KNEE_SECTIONS)[number]
  parMap: Record<string, number>
  saving: string | null
  canEdit: boolean
  onSave: (category: string, variant: string, size: string, value: number) => void
}) {
  const variants = 'variants' in section ? (section.variants as readonly string[]) : []
  const rowLabel = 'rowLabel' in section ? (section.rowLabel as string) : 'Variant'
  const sizeLabel = 'sizeLabel' in section ? (section.sizeLabel as string) : 'Size'

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left py-2 px-5 text-xs font-medium text-gray-400 w-24">{rowLabel}</th>
          {section.sizes.map((size) => (
            <th key={size} className="text-center py-2 px-1 text-xs font-medium text-gray-400 min-w-[60px]">
              {size}{sizeLabel === 'Thickness' ? 'mm' : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {variants.map((variant) => (
          <tr key={variant} className="border-t border-gray-50">
            <td className="py-2 px-5 text-sm font-medium text-gray-700">{variant}</td>
            {section.sizes.map((size) => (
              <td key={size} className="py-2 px-1">
                <ParCell
                  parKey={`${section.id}|${variant}|${size}`}
                  value={parMap[`${section.id}|${variant}|${size}`] ?? 0}
                  saving={saving}
                  canEdit={canEdit}
                  onSave={(val) => onSave(section.id, variant, size, val)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Individual par level cell
function ParCell({
  parKey,
  value,
  saving,
  canEdit,
  onSave,
}: {
  parKey: string
  value: number
  saving: string | null
  canEdit: boolean
  onSave: (value: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const isSaving = saving === parKey

  const handleBlur = () => {
    setEditing(false)
    const parsed = parseInt(editValue) || 0
    if (parsed !== value) {
      onSave(parsed)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
    }
    if (e.key === 'Escape') {
      setEditValue(value.toString())
      setEditing(false)
    }
  }

  if (editing && canEdit) {
    return (
      <input
        type="number"
        min={0}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[52px] mx-auto block text-center text-sm py-1 px-1 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        autoFocus
      />
    )
  }

  const isEmpty = value === 0
  return (
    <button
      onClick={() => {
        if (!canEdit) return
        setEditValue(value.toString())
        setEditing(true)
      }}
      disabled={!canEdit}
      className={`w-full max-w-[52px] mx-auto block text-center text-sm py-1 px-1 rounded-md transition ${
        isSaving
          ? 'bg-blue-50 text-blue-400'
          : isEmpty
          ? 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
          : 'bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100'
      } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {isEmpty ? '·' : value}
    </button>
  )
}
