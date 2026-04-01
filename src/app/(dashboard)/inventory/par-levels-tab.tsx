'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import ParLevelBar from './par-level-bar'

export interface ParLevelEntry {
  category: string
  variant: string
  size: string
  par_quantity: number
}

export interface ReplenishmentRequest {
  id: string
  component: string
  variant: string
  kit_template_name: string | null
  missing_sizes: string[] | null
  status: string
  surgeon_name: string | null
  surgery_date: string | null
  case_id: string | null
}

const COMPONENT_LABELS: Record<string, string> = {
  knee_femur: 'Knee Femur',
  knee_tibia: 'Knee Tibia',
  knee_poly: 'Knee Poly',
  knee_patella: 'Knee Patella',
  hip_stem: 'Hip Stem',
  hip_cup: 'Hip Cup',
  hip_liner: 'Hip Liner',
  hip_head: 'Hip Head',
}

const VARIANT_LABELS: Record<string, Record<string, string>> = {
  knee_femur: { cr_pressfit: 'CR Pressfit', cr_cemented: 'CR Cemented', ps_pressfit: 'PS Pressfit', ps_cemented: 'PS Cemented', ps_pro_cemented: 'PS Pro' },
  knee_tibia: { primary: 'Primary', universal: 'Universal', mis: 'MIS', tritanium: 'Tritanium' },
  knee_poly: { cs: 'CS', ps: 'PS', ts: 'TS' },
  knee_patella: { asym_cemented: 'Asym Cemented', sym_cemented: 'Sym Cemented', asym_pressfit: 'Asym Pressfit', sym_pressfit: 'Sym Pressfit' },
  hip_stem: { accolade_ii_132: 'Accolade II 132°', accolade_ii_127: 'Accolade II 127°', accolade_c_132: 'Accolade C 132°', accolade_c_127: 'Accolade C 127°', insignia_standard: 'Insignia Std', insignia_high: 'Insignia High' },
  hip_cup: { trident_ii_tritanium: 'Trident II Tritanium', trident_psl_ha: 'Trident PSL HA' },
  hip_liner: { x3_0: 'X3 0°', x3_10: 'X3 10°', x3_ecc: 'X3 Ecc', mdm_cocr: 'MDM CoCr', mdm_x3: 'MDM X3' },
  hip_head: { delta_ceramic: 'Delta Ceramic', v40_cocr: 'V40 CoCr' },
}

const statusBadge: Record<string, { label: string; className: string }> = {
  proposed: { label: 'Proposed', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-600' },
}

interface GroupData {
  category: string
  label: string
  rows: {
    variant: string
    size: string
    variantLabel: string
    current: number
    target: number
    gap: number
  }[]
  atPar: number
  total: number
}

export default function ParLevelsTab({
  parLevels,
  onHandMap,
  replenishments,
}: {
  parLevels: ParLevelEntry[]
  onHandMap: Record<string, number>
  replenishments: ReplenishmentRequest[]
}) {
  const { groups, gapRows } = useMemo(() => {
    const groupMap = new Map<string, GroupData>()

    for (const pl of parLevels) {
      if (!groupMap.has(pl.category)) {
        groupMap.set(pl.category, {
          category: pl.category,
          label: COMPONENT_LABELS[pl.category] ?? pl.category,
          rows: [],
          atPar: 0,
          total: 0,
        })
      }

      const group = groupMap.get(pl.category)!
      const key = `${pl.category}|${pl.variant}|${pl.size}`
      const current = onHandMap[key] ?? 0
      const gap = Math.max(0, pl.par_quantity - current)
      const variantLabel = VARIANT_LABELS[pl.category]?.[pl.variant] ?? pl.variant

      group.rows.push({
        variant: pl.variant,
        size: pl.size,
        variantLabel,
        current,
        target: pl.par_quantity,
        gap,
      })
      group.total++
      if (current >= pl.par_quantity) group.atPar++
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label))

    // Gap analysis: all rows with gap > 0, sorted by largest gap
    const gapRows = groups
      .flatMap((g) =>
        g.rows
          .filter((r) => r.gap > 0)
          .map((r) => ({ ...r, categoryLabel: g.label }))
      )
      .sort((a, b) => b.gap - a.gap)

    return { groups, gapRows }
  }, [parLevels, onHandMap])

  if (parLevels.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">No par levels configured for this facility.</p>
        <Link href="/par-levels" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
          Configure par levels →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Component group summaries */}
      {groups.map((group) => (
        <div key={group.category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
            <span className={`text-xs font-medium ${
              group.atPar === group.total ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {group.atPar} of {group.total} at par
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {group.rows.map((row) => (
              <div
                key={`${row.variant}-${row.size}`}
                className="px-5 py-2.5 flex items-center gap-4"
              >
                <div className="w-32 flex-shrink-0">
                  <span className="text-sm text-gray-700">{row.variantLabel}</span>
                </div>
                <div className="w-16 flex-shrink-0">
                  <span className="text-xs text-gray-500 font-mono">{row.size}</span>
                </div>
                <div className="flex-1">
                  <ParLevelBar current={row.current} target={row.target} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Gap Analysis */}
      {gapRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Gap Analysis</h3>
            <p className="text-xs text-gray-500 mt-0.5">Items needed to reach par, sorted by largest gap</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Component</th>
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Variant</th>
                <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Size</th>
                <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">On Hand</th>
                <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">Target</th>
                <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">Gap</th>
              </tr>
            </thead>
            <tbody>
              {gapRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-5 text-gray-900 text-sm">{row.categoryLabel}</td>
                  <td className="py-2 px-5 text-gray-600 text-sm">{row.variantLabel}</td>
                  <td className="py-2 px-5 text-gray-600 font-mono text-xs">{row.size}</td>
                  <td className="py-2 px-5 text-right text-gray-600">{row.current}</td>
                  <td className="py-2 px-5 text-right text-gray-600">{row.target}</td>
                  <td className="py-2 px-5 text-right font-medium text-red-600">-{row.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Replenishments */}
      {replenishments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Pending Replenishments</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {replenishments.map((r) => {
              const badge = statusBadge[r.status] ?? { label: r.status, className: 'bg-gray-100 text-gray-600' }
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {r.kit_template_name ?? `${COMPONENT_LABELS[r.component] ?? r.component} — ${VARIANT_LABELS[r.component]?.[r.variant] ?? r.variant}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.surgeon_name && `${r.surgeon_name} · `}
                      {r.surgery_date && new Date(r.surgery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {r.missing_sizes && ` · Missing: ${r.missing_sizes.join(', ')}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
