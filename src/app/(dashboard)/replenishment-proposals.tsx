'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Proposal {
  id: string
  facility_name: string
  surgeon_name: string
  case_id: string
  surgery_date: string
  kit_template_name: string
  component: string
  variant: string
  missing_sizes: string[]
  reason: string
}

export default function ReplenishmentProposals({
  proposals,
  surgeonNameMap,
}: {
  proposals: Proposal[]
  surgeonNameMap: Record<string, string>
}) {
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleAction = async (id: string, action: 'approved' | 'dismissed') => {
    setProcessing(id)
    await supabase
      .from('replenishment_requests')
      .update({
        status: action,
        approved_at: action === 'approved' ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setProcessing(null)
    router.refresh()
  }

  if (proposals.length === 0) return null

  return (
    <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h2 className="text-lg font-semibold text-blue-900">Kit Requests</h2>
        <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full ml-auto">
          {proposals.length} proposed
        </span>
      </div>
      <div className="space-y-2">
        {proposals.map((p) => {
          const surgeonDisplay = surgeonNameMap[p.surgeon_name] ?? p.surgeon_name?.replace(/^\d+ - /, '')
          return (
            <div key={p.id} className="bg-white rounded-lg border border-blue-100 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{p.kit_template_name}</span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {surgeonDisplay} at {p.facility_name} · {p.case_id}
                    {p.surgery_date && (
                      <span className="ml-1">
                        ({new Date(p.surgery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">{p.reason}</div>
                </div>
                <div className="flex gap-1.5 shrink-0 ml-3">
                  <button
                    onClick={() => handleAction(p.id, 'approved')}
                    disabled={processing === p.id}
                    className="px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'dismissed')}
                    disabled={processing === p.id}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-blue-500 mt-3">
        Approved requests will generate a formatted message to send to the office.
      </p>
    </div>
  )
}
