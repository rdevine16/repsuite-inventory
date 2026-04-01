export default function ParLevelBar({
  current,
  target,
}: {
  current: number
  target: number
}) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor = pct >= 100 ? 'text-emerald-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700'

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${textColor}`}>
        {current}/{target}
      </span>
    </div>
  )
}
