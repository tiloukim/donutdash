'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeOptions {
  table: string
  filter?: string  // e.g. "customer_id=eq.abc-123"
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  onData: (payload: { eventType: string; new: any; old: any }) => void
  enabled?: boolean
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Replaces polling with instant updates.
 *
 * Usage:
 *   useRealtime({
 *     table: 'dd_orders',
 *     filter: `customer_id=eq.${userId}`,
 *     event: '*',
 *     onData: (payload) => { refetchOrders() },
 *   })
 */
export function useRealtime({ table, filter, event = '*', onData, enabled = true }: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`

    const channelConfig: any = {
      event,
      schema: 'public',
      table,
    }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload: any) => {
        onData({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, event, enabled])
}
