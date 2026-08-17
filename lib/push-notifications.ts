// Client-side push notification subscription helper

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  try {
    const registration = await navigator.serviceWorker.ready

    // Check existing subscription
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    // Get VAPID public key from server
    const res = await fetch('/api/push/vapid-key')
    if (!res.ok) return null
    const { publicKey } = await res.json()
    if (!publicKey) return null

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })

    return subscription
  } catch {
    return null
  }
}

// Enable push from a real user gesture (e.g. the "Go Online" tap) — the natural
// high-intent moment to make sure a driver's alerts are on. Only prompts when
// they haven't decided yet ('default'); re-subscribes silently if already
// granted; never nags a denied or unsupported/iOS-uninstalled user (the banner
// covers those). MUST be called synchronously inside the gesture handler
// (before any await) so the permission prompt is allowed. Fire-and-forget.
export async function enablePushOnGesture(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
  try {
    if (Notification.permission === 'granted') { await subscribeToPush(); return }
    if (Notification.permission !== 'default') return // denied — don't nag
    const perm = await Notification.requestPermission()
    if (perm === 'granted') await subscribeToPush()
  } catch { /* ignore */ }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
    }
  } catch {
    // Ignore errors during unsubscribe
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
