import { createServiceClient } from '@/lib/supabase/server'

export async function isShopOpen(shopId: string): Promise<{ open: boolean; message: string; opensAt?: string }> {
  const svc = createServiceClient()

  const { data: hours } = await svc
    .from('dd_business_hours')
    .select('*')
    .eq('shop_id', shopId)
    .order('day_of_week')

  // If no hours set, assume always open
  if (!hours || hours.length === 0) {
    return { open: true, message: 'Open' }
  }

  // Get shop timezone (default to Central Time for US shops)
  // Server runs in UTC, so we need to convert to local time
  const now = new Date()
  const shopTimezone = 'America/Chicago' // TODO: make this configurable per shop
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: shopTimezone }))
  const dayOfWeek = localTime.getDay() // 0=Sunday, 6=Saturday
  const currentTime = `${localTime.getHours().toString().padStart(2, '0')}:${localTime.getMinutes().toString().padStart(2, '0')}`

  const todayHours = hours.find(h => h.day_of_week === dayOfWeek)

  if (!todayHours || todayHours.is_closed) {
    // Find next open day
    for (let i = 1; i <= 7; i++) {
      const nextDay = (dayOfWeek + i) % 7
      const nextHours = hours.find(h => h.day_of_week === nextDay)
      if (nextHours && !nextHours.is_closed) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return {
          open: false,
          message: `Closed today. Opens ${days[nextDay]} at ${formatTime(nextHours.open_time)}`,
          opensAt: nextHours.open_time,
        }
      }
    }
    return { open: false, message: 'Currently closed' }
  }

  if (currentTime < todayHours.open_time) {
    return {
      open: false,
      message: `Opens at ${formatTime(todayHours.open_time)}`,
      opensAt: todayHours.open_time,
    }
  }

  if (currentTime >= todayHours.close_time) {
    // Find next open day/time
    for (let i = 1; i <= 7; i++) {
      const nextDay = (dayOfWeek + i) % 7
      const nextHours = hours.find(h => h.day_of_week === nextDay)
      if (nextHours && !nextHours.is_closed) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const label = i === 1 ? 'tomorrow' : days[nextDay]
        return {
          open: false,
          message: `Closed for today. Opens ${label} at ${formatTime(nextHours.open_time)}`,
          opensAt: nextHours.open_time,
        }
      }
    }
    return { open: false, message: 'Closed for today' }
  }

  return {
    open: true,
    message: `Open until ${formatTime(todayHours.close_time)}`,
  }
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}
