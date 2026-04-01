interface KpiCardProps {
  label: string
  value: number | string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  color?: 'default' | 'red' | 'amber' | 'emerald'
}

const colorMap = {
  default: 'bg-white',
  red: 'bg-red-50 border-red-200',
  amber: 'bg-amber-50 border-amber-200',
  emerald: 'bg-emerald-50 border-emerald-200',
}

const trendArrows = {
  up: '↑',
  down: '↓',
  neutral: '→',
}

const trendColors = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-gray-500',
}

export default function KpiCard({ label, value, subtitle, trend, trendLabel, color = 'default' }: KpiCardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trendArrows[trend]} {trendLabel}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  )
}
