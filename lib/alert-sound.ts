// Reliable audio alert system for DonutDash
// Uses a single HTMLAudioElement with robust unlock and retry logic

let alertAudio: HTMLAudioElement | null = null
let isUnlocked = false
let isPlaying = false
let retryTimer: ReturnType<typeof setInterval> | null = null

function getAudio(src: string): HTMLAudioElement {
  if (!alertAudio || alertAudio.src !== new URL(src, window.location.origin).href) {
    alertAudio = new Audio(src)
    alertAudio.loop = true
    alertAudio.preload = 'auto'
  }
  return alertAudio
}

// Must be called from a user gesture (click/tap) to unlock audio on mobile
export function unlockAudio(src = '/order-alert.wav') {
  if (isUnlocked) return
  try {
    const audio = getAudio(src)
    audio.volume = 0.01
    const p = audio.play()
    if (p) {
      p.then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.volume = 1.0
        isUnlocked = true
      }).catch(() => {})
    }
  } catch {}
}

// Auto-unlock: listen for first user interaction
if (typeof document !== 'undefined') {
  const autoUnlock = () => {
    unlockAudio()
    document.removeEventListener('click', autoUnlock)
    document.removeEventListener('touchstart', autoUnlock)
    document.removeEventListener('keydown', autoUnlock)
  }
  document.addEventListener('click', autoUnlock)
  document.addEventListener('touchstart', autoUnlock)
  document.addEventListener('keydown', autoUnlock)
}

export function playUrgentAlert(src = '/order-alert.wav') {
  if (isPlaying) return
  isPlaying = true

  const audio = getAudio(src)
  audio.volume = 1.0
  audio.currentTime = 0
  audio.loop = true

  const tryPlay = () => {
    audio.play().catch(() => {
      // If play fails, keep retrying every 500ms
      // (will succeed once user interacts with page)
    })
  }

  tryPlay()

  // Retry every 2 seconds in case first play was blocked
  retryTimer = setInterval(() => {
    if (!isPlaying) {
      if (retryTimer) clearInterval(retryTimer)
      return
    }
    if (audio.paused) tryPlay()
  }, 2000)

  // Vibrate on mobile
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([400, 200, 400, 200, 400])
  }
}

// Alias for backward compatibility
export function playUrgentAlertWithBackup(src: string) {
  playUrgentAlert(src)
}

export function stopUrgentAlert() {
  isPlaying = false

  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
  }

  if (alertAudio) {
    alertAudio.pause()
    alertAudio.currentTime = 0
  }

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0)
  }
}

export function isAlertPlaying() {
  return isPlaying
}
