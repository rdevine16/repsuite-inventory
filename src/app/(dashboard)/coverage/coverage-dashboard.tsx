'use client'

import { useState } from 'react'
import type { CoverageResult, VariantCoverage } from '@/lib/daily-coverage'

interface Facility {
  id: string
  name: string
}

export default function CoverageDashboard({ facilities }: { facilities: Facility[] }) {
  const [selectedFacility, setSelectedFacility] = useState(facilities[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CoverageResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAudit = async () => {
    if (!selectedFacility || !selectedDate) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/coverage-audit?facilityId=${selectedFacility}&date=${selectedDate}`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run audit')
    } finally {
      setLoading(false)
    }
  }

  const belowCount = result?.coverage.filter((c) => c.status === 'below_target').length ?? 0
  const coveredCount = result?.coverage.filter((c) => c.status === 'covered' || c.status === 'on_target').length ?? 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Facility</label>
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              {facilities.length === 0 && <option value="">No facilities with smart tracking</option>}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Surgery Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={runAudit}
            disabled={loading || !selectedFacility}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? 'Running...' : 'Run Coverage Audit'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{result.facility_name}</h2>
                <p className="text-sm text-gray-500">
                  {new Date(result.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {' '}— {result.total_cases} case{result.total_cases !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-3">
                {belowCount > 0 && (
                  <div className="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{belowCount}</div>
                    <div className="text-[10px] text-red-500 font-medium uppercase">Below Target</div>
                  </div>
                )}
                <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-600">{coveredCount}</div>
                  <div className="text-[10px] text-emerald-500 font-medium uppercase">Covered</div>
                </div>
              </div>
            </div>

            {/* Cases by surgeon */}
            <div className="flex flex-wrap gap-2">
              {result.cases_by_surgeon.map((s) => (
                <div key={s.surgeon} className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm font-medium text-gray-900">{s.display_name}</div>
                  <div className="text-xs text-gray-500">
                    {s.count} case{s.count !== 1 ? 's' : ''}
                    {(s.left > 0 || s.right > 0) && (
                      <span className="ml-1">
                        ({s.left > 0 && `${s.left}L`}{s.left > 0 && s.right > 0 && ', '}{s.right > 0 && `${s.right}R`})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Warning for cases with no plan assigned */}
            {result.no_plans.length > 0 && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <span className="font-medium">Cases without a plan assigned ({result.no_plans.length}):</span>{' '}
                {result.no_plans.slice(0, 5).join('; ')}
                {result.no_plans.length > 5 && ` +${result.no_plans.length - 5} more`}
                . Assign plans on the Dashboard or set a default in Preferences.
              </div>
            )}
            {result.no_plan_surgeons.length > 0 && (
              <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <span className="font-medium">No plans configured at all:</span>{' '}
                {result.no_plan_surgeons.join(', ')}. Create plans in the Preferences page.
              </div>
            )}
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Recommendations</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-900">
                      Order <span className="font-semibold">{rec.tubs_needed}</span> {rec.tub_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed coverage table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Coverage Detail</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase">Component</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">On Hand</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Requested / Shipped</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Needed</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Gap</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase">Demand Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.coverage.map((cov, i) => (
                    <CoverageRow key={i} cov={cov} />
                  ))}
                  {result.coverage.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                        No coverage data. Check that surgeons have implant plans configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Case list */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Cases ({result.cases.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {result.cases.map((c) => (
                <div key={c.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{c.procedure_name}</span>
                    <span className="text-gray-400 ml-2">— {c.surgeon_name.replace(/^\d+ - /, '')}</span>
                  </div>
                  <div className="flex gap-2">
                    {c.plan_name ? (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-600">
                        {c.plan_name}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-600">
                        No plan
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      c.side === 'left' ? 'bg-blue-50 text-blue-600' :
                      c.side === 'right' ? 'bg-indigo-50 text-indigo-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {c.side === 'left' ? 'Left' : c.side === 'right' ? 'Right' : 'Unknown Side'}
                    </span>
                  </div>
                </div>
              ))}
              {result.cases.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  No cases scheduled for this date.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-sm">Select a facility and date, then run the coverage audit.</div>
        </div>
      )}
    </div>
  )
}

function CoverageRow({ cov }: { cov: VariantCoverage }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-2.5">
          <div className="flex items-center gap-2">
            <svg className={`w-3 h-3 text-gray-400 transition ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-gray-900">{cov.display_name}</span>
          </div>
        </td>
        <td className="text-center px-3 py-2.5 tabular-nums">
          <span className="font-medium">{cov.sets_on_hand}</span>
          <span className="text-gray-400 text-xs ml-0.5">sets</span>
        </td>
        <td className="text-center px-3 py-2.5 tabular-nums">
          {cov.sets_requested > 0 ? (
            <div className="flex items-center justify-center gap-1">
              <span className="font-medium text-gray-700">{cov.sets_requested}</span>
              <span className="text-gray-400 text-[10px]">/</span>
              <span className={`font-medium ${cov.sets_shipped >= cov.sets_requested ? 'text-emerald-600' : cov.sets_shipped > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {cov.sets_shipped}
              </span>
              <span className="text-gray-400 text-[10px]">shipped</span>
            </div>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="text-center px-3 py-2.5 tabular-nums">
          <span className="font-medium">{cov.sets_needed}</span>
          <span className="text-gray-400 text-xs ml-0.5">sets</span>
        </td>
        <td className="text-center px-3 py-2.5 tabular-nums">
          {cov.gap > 0 ? (
            <span className="font-bold text-red-600">-{cov.gap}</span>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </td>
        <td className="text-center px-3 py-2.5">
          {cov.status === 'covered' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Covered
            </span>
          ) : cov.status === 'on_target' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              On Target
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9 9-9 9-9-9 9-9z" />
              </svg>
              Below Target
            </span>
          )}
        </td>
        <td className="px-5 py-2.5 text-xs text-gray-500">
          {cov.demand_breakdown.slice(0, 2).map((d, i) => (
            <span key={i}>
              {i > 0 && ' + '}
              {d.sets} from {d.surgeon}
            </span>
          ))}
          {cov.demand_breakdown.length > 2 && <span> +{cov.demand_breakdown.length - 2} more</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-5 py-3 bg-gray-50/50">
            <div className="text-xs space-y-1">
              <div className="font-medium text-gray-600 mb-2">Demand Breakdown:</div>
              {cov.demand_breakdown.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    d.frequency === 'every_case' ? 'bg-blue-100 text-blue-600' :
                    d.frequency === 'low' ? 'bg-gray-100 text-gray-600' :
                    d.frequency === 'medium' ? 'bg-amber-100 text-amber-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {d.sub_plan_name}
                  </span>
                  <span className="text-gray-700">
                    {d.surgeon}
                    <span className="text-gray-400"> ({d.plan_name})</span>
                  </span>
                  <span className="text-gray-500">
                    {d.cases} case{d.cases !== 1 ? 's' : ''} = <span className="font-medium">{d.sets} set{d.sets !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
