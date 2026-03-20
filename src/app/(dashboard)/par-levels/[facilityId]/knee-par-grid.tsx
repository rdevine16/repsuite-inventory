'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { KNEE_SECTIONS } from '@/lib/knee-config'

type Section = (typeof KNEE_SECTIONS)[number]

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
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [selectedFixation, setSelectedFixation] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  const activeSection = KNEE_SECTIONS.find((s) => s.id === selectedSection)
  const hasFixation = activeSection?.fixationGroups != null
  const activeFixation = hasFixation
    ? activeSection?.fixationGroups?.find((g) => g.label === selectedFixation)
    : null

  // Should show the grid?
  const showGrid = activeSection && (!hasFixation || activeFixation)

  const savePar = useCallback(
    async (category: string, variant: string, size: string, value: number) => {
      const key = `${category}|${variant}|${size}`
      setSaving(key)
      setParMap((prev) => ({ ...prev, [key]: value }))

      await supabase.from('component_par_levels').upsert(
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
      setSaving(null)
    },
    [facilityId, supabase]
  )

  // Count pars set per section
  const sectionParCount = (sectionId: string) =>
    Object.keys(parMap).filter((k) => k.startsWith(sectionId + '|') && parMap[k] > 0).length

  // Count pars set per fixation group within a section
  const fixationParCount = (sectionId: string, variants: readonly { id: string }[]) => {
    const variantIds = variants.map((v) => v.id)
    return Object.keys(parMap).filter((k) => {
      if (!k.startsWith(sectionId + '|') || parMap[k] <= 0) return false
      const parts = k.split('|')
      return variantIds.includes(parts[1])
    }).length
  }

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[500px]">
      {/* Column 1: Component Types */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/50">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Component</span>
        </div>
        <nav className="py-1">
          {KNEE_SECTIONS.map((section) => {
            const isActive = selectedSection === section.id
            const count = sectionParCount(section.id)
            return (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedSection(section.id)
                  setSelectedFixation(null)
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{section.label}</span>
                <div className="flex items-center gap-1.5">
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                  <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Column 2: Fixation Types (or grid if no fixation) */}
      {selectedSection && hasFixation && (
        <div className="w-52 shrink-0 border-r border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fixation</span>
          </div>
          <nav className="py-1">
            {activeSection?.fixationGroups?.map((group) => {
              const isActive = selectedFixation === group.label
              const count = fixationParCount(activeSection.id, group.variants)
              return (
                <button
                  key={group.label}
                  onClick={() => setSelectedFixation(group.label)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{group.label}</span>
                  <div className="flex items-center gap-1.5">
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                    <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Column 3 (or 2 for polys): Par Level Grid */}
      {showGrid ? (
        <div className="flex-1 overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-200 bg-white sticky top-0">
            <span className="text-sm font-semibold text-gray-900">
              {activeSection.label}
              {activeFixation && <span className="text-gray-400 font-normal"> / {activeFixation.label}</span>}
            </span>
          </div>
          <div className="p-4">
            {activeFixation ? (
              <FixationGrid
                section={activeSection}
                fixation={activeFixation}
                parMap={parMap}
                saving={saving}
                canEdit={canEdit}
                onSave={savePar}
              />
            ) : (
              <PolyGrid
                section={activeSection}
                parMap={parMap}
                saving={saving}
                canEdit={canEdit}
                onSave={savePar}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          {!selectedSection
            ? 'Select a component type'
            : 'Select a fixation type'}
        </div>
      )}
    </div>
  )
}

function FixationGrid({
  section,
  fixation,
  parMap,
  saving,
  canEdit,
  onSave,
}: {
  section: Section
  fixation: { label: string; variants: readonly { id: string; label: string }[]; sizes?: readonly string[] }
  parMap: Record<string, number>
  saving: string | null
  canEdit: boolean
  onSave: (category: string, variant: string, size: string, value: number) => void
}) {
  // Use fixation-specific sizes if available, otherwise fall back to section sizes
  const sizes = fixation.sizes ?? section.sizes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sizesByVariant: Record<string, string[]> | null = 'sizesByVariant' in section ? (section as any).sizesByVariant : null

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-44"></th>
          {sizes.map((size) => (
            <th key={size} className="text-center py-2 px-1 text-xs font-semibold text-gray-500 min-w-[56px]">
              {size}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {fixation.variants.map((variant) => {
          const validSizes = sizesByVariant?.[variant.id]
          return (
            <tr key={variant.id} className="border-t border-gray-100">
              <td className="py-2.5 pr-4 text-sm font-medium text-gray-700">{variant.label}</td>
              {sizes.map((size) => {
                if (validSizes && !validSizes.includes(size as string)) {
                  return <td key={size} className="py-2.5 px-1 text-center"><span className="text-gray-200">—</span></td>
                }
                return (
                  <td key={size} className="py-2.5 px-1">
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
          )
        })}
      </tbody>
    </table>
  )
}

function PolyGrid({
  section,
  parMap,
  saving,
  canEdit,
  onSave,
}: {
  section: Section
  parMap: Record<string, number>
  saving: string | null
  canEdit: boolean
  onSave: (category: string, variant: string, size: string, value: number) => void
}) {
  const variants = 'variants' in section ? (section.variants as readonly string[]) : []
  const rowLabel = 'rowLabel' in section ? (section.rowLabel as string) : ''
  const sizeLabel = 'sizeLabel' in section ? (section.sizeLabel as string) : ''

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-24">
            {rowLabel}
          </th>
          {section.sizes.map((size) => (
            <th key={size} className="text-center py-2 px-1 text-xs font-semibold text-gray-500 min-w-[56px]">
              {size}{sizeLabel === 'Thickness' ? 'mm' : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {variants.map((variant) => (
          <tr key={variant} className="border-t border-gray-100">
            <td className="py-2.5 pr-4 text-sm font-medium text-gray-700">{variant}</td>
            {section.sizes.map((size) => (
              <td key={size} className="py-2.5 px-1">
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
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
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
        className="w-full max-w-[52px] mx-auto block text-center text-sm py-1.5 px-1 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
      className={`w-full max-w-[52px] mx-auto block text-center text-sm py-1.5 px-1 rounded-lg transition ${
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
