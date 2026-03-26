'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/**
 * Subscribes to Supabase Realtime on key tables.
 * When any watched table changes, refreshes the server component data.
 * When facility_inventory changes, also triggers an alert recheck.
 */
export default function RealtimeRefresh() {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Debounced refresh — collapses rapid changes into one refresh
    const scheduleRefresh = (recheckAlerts = false) => {
      if (recheckAlerts) {
        fetch('/api/check-inventory', { method: 'POST' }).catch(() => {})
      }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        router.refresh()
      }, recheckAlerts ? 1500 : 500)
    }

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facility_inventory' },
        () => scheduleRefresh(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_alerts' },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases' },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'replenishment_requests' },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'case_kit_issues' },
        () => scheduleRefresh()
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
