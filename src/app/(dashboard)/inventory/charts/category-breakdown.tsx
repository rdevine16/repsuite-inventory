'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export interface CategoryUsage {
  category: string
  count: number
}

export default function CategoryBreakdownChart({ data }: { data: CategoryUsage[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No category data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: '#6b7280' }}
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
        <Bar
          dataKey="count"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
          name="Items Used"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
