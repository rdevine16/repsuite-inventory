'use client'

import { Fragment, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getVariantLabel, COMPONENT_LABELS } from '@/lib/plan-config'
import { assignPlanToCase } from './actions'
import type { CoverageResult, VariantCoverage } from '@/lib/daily-coverage'

// ------- Types -------

interface CaseData {
  id: string
  case_id: string | null
  surgeon_name: string | null
  procedure_name: string | null
  surgery_date: string | null
  hospital_name: string | null
  side: string | null
  status: string | null
  plan_id: string | null
  facility_id: string | null
  sf_id: string | null
  sales_rep: string | null
  covering_reps: string | null
  display_surgeon: string
  facility_name: string
}

interface Plan {
  id: string
  surgeon_name: string
  plan_name: string
  procedure_type: string
  is_default: boolean
}

interface SubPlan {
  id: string
  template_id: string
  name: string
  frequency: string
  sort_order: number
}

interface SubPlanItem {
  id: string
  sub_plan_id: string
  component: string
  variant: string
  side: string | null
}

interface Facility { id: string; name: string }

interface Props {
  facilities: Facility[]
  cases: CaseData[]
  plans: Plan[]
  subPlans: SubPlan[]
  subPlanItems: SubPlanItem[]
  surgeonNameMap: Record<string, string>
  serverToday: string
}

// ------- Helpers -------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'Shipped/Ready for Surgery': { label: 'Ready', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Assigned': { label: 'Assigned', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Requested': { label: 'Requested', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'New': { label: 'New', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'Completed': { label: 'Completed', color: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const FREQ_LABELS: Record<string, { label: string; color: string }> = {
  every_case: { label: 'Every Case', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high: { label: 'High', color: 'bg-purple-100 text-purple-700' },
}

const KNEE_COMPONENTS = new Set(['femur', 'tibia', 'patella', 'poly'])
const HIP_COMPONENTS = new Set(['stem', 'cup', 'liner', 'head'])

function detectProcedureType(name: string): string {
  const l = name.toLowerCase()
  return l.includes('hip') || l.includes('tha') ? 'hip' : 'knee'
}

function toEasternDate(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function formatDayLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  })
}

// ------- Main Component -------

