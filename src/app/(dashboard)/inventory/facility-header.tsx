interface FacilityHeaderProps {
  name: string
  address: string | null
  smartTracking: boolean
  lastAuditDate: string | null
}

export default function FacilityHeader({ name, address, smartTracking, lastAuditDate }: FacilityHeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
          {address && (
            <p className="text-sm text-gray-500 mt-0.5">{address}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            smartTracking
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${smartTracking ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {smartTracking ? 'Smart Tracking' : 'Manual Tracking'}
          </span>
          {lastAuditDate && (
            <span className="text-xs text-gray-500">
              Last audit: {new Date(lastAuditDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
