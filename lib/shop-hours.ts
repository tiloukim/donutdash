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

export interface DayHours {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

const SHOP_TZ = 'America/Chicago'
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Break a Date into the shop's local day-of-week + "HH:MM". The server runs in
// UTC, so we render the instant in the shop timezone and read the components
// back (same trick isShopOpen uses).
function shopLocalParts(d: Date): { day: number; hhmm: string; dateObj: Date } {
  const local = new Date(d.toLocaleString('en-US', { timeZone: SHOP_TZ }))
  const pad = (n: number) => n.toString().padStart(2, '0')
  return { day: local.getDay(), hhmm: `${pad(local.getHours())}:${pad(local.getMinutes())}`, dateObj: local }
}

function ymd(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Round "HH:MM" up to the next :00/:30 slot.
function nextSlot(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = Math.ceil((h * 60 + m) / 30) * 30
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

export interface ShopHoursInfo {
  open: boolean
  message: string
  opensAt?: string
  schedule: DayHours[]
  // Next moment the shop opens, in shop-local terms the checkout picker uses.
  nextOpen: { date: string; time: string; label: string } | null
}

// Richer version of isShopOpen for the checkout scheduler: the current
// open/closed status PLUS the weekly schedule and the next opening slot, so a
// customer arriving while the shop is closed can schedule for when it reopens.
export async function getShopHoursInfo(shopId: string): Promise<ShopHoursInfo> {
  const status = await isShopOpen(shopId)
  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('dd_business_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('shop_id', shopId)
    .order('day_of_week')
  const schedule = (rows || []) as DayHours[]

  let nextOpen: ShopHoursInfo['nextOpen'] = null
  if (schedule.length) {
    const { day, hhmm, dateObj } = shopLocalParts(new Date())
    for (let i = 0; i <= 7; i++) {
      const dow = (day + i) % 7
      const dh = schedule.find(h => h.day_of_week === dow)
      if (!dh || dh.is_closed) continue
      if (i === 0 && hhmm >= dh.close_time) continue // today's window already passed
      // Today and already open → next bookable slot is the upcoming half-hour.
      const openTime = i === 0 && hhmm >= dh.open_time ? nextSlot(hhmm) : dh.open_time
      if (openTime >= dh.close_time) continue // no slots left in this window
      const d = new Date(dateObj)
      d.setDate(d.getDate() + i)
      const label = i === 0 ? `today at ${formatTime(openTime)}`
        : i === 1 ? `tomorrow at ${formatTime(dh.open_time)}`
        : `${DAY_NAMES[dow]} at ${formatTime(dh.open_time)}`
      nextOpen = { date: ymd(d), time: openTime, label }
      break
    }
  }
  return { ...status, schedule, nextOpen }
}

// Server-side guard: is a specific instant within the shop's open hours?
// Used to validate scheduled orders so one can't be booked into a closed slot.
export async function isShopOpenAt(shopId: string, whenISO: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('dd_business_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('shop_id', shopId)
  if (!rows || rows.length === 0) return true // no hours set = always open
  const { day, hhmm } = shopLocalParts(new Date(whenISO))
  const dh = rows.find(h => h.day_of_week === day) as DayHours | undefined
  if (!dh || dh.is_closed) return false
  return hhmm >= dh.open_time && hhmm < dh.close_time
}
