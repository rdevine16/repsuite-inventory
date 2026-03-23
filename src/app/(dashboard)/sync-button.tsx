'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncButton({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync-cases', { method: 'POST' })
      router.refresh()
    } catch {
      // silent
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastSyncedAt && (
        <span className="text-xs text-gray-400">
          Synced {new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
      >
        <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {syncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  )
}
