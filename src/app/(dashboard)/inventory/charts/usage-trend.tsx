'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export interface WeeklyUsage {
  week: string // e.g. "Mar 3"
  count: number
}

export default function UsageTrendChart({ data }: { data: WeeklyUsage[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No usage data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '13px',
          }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2563eb' }}
          name="Items Used"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
