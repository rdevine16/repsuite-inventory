'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'


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

export interface InventoryItemForPar {
  reference_number: string | null
  description: string | null
  gridKey: string | null
}

const COMPONENT_LABELS: Record<string, string> = {
  knee_femur: 'Knee Femur',
  knee_tibia: 'Knee Tibia',
  knee_poly_cs: 'Knee Poly — CS Insert',
  knee_poly_ps: 'Knee Poly — PS Insert',
  knee_poly_ts: 'Knee Poly — TS Insert',
  knee_patella: 'Knee Patella',
  knee_tibial_stem: 'Tibial Stem',
  hip_stem: 'Hip Stem',
  hip_cup: 'Hip Cup',
  hip_liner_x3_0: 'Hip Liner — Trident X3 0°',
  hip_liner_x3_10: 'Hip Liner — Trident X3 10°',
  hip_liner_x3_ecc: 'Hip Liner — Trident X3 Eccentric',
  hip_liner_mdm_cocr: 'Hip Liner — MDM CoCr',
  hip_liner_mdm_x3: 'Hip Liner — MDM X3',
  hip_head_delta: 'Hip Head — Delta Ceramic',
  hip_head_v40: 'Hip Head — V40 CoCr',
  hip_head_universal: 'Hip Head — Universal',
  hip_bipolar: 'Hip Bipolar',
  hip_screw: 'Hip Screw',
}

const VARIANT_LABELS: Record<string, Record<string, string>> = {
  knee_femur: {
    right_cr_pressfit: 'Triathlon Right CR Pressfit',
    right_cr_cemented: 'Triathlon Right CR Cemented',
    right_ps_pressfit: 'Triathlon Right PS Pressfit',
    right_ps_cemented: 'Triathlon Right PS Cemented',
    right_ps_pro_cemented: 'Triathlon Right PS Pro',
    left_cr_pressfit: 'Triathlon Left CR Pressfit',
    left_cr_cemented: 'Triathlon Left CR Cemented',
    left_ps_pressfit: 'Triathlon Left PS Pressfit',
    left_ps_cemented: 'Triathlon Left PS Cemented',
    left_ps_pro_cemented: 'Triathlon Left PS Pro',
  },
  knee_tibia: { primary: 'Triathlon Primary', universal: 'Triathlon Universal', mis: 'Triathlon MIS', tritanium: 'Triathlon Tritanium' },
  knee_patella: { asym_cemented: 'Asymmetric Cemented', sym_cemented: 'Symmetric Cemented', asym_pressfit: 'Asymmetric Pressfit', sym_pressfit: 'Symmetric Pressfit' },
  knee_tibial_stem: { '50mm': '50mm Length', '100mm': '100mm Length' },
  hip_stem: { accolade_ii_132: 'Accolade II 132°', accolade_ii_127: 'Accolade II 127°', accolade_c_132: 'Accolade C 132°', accolade_c_127: 'Accolade C 127°', insignia_standard: 'Insignia Standard', insignia_high: 'Insignia High Offset' },
  hip_cup: { trident_ii_tritanium: 'Trident II Tritanium', trident_ii_multihole: 'Trident II Multihole', trident_psl_ha: 'Trident PSL HA' },
  hip_bipolar: { '26mm': 'UHR 26mm' },
  hip_screw: { hex_6_5mm: 'Hex 6.5mm', torx_6_5mm: 'Torx 6.5mm' },
}

// Resolve a grid key like "knee_poly|cs|5" into clean labels
function resolveGridKeyLabels(gridKey: string): { category: string; variant: string; size: string } {
  const [cat, variant, size] = gridKey.split('|')
  const categoryLabel = COMPONENT_LABELS[cat] ?? cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const variantLabel = VARIANT_LABELS[cat]?.[variant] ?? variant.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { category: categoryLabel, variant: variantLabel, size: size ?? '' }
}

