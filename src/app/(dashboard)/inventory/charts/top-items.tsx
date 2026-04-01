export interface TopItem {
  reference_number: string
  description: string | null
  count: number
}

export default function TopItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        No usage data available
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">#</th>
          <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Reference</th>
          <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Description</th>
          <th className="text-right py-2 px-4 text-gray-500 font-medium text-xs">Used</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={item.reference_number} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="py-2 px-4 text-gray-400 text-xs">{i + 1}</td>
            <td className="py-2 px-4 text-gray-600 font-mono text-xs">{item.reference_number}</td>
            <td className="py-2 px-4 text-gray-900 text-sm truncate max-w-xs">{item.description || '—'}</td>
            <td className="py-2 px-4 text-right font-medium text-gray-900">{item.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