export default function CasePlanningDashboard({ facilities, cases, plans, subPlans, subPlanItems, surgeonNameMap, serverToday }: Props) {
  const router = useRouter()
  const [selectedFacility, setSelectedFacility] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'3' | '7' | '14'>('7')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [coverageResults, setCoverageResults] = useState<Record<string, CoverageResult>>({})
  const [loadingCoverage, setLoadingCoverage] = useState<Record<string, boolean>>({})
  const [assigningPlan, setAssigningPlan] = useState<string | null>(null)
  const [planOverrides, setPlanOverrides] = useState<Record<string, string | null>>({})

  // Sub-plan lookup
  const subPlansByTemplate = useMemo(() => {
    const map: Record<string, (SubPlan & { items: SubPlanItem[] })[]> = {}
    for (const sp of subPlans) {
      if (!map[sp.template_id]) map[sp.template_id] = []
      map[sp.template_id].push({ ...sp, items: subPlanItems.filter((i) => i.sub_plan_id === sp.id) })
    }
    return map
  }, [subPlans, subPlanItems])

  // Apply plan overrides
  const casesWithOverrides = useMemo(() =>
    cases.map((c) => c.id in planOverrides ? { ...c, plan_id: planOverrides[c.id] } : c),
  [cases, planOverrides])

  // Filter
  const filteredCases = useMemo(() => {
    const base = new Date(serverToday + 'T12:00:00')
    const max = new Date(base); max.setDate(max.getDate() + parseInt(dateRange))
    const maxStr = toEasternDate(max)
    return casesWithOverrides.filter((c) => {
      if (!c.surgery_date) return false
      const d = toEasternDate(new Date(c.surgery_date))
      if (d < serverToday || d > maxStr) return false
      if (selectedFacility !== 'all' && c.facility_id !== selectedFacility) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (![c.display_surgeon, c.procedure_name, c.facility_name, c.case_id]
          .some((v) => v?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [casesWithOverrides, selectedFacility, dateRange, searchQuery])

  // Group by date → facility
  const groupedByDateFacility = useMemo(() => {
    const byDate: Record<string, Record<string, CaseData[]>> = {}
    for (const c of filteredCases) {
      const dateKey = toEasternDate(new Date(c.surgery_date!))
      const facKey = c.facility_id ?? 'unknown'
      if (!byDate[dateKey]) byDate[dateKey] = {}
      if (!byDate[dateKey][facKey]) byDate[dateKey][facKey] = []
      byDate[dateKey][facKey].push(c)
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, facs]) => ({
        date,
        facilities: Object.entries(facs).sort(([, a], [, b]) => b.length - a.length)
          .map(([facId, facCases]) => ({
            facilityId: facId,
            facilityName: facCases[0]?.facility_name ?? 'Unknown',
            cases: facCases,
          })),
      }))
  }, [filteredCases])

  // Summary
  const stats = useMemo(() => {
    const total = filteredCases.length
    const withPlan = filteredCases.filter((c) => c.plan_id).length
    return { total, withPlan, noPlan: total - withPlan }
  }, [filteredCases])

  const todayStr = serverToday
  const tomorrowStr = useMemo(() => {
    const tom = new Date(serverToday + 'T12:00:00')
    tom.setDate(tom.getDate() + 1)
    return toEasternDate(tom)
  }, [serverToday])

  // Plan assignment
  const assignPlan = async (caseId: string, planId: string | null) => {
    setPlanOverrides((prev) => ({ ...prev, [caseId]: planId }))
    setAssigningPlan(caseId)
    const { error } = await assignPlanToCase(caseId, planId)
    if (error) {
      setPlanOverrides((prev) => { const n = { ...prev }; delete n[caseId]; return n })
      alert('Failed to assign plan: ' + error)
    }
    setAssigningPlan(null)
    router.refresh()
  }

  // Coverage loading
  const loadCoverage = async (facilityId: string, date: string) => {
    const key = `${facilityId}|${date}`
    if (coverageResults[key] || loadingCoverage[key]) return
    setLoadingCoverage((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await fetch(`/api/coverage-audit?facilityId=${facilityId}&date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setCoverageResults((prev) => ({ ...prev, [key]: data }))
      }
    } finally {
      setLoadingCoverage((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Toggle expand + load coverage
  const toggleExpand = (c: CaseData) => {
    if (expandedCase === c.id) { setExpandedCase(null); return }
    setExpandedCase(c.id)
    if (c.facility_id && c.surgery_date) {
      loadCoverage(c.facility_id, toEasternDate(new Date(c.surgery_date)))
    }
  }

  // Get coverage for a facility+date
  const getCoverage = (facilityId: string, date: string) => coverageResults[`${facilityId}|${date}`]
  const isCoverageLoading = (facilityId: string, date: string) => loadingCoverage[`${facilityId}|${date}`] ?? false

  // Load coverage for a facility/day group
  const loadFacilityCoverage = (facilityId: string, date: string) => {
    loadCoverage(facilityId, date)
  }

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-2xl text-gray-900">{stats.total}</span>
          <span className="text-gray-500">cases</span>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-emerald-600">{stats.withPlan}</span>
          <span className="text-gray-500">with plans</span>
        </div>
        {stats.noPlan > 0 && (
          <>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-amber-600">{stats.noPlan}</span>
              <span className="text-gray-500">need plans</span>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Surgeon, procedure, facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Facility</label>
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Facilities</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Range</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {(['3', '7', '14'] as const).map((d) => (
                <button key={d} onClick={() => setDateRange(d)}
                  className={`px-3 py-2 text-sm font-medium transition ${dateRange === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} ${d !== '3' ? 'border-l border-gray-300' : ''}`}
                >{d}d</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {groupedByDateFacility.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No upcoming cases</p>
          <p className="text-sm text-gray-400 mt-1">Adjust filters or check that cases are syncing</p>
        </div>
      )}

      {/* Day groups */}
      {groupedByDateFacility.map(({ date, facilities: dayFacilities }) => {
        const isToday = date === todayStr
        const isTomorrow = date === tomorrowStr
        const dayLabel = formatDayLabel(date, todayStr, tomorrowStr)
        const totalDayCases = dayFacilities.reduce((s, f) => s + f.cases.length, 0)

        return (
          <div key={date} className="space-y-3">
            {/* Day label */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                isToday ? 'bg-blue-600 text-white' : isTomorrow ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {new Date(date + 'T12:00:00').getDate()}
              </div>
              <div>
                <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  {dayLabel}
                </span>
                <span className="text-xs text-gray-400 ml-2">{formatFullDate(date)}</span>
              </div>
              <span className="text-xs text-gray-400 ml-auto">{totalDayCases} case{totalDayCases !== 1 ? 's' : ''}</span>
            </div>

            {/* Facility groups within the day */}
            {dayFacilities.map(({ facilityId, facilityName, cases: facCases }) => {
              const coverage = getCoverage(facilityId, date)
              const loading = isCoverageLoading(facilityId, date)
              const kneeCases = facCases.filter((c) => detectProcedureType(c.procedure_name ?? '') === 'knee')
              const hipCases = facCases.filter((c) => detectProcedureType(c.procedure_name ?? '') === 'hip')
              const noPlanCount = facCases.filter((c) => !c.plan_id).length

              return (
                <div key={facilityId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Facility header */}
                  <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{facilityName}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {facCases.length} case{facCases.length !== 1 ? 's' : ''}
                          </span>
                          {kneeCases.length > 0 && (
                            <span className="text-xs text-blue-600">{kneeCases.length} knee</span>
                          )}
                          {hipCases.length > 0 && (
                            <span className="text-xs text-indigo-600">{hipCases.length} hip</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {noPlanCount > 0 && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            {noPlanCount} need{noPlanCount === 1 ? 's' : ''} plan
                          </span>
                        )}
                        {!coverage && !loading && (
                          <button
                            onClick={() => loadFacilityCoverage(facilityId, date)}
                            className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                          >
                            Load Coverage
                          </button>
                        )}
                        {loading && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Facility-level coverage summary */}
                  {coverage && (
                    <FacilityCoverageSummary coverage={coverage} kneeCaseCount={kneeCases.length} hipCaseCount={hipCases.length} />
                  )}

                  {/* Case rows */}
                  <div className="divide-y divide-gray-100">
                    {facCases.map((c) => (
                      <CaseRow
                        key={c.id}
                        caseData={c}
                        plans={plans}
                        subPlansByTemplate={subPlansByTemplate}
                        expanded={expandedCase === c.id}
                        onToggle={() => toggleExpand(c)}
                        onAssignPlan={assignPlan}
                        assigning={assigningPlan === c.id}
                        coverageResult={coverage}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ------- Facility Coverage Summary -------

function FacilityCoverageSummary({ coverage, kneeCaseCount, hipCaseCount }: {
  coverage: CoverageResult; kneeCaseCount: number; hipCaseCount: number
}) {
  const ratio = coverage.coverage_ratio
  const ratioLabel = `${Math.round(ratio * 100)}%`

  // Group coverage by procedure type
  const kneeCoverage = coverage.coverage.filter((c) => KNEE_COMPONENTS.has(c.component))
  const hipCoverage = coverage.coverage.filter((c) => HIP_COMPONENTS.has(c.component))

  const belowTarget = coverage.coverage.filter((c) => c.status === 'below_target')

  return (
    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
      {/* Ratio indicator */}
      <div className="flex items-center gap-4 mb-3">
        <div className="text-xs text-gray-500">
          Coverage target: <span className="font-semibold text-gray-700">{ratioLabel}</span>
        </div>
        {belowTarget.length > 0 && (
          <div className="text-xs text-amber-600 font-medium">
            {belowTarget.length} below target
          </div>
        )}
      </div>

      {/* Coverage lines by procedure type */}
      <div className="space-y-2">
        {kneeCaseCount > 0 && kneeCoverage.length > 0 && (
          <CoverageGroup label="Knee" caseCount={kneeCaseCount} items={kneeCoverage} ratio={ratio} />
        )}
        {hipCaseCount > 0 && hipCoverage.length > 0 && (
          <CoverageGroup label="Hip" caseCount={hipCaseCount} items={hipCoverage} ratio={ratio} />
        )}
      </div>

      {/* Order more section */}
      {coverage.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Below target — order more?</div>
          <div className="flex flex-wrap gap-1.5">
            {coverage.recommendations.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                <span className="font-medium">{r.tubs_needed}</span> {r.tub_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CoverageGroup({ label, caseCount, items, ratio }: {
  label: string; caseCount: number; items: VariantCoverage[]; ratio: number
}) {
  const targetCases = Math.ceil(caseCount * ratio)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-[10px] text-gray-400">{caseCount} cases, targeting {targetCases} sets</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {items.map((cov, i) => (
          <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border ${
            cov.status === 'covered' ? 'bg-white border-gray-200' :
            cov.status === 'on_target' ? 'bg-white border-gray-200' :
            'bg-amber-50/50 border-amber-200'
          }`}>
            <span className="text-gray-700 truncate mr-2">{cov.display_name}</span>
            <div className="flex items-center gap-1 shrink-0">
              {cov.sets_requested > 0 ? (
                <span className="tabular-nums">
                  <span className="font-semibold text-gray-800">{cov.sets_requested}</span>
                  <span className="text-gray-400 mx-0.5">/</span>
                  <span className={cov.sets_shipped >= cov.sets_requested ? 'text-emerald-600 font-medium' : cov.sets_shipped > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                    {cov.sets_shipped}
                  </span>
                </span>
              ) : cov.sets_on_hand > 0 ? (
                <span className="font-semibold text-gray-600 tabular-nums">{cov.sets_on_hand}</span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------- Case Row -------

function CaseRow({ caseData: c, plans, subPlansByTemplate, expanded, onToggle, onAssignPlan, assigning, coverageResult }: {
  caseData: CaseData
  plans: Plan[]
  subPlansByTemplate: Record<string, (SubPlan & { items: SubPlanItem[] })[]>
  expanded: boolean
  onToggle: () => void
  onAssignPlan: (caseId: string, planId: string | null) => void
  assigning: boolean
  coverageResult?: CoverageResult
}) {
  const isCompleted = c.status === 'Completed'
  const statusConfig = STATUS_CONFIG[c.status ?? ''] ?? { label: c.status ?? '—', color: 'bg-gray-100 text-gray-600 border-gray-200' }
  const procType = detectProcedureType(c.procedure_name ?? '')
  const surgeonName = c.surgeon_name ?? ''
  const availablePlans = plans.filter((p) => p.surgeon_name === surgeonName && p.procedure_type === procType)
  const currentPlan = plans.find((p) => p.id === c.plan_id)
  const planSubPlans = c.plan_id ? subPlansByTemplate[c.plan_id] : undefined

  // Filter coverage to this procedure type
  const relevantComponents = procType === 'hip' ? HIP_COMPONENTS : KNEE_COMPONENTS
  const caseCoverage = (coverageResult?.coverage ?? []).filter((cv) => relevantComponents.has(cv.component))
  const available = caseCoverage.length > 0
    ? Math.min(...caseCoverage.map((cv) => cv.sets_on_hand + cv.sets_requested))
    : null

  return (
    <>
      <div className={`transition cursor-pointer ${isCompleted ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50/50'} ${expanded ? 'bg-gray-50/30' : ''}`} onClick={onToggle}>
        <div className="px-5 py-3">
          <div className="flex items-center gap-4">
            <svg className={`w-4 h-4 text-gray-400 shrink-0 transition ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{c.display_surgeon}</span>
                {c.case_id && <span className="text-[10px] font-mono text-gray-400">{c.case_id}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isCompleted ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'}`}>
                  {c.procedure_name ?? '—'}
                </span>
              </div>
            </div>

            {/* Plan dropdown */}
            <div className="w-52 shrink-0" onClick={(e) => e.stopPropagation()}>
              {isCompleted ? (
                <span className="text-xs text-gray-400">{currentPlan?.plan_name ?? 'No plan'}</span>
              ) : availablePlans.length > 0 ? (
                <select
                  value={c.plan_id ?? ''}
                  onChange={(e) => onAssignPlan(c.id, e.target.value || null)}
                  disabled={assigning}
                  className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium outline-none transition ${
                    c.plan_id ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-600'
                  } ${assigning ? 'opacity-50' : ''}`}
                >
                  <option value="">No plan assigned</option>
                  {availablePlans.map((p) => (
                    <option key={p.id} value={p.id}>{p.plan_name}{p.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-gray-400">No plans configured</span>
              )}
            </div>

            {/* Sets available indicator */}
            {available !== null && (
              <span className="text-xs text-gray-500 tabular-nums shrink-0">
                <span className="font-semibold text-gray-700">{available}</span> sets
              </span>
            )}

            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border shrink-0 ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded: plan details */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
          {/* Case meta */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetaField label="Surgeon" value={c.display_surgeon} />
            <MetaField label="Procedure" value={c.procedure_name ?? '—'} />
            <MetaField label="Facility" value={c.facility_name} />
            <MetaField label="Sales Rep" value={c.sales_rep ?? '—'} />
            <MetaField label="Covering" value={c.covering_reps ?? '—'} />
          </div>

          {/* Plan detail */}
          {currentPlan && planSubPlans && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-900">{currentPlan.plan_name}</span>
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {procType === 'hip' ? 'Hip' : 'Knee'} Plan
                </span>
              </div>
              <div className="p-4 space-y-3">
                {planSubPlans.map((sp) => {
                  const freqConfig = FREQ_LABELS[sp.frequency] ?? { label: sp.frequency, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={sp.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-gray-700">{sp.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${freqConfig.color}`}>{freqConfig.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sp.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs text-gray-700">
                            <span className="font-medium">{COMPONENT_LABELS[item.component] ?? item.component}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span>{getVariantLabel(item.variant)}</span>
                            {item.side && (<><span className="text-gray-400 mx-1">·</span><span className="text-gray-500">{item.side === 'left' ? 'L' : 'R'}</span></>)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Implant availability for this case */}
          {caseCoverage.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Implant Availability</span>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 text-xs font-medium text-gray-500 uppercase">Component</th>
                      <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500 uppercase">On Hand</th>
                      <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500 uppercase">Requested / Shipped</th>
                      <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500 uppercase">For Cases</th>
                      <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500 uppercase">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {caseCoverage.map((cov, i) => (
                      <tr key={i}>
                        <td className="py-2 text-sm text-gray-900">{cov.display_name}</td>
                        <td className="text-center py-2 px-2 tabular-nums text-sm">
                          {cov.sets_on_hand > 0 ? <span className="font-medium">{cov.sets_on_hand}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-center py-2 px-2 tabular-nums text-sm">
                          {cov.sets_requested > 0 ? (
                            <span>
                              <span className="font-medium">{cov.sets_requested}</span>
                              <span className="text-gray-400 mx-0.5">/</span>
                              <span className={cov.sets_shipped >= cov.sets_requested ? 'text-emerald-600 font-medium' : cov.sets_shipped > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                                {cov.sets_shipped}
                              </span>
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-center py-2 px-2 tabular-nums text-sm font-medium text-gray-600">{cov.sets_needed}</td>
                        <td className="text-center py-2 px-2 tabular-nums text-sm font-medium text-gray-600">{cov.target_sets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No plan */}
          {!c.plan_id && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">No surgeon preference assigned</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {availablePlans.length > 0 ? 'Select a plan above to see coverage.' : 'Create a plan in the Preferences page.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  )
}
