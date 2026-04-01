'use client'

import type { ActivityEvent } from './activity-tab'

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function CsvExport({
  events,
  facilityName,
}: {
  events: ActivityEvent[]
  facilityName: string
}) {
  const handleExport = () => {
    const headers = ['Date', 'Event Type', 'Description', 'Ref#', 'Lot#', 'Expiration', 'Case ID', 'Surgeon', 'Procedure', 'Surgery Date', 'Auto Deducted', 'Source Conflict']
    const rows = events.map((e) => [
      new Date(e.event_at).toISOString(),
      e.event_type,
      escapeCsv(e.description),
      escapeCsv(e.reference_number),
      escapeCsv(e.lot_number),
      escapeCsv(e.expiration_date),
      escapeCsv(e.case_display_id),
      escapeCsv(e.surgeon_name),
      escapeCsv(e.procedure_name),
      e.surgery_date ? new Date(e.surgery_date).toISOString().split('T')[0] : '',
      e.auto_deducted ? 'Yes' : '',
      e.source_conflict ? 'Yes' : '',
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().split('T')[0]
    link.download = `inventory-audit-${facilityName.replace(/\s+/g, '-').toLowerCase()}-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={events.length === 0}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export CSV ({events.length} events)
    </button>
  )
}