const statusBadge: Record<string, { label: string; className: string }> = {
  proposed: { label: 'Proposed', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-600' },
}

interface CellData {
  current: number
  target: number
  gap: number
}

interface MatrixGroup {
  category: string
  label: string
  variants: string[]
  variantLabels: Record<string, string>
  sizes: string[]
  cells: Record<string, CellData> // key: `${variant}|${size}`
  atPar: number
  overPar: number
  total: number
  totalGap: number
}

function cellColor(current: number, target: number): string {
  if (current > target) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (target === 0 && current === 0) return 'bg-gray-50 text-gray-400'
  const pct = target > 0 ? current / target : 0
  if (pct >= 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (pct >= 0.5) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (current === 0) return 'bg-red-100 text-red-800 border-red-300'
  return 'bg-red-50 text-red-700 border-red-200'
}

function cellDot(current: number, target: number): string {
  if (target === 0) return 'bg-gray-300'
  const pct = current / target
  if (pct >= 1) return 'bg-emerald-500'
  if (pct >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

// Categories where the matrix should be transposed: variants on Y-axis, sizes on X-axis
// Transposed = variants on Y-axis, sizes on X-axis
const TRANSPOSED_CATEGORIES = new Set([
  'hip_stem', 'hip_bipolar', 'hip_cup',
  'hip_liner_x3_0', 'hip_liner_x3_10', 'hip_liner_x3_ecc', 'hip_liner_mdm_cocr', 'hip_liner_mdm_x3',
  'hip_head_delta', 'hip_head_v40', 'hip_head_universal',
  'hip_screw',
  'knee_femur', 'knee_patella', 'knee_tibia', 'knee_tibial_stem',
])

function ComponentMatrix({ group }: { group: MatrixGroup }) {
  const healthPct = group.total > 0 ? Math.round((group.atPar / group.total) * 100) : 0
  const healthColor = healthPct === 100 ? 'text-emerald-600' : healthPct >= 75 ? 'text-amber-600' : 'text-red-600'
  const transposed = TRANSPOSED_CATEGORIES.has(group.category)

  const colHeaders = transposed ? group.sizes : group.variants.map((v) => group.variantLabels[v])
  const rowKeys = transposed ? group.variants : group.sizes
  const rowLabels = transposed
    ? group.variants.map((v) => group.variantLabels[v])
    : group.sizes
  const cornerLabel = transposed ? 'Variant' : 'Size'

  const getCell = (rowIdx: number, colIdx: number): CellData | undefined => {
    if (transposed) {
      const variant = group.variants[rowIdx]
      const size = group.sizes[colIdx]
      return group.cells[`${variant}|${size}`]
    } else {
      const size = group.sizes[rowIdx]
      const variant = group.variants[colIdx]
      return group.cells[`${variant}|${size}`]
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${healthPct === 100 ? 'bg-emerald-500' : healthPct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} />
            <span className={`text-xs font-medium ${healthColor}`}>
              {healthPct}% at par
            </span>
          </div>
          {group.overPar > 0 && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
              {group.overPar} over par
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {group.atPar}/{group.total} sizes stocked
          {group.totalGap > 0 && (
            <span className="text-red-500 ml-2">({group.totalGap} units needed)</span>
          )}
        </span>
      </div>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-4 text-[11px] font-medium text-gray-400 tracking-wider w-20">
                {cornerLabel}
              </th>
              {colHeaders.map((label, i) => (
                <th
                  key={i}
                  className="text-center py-2 px-2 text-[11px] font-medium text-gray-500 tracking-wider"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((_, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                <td className="py-1.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                  {rowLabels[rIdx]}
                </td>
                {colHeaders.map((_, cIdx) => {
                  const cell = getCell(rIdx, cIdx)
                  if (!cell) {
                    return (
                      <td key={cIdx} className="py-1.5 px-2 text-center">
                        <span className="text-[10px] text-gray-300">—</span>
                      </td>
                    )
                  }
                  const overPar = cell.current > cell.target
                  return (
                    <td key={cIdx} className="py-1.5 px-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[40px] px-1.5 py-0.5 rounded text-xs font-medium border ${cellColor(cell.current, cell.target)}`}
                        title={`${cell.current} on hand / ${cell.target} par${cell.gap > 0 ? ` (need ${cell.gap})` : ''}${overPar ? ` (+${cell.current - cell.target} over)` : ''}`}
                      >
                        {cell.current}/{cell.target}
                        {overPar && <span className="ml-0.5 text-[9px]">+{cell.current - cell.target}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface NoParItem {
  gridKey: string
  categoryLabel: string
  variantLabel: string
  size: string
  count: number
  sampleRefs: string[]
}

export default function ParLevelsTab({
  parLevels,
  onHandMap,
  replenishments,
  inventoryItems,
  facilityName,
}: {
  parLevels: ParLevelEntry[]
  onHandMap: Record<string, number>
  replenishments: ReplenishmentRequest[]
  inventoryItems?: InventoryItemForPar[]
  facilityName?: string
}) {
  const [showGaps, setShowGaps] = useState(false)
  const [showNoPar, setShowNoPar] = useState(false)
  const [showOverPar, setShowOverPar] = useState(false)

  const { groups, gapRows, overParRows, noParItems, kpis } = useMemo(() => {
    const groupMap = new Map<string, MatrixGroup>()

    for (const pl of parLevels) {
      if (!groupMap.has(pl.category)) {
        groupMap.set(pl.category, {
          category: pl.category,
          label: COMPONENT_LABELS[pl.category] ?? pl.category,
          variants: [],
          variantLabels: {},
          sizes: [],
          cells: {},
          atPar: 0,
          overPar: 0,
          total: 0,
          totalGap: 0,
        })
      }

      const group = groupMap.get(pl.category)!
      const key = `${pl.category}|${pl.variant}|${pl.size}`
      const current = onHandMap[key] ?? 0
      const gap = Math.max(0, pl.par_quantity - current)
      const variantLabel = VARIANT_LABELS[pl.category]?.[pl.variant] ?? pl.variant

      if (!group.variantLabels[pl.variant]) {
        group.variants.push(pl.variant)
        group.variantLabels[pl.variant] = variantLabel
      }
      if (!group.sizes.includes(pl.size)) {
        group.sizes.push(pl.size)
      }

      group.cells[`${pl.variant}|${pl.size}`] = { current, target: pl.par_quantity, gap }
      group.total++
      group.totalGap += gap
      if (current >= pl.par_quantity) group.atPar++
      if (current > pl.par_quantity) group.overPar++
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label))

    // Sort sizes naturally within each group
    const sizeSort = (a: string, b: string) => {
      const numA = parseFloat(a)
      const numB = parseFloat(b)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    }
    groups.forEach((g) => g.sizes.sort(sizeSort))

    // Gap rows
    const gapRows = groups
      .flatMap((g) =>
        Object.entries(g.cells)
          .filter(([, cell]) => cell.gap > 0)
          .map(([key, cell]) => {
            const [variant, size] = key.split('|')
            return {
              categoryLabel: g.label,
              variantLabel: g.variantLabels[variant],
              size,
              current: cell.current,
              target: cell.target,
              gap: cell.gap,
            }
          })
      )
      .sort((a, b) => b.gap - a.gap)

    // Over-par rows
    const overParRows = groups
      .flatMap((g) =>
        Object.entries(g.cells)
          .filter(([, cell]) => cell.current > cell.target)
          .map(([key, cell]) => {
            const [variant, size] = key.split('|')
            return {
              categoryLabel: g.label,
              variantLabel: g.variantLabels[variant],
              size,
              current: cell.current,
              target: cell.target,
              over: cell.current - cell.target,
            }
          })
      )
      .sort((a, b) => b.over - a.over)

    // No-par items: inventory items whose grid key doesn't match any par level
    const parKeySet = new Set(parLevels.map((pl) => `${pl.category}|${pl.variant}|${pl.size}`))
    const noParMap = new Map<string, { count: number; refs: Set<string> }>()

    if (inventoryItems) {
      for (const item of inventoryItems) {
        if (!item.gridKey) continue
        if (parKeySet.has(item.gridKey)) continue
        const existing = noParMap.get(item.gridKey)
        if (existing) {
          existing.count++
          if (item.reference_number && existing.refs.size < 3) existing.refs.add(item.reference_number)
        } else {
          noParMap.set(item.gridKey, {
            count: 1,
            refs: new Set(item.reference_number ? [item.reference_number] : []),
          })
        }
      }
    }

    const noParItems: NoParItem[] = Array.from(noParMap.entries())
      .map(([gridKey, data]) => {
        const labels = resolveGridKeyLabels(gridKey)
        return {
          gridKey,
          categoryLabel: labels.category,
          variantLabel: labels.variant,
          size: labels.size,
          count: data.count,
          sampleRefs: Array.from(data.refs),
        }
      })
      .sort((a, b) => b.count - a.count)

    // KPIs
    const totalPositions = groups.reduce((s, g) => s + g.total, 0)
    const totalAtPar = groups.reduce((s, g) => s + g.atPar, 0)
    const totalGap = groups.reduce((s, g) => s + g.totalGap, 0)
    const totalOverPar = overParRows.reduce((s, r) => s + r.over, 0)
    const criticalGroups = groups.filter((g) => g.total > 0 && (g.atPar / g.total) < 0.5).length

    return {
      groups,
      gapRows,
      overParRows,
      noParItems,
      kpis: { totalPositions, totalAtPar, totalGap, totalOverPar, criticalGroups },
    }
  }, [parLevels, onHandMap, inventoryItems])

  const exportPDF = useCallback(async () => {
    // Dynamic imports to avoid SSR bundling issues with jspdf
    const jsPDFModule = await import(/* webpackChunkName: "jspdf" */ 'jspdf')
    const autoTableModule = await import(/* webpackChunkName: "jspdf-autotable" */ 'jspdf-autotable')
    const jsPDF = jsPDFModule.default
    const autoTable = autoTableModule.default

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    let y = 40

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Par Level Report', 40, y)
    y += 20
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`${facilityName ? facilityName + ' — ' : ''}Generated ${now}`, 40, y)
    y += 10
    doc.setFontSize(9)
    const pdfOverallPct = kpis.totalPositions > 0 ? Math.round((kpis.totalAtPar / kpis.totalPositions) * 100) : 0
    doc.text(
      `Overall: ${pdfOverallPct}% at par | ${kpis.totalPositions} positions | ${kpis.totalGap} units needed | ${kpis.totalOverPar} units over par | ${noParItems.length} items without par`,
      40, y
    )
    doc.setTextColor(0)
    y += 20

    for (const group of groups) {
      const transposed = TRANSPOSED_CATEGORIES.has(group.category)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      const healthPct = group.total > 0 ? Math.round((group.atPar / group.total) * 100) : 0
      doc.text(`${group.label}  —  ${healthPct}% at par  (${group.atPar}/${group.total})`, 40, y)
      y += 8

      const colLabels = transposed ? group.sizes : group.variants.map((v) => group.variantLabels[v])
      const rowLabelsArr = transposed ? group.variants.map((v) => group.variantLabels[v]) : group.sizes
      const corner = transposed ? 'Variant' : 'Size'

      const head = [[corner, ...colLabels]]
      const body = rowLabelsArr.map((label, rIdx) => {
        const cells = colLabels.map((_, cIdx) => {
          const variant = transposed ? group.variants[rIdx] : group.variants[cIdx]
          const size = transposed ? group.sizes[cIdx] : group.sizes[rIdx]
          const cell = group.cells[`${variant}|${size}`]
          if (!cell) return '—'
          const txt = `${cell.current}/${cell.target}`
          if (cell.current > cell.target) return `${txt} (+${cell.current - cell.target})`
          if (cell.gap > 0) return `${txt} (-${cell.gap})`
          return txt
        })
        return [label, ...cells]
      })

      autoTable(doc, {
        startY: y, head, body, theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        margin: { left: 40, right: 40 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index > 0) {
            const text = String(data.cell.raw ?? '')
            if (text.includes('(+')) {
              data.cell.styles.fillColor = [235, 245, 255]; data.cell.styles.textColor = [30, 64, 175]
            } else if (text.includes('(-')) {
              data.cell.styles.fillColor = [255, 240, 240]; data.cell.styles.textColor = [185, 28, 28]
            } else if (text !== '—') {
              data.cell.styles.fillColor = [240, 253, 244]; data.cell.styles.textColor = [21, 128, 61]
            }
          }
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 18
      if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 40 }
    }

    if (gapRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 40 }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Gap Analysis', 40, y); y += 8
      autoTable(doc, {
        startY: y,
        head: [['Component', 'Variant', 'Size', 'On Hand', 'Target', 'Gap']],
        body: gapRows.map((r) => [r.categoryLabel, r.variantLabel, r.size, String(r.current), String(r.target), `-${r.gap}`]),
        theme: 'striped', styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [254, 226, 226], textColor: [127, 29, 29], fontStyle: 'bold' },
        columnStyles: { 5: { textColor: [185, 28, 28], fontStyle: 'bold' } },
        margin: { left: 40, right: 40 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 18
    }

    if (overParRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 40 }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Over Par', 40, y); y += 8
      autoTable(doc, {
        startY: y,
        head: [['Component', 'Variant', 'Size', 'On Hand', 'Target', 'Over']],
        body: overParRows.map((r) => [r.categoryLabel, r.variantLabel, r.size, String(r.current), String(r.target), `+${r.over}`]),
        theme: 'striped', styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
        columnStyles: { 5: { textColor: [30, 64, 175], fontStyle: 'bold' } },
        margin: { left: 40, right: 40 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 18
    }

    if (noParItems.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 40 }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Items Without Par Level', 40, y); y += 8
      autoTable(doc, {
        startY: y,
        head: [['Component', 'Variant', 'Size', 'Qty', 'Sample Ref #']],
        body: noParItems.map((r) => [r.categoryLabel, r.variantLabel, r.size, String(r.count), r.sampleRefs.join(', ')]),
        theme: 'striped', styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold' },
        margin: { left: 40, right: 40 },
      })
    }

    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`RepSuite Inventory — Par Level Report — Page ${p} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' })
    }

    doc.save(`par-levels-${(facilityName ?? 'report').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`)
  }, [groups, gapRows, overParRows, noParItems, kpis, facilityName])

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

  const overallPct = kpis.totalPositions > 0
    ? Math.round((kpis.totalAtPar / kpis.totalPositions) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export PDF
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Overall Health</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-bold ${overallPct === 100 ? 'text-emerald-600' : overallPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
              {overallPct}%
            </span>
            <span className="text-xs text-gray-500">at par</span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${overallPct === 100 ? 'bg-emerald-500' : overallPct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Positions Tracked</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{kpis.totalPositions}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{kpis.totalAtPar} at par · {kpis.totalPositions - kpis.totalAtPar} below</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Units Needed</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-bold ${kpis.totalGap === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {kpis.totalGap}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{gapRows.length} line items short</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Critical</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-bold ${kpis.criticalGroups === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {kpis.criticalGroups}
            </span>
            <span className="text-xs text-gray-500">component{kpis.criticalGroups !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">below 50% par</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
        <div className="flex items-center gap-5 flex-wrap">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
            <span className="text-xs text-gray-600">At Par</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200" />
            <span className="text-xs text-gray-600">Over Par</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200" />
            <span className="text-xs text-gray-600">Below Par (50%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
            <span className="text-xs text-gray-600">Critical (&lt;50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            <span className="text-xs text-gray-600">Zero Stock</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {groups.map((g) => {
              const pct = g.total > 0 ? Math.round((g.atPar / g.total) * 100) : 0
              return (
                <div key={g.category} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${cellDot(g.atPar, g.total)}`} />
                  <span className="text-xs text-gray-700 font-medium">{g.label}</span>
                  <span className={`text-xs font-medium ${pct === 100 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Component Matrices */}
      {groups.map((group) => (
        <ComponentMatrix key={group.category} group={group} />
      ))}

      {/* Over Par (collapsed by default) */}
      {overParRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowOverPar(!showOverPar)}
            className="w-full px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Over Par</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                {overParRows.length} items · {kpis.totalOverPar} units
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showOverPar ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showOverPar && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Component</th>
                  <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Variant</th>
                  <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Size</th>
                  <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">On Hand</th>
                  <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">Target</th>
                  <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">Over</th>
                </tr>
              </thead>
              <tbody>
                {overParRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-5 text-gray-900 text-sm">{row.categoryLabel}</td>
                    <td className="py-2 px-5 text-gray-600 text-sm">{row.variantLabel}</td>
                    <td className="py-2 px-5 text-gray-600 font-mono text-xs">{row.size}</td>
                    <td className="py-2 px-5 text-right text-gray-600">{row.current}</td>
                    <td className="py-2 px-5 text-right text-gray-600">{row.target}</td>
                    <td className="py-2 px-5 text-right font-medium text-blue-600">+{row.over}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Gap Analysis (collapsed by default) */}
      {gapRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowGaps(!showGaps)}
            className="w-full px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Gap Analysis</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                {gapRows.length} items
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showGaps ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showGaps && (
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
          )}
        </div>
      )}

      {/* Items Without Par Level */}
      {noParItems.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <button
            onClick={() => setShowNoPar(!showNoPar)}
            className="w-full px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between hover:bg-amber-100/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-sm font-semibold text-amber-900">Items Without Par Level</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-200 text-amber-800">
                {noParItems.reduce((s, n) => s + n.count, 0)} units · {noParItems.length} types
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-amber-500 transition-transform ${showNoPar ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showNoPar && (
            <>
              <div className="px-5 py-2 bg-amber-50/50 border-b border-amber-100">
                <p className="text-xs text-amber-700">These items are in inventory but have no par level configured. They may not belong at this facility.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Component</th>
                    <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Variant</th>
                    <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Size</th>
                    <th className="text-right py-2 px-5 text-gray-500 font-medium text-xs">Qty</th>
                    <th className="text-left py-2 px-5 text-gray-500 font-medium text-xs">Sample Ref #</th>
                  </tr>
                </thead>
                <tbody>
                  {noParItems.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-amber-50/30">
                      <td className="py-2 px-5 text-gray-900 text-sm">{item.categoryLabel}</td>
                      <td className="py-2 px-5 text-gray-600 text-sm">{item.variantLabel}</td>
                      <td className="py-2 px-5 text-gray-600 font-mono text-xs">{item.size}</td>
                      <td className="py-2 px-5 text-right text-gray-600">{item.count}</td>
                      <td className="py-2 px-5 text-gray-500 font-mono text-xs">{item.sampleRefs.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
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
