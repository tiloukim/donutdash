// Generates a loud, urgent alert tone using Web Audio API
// Plays a repeating pattern: 3 fast beeps, pause, repeat
// Much louder and more attention-grabbing than a short wav file

let audioCtx: AudioContext | null = null
let isPlaying = false
let vibrateInterval: ReturnType<typeof setInterval> | null = null
let oscillatorNode: OscillatorNode | null = null
let gainNode: GainNode | null = null

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

// Unlock audio context on user interaction (required for mobile)
export function unlockAudio() {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    // Play a silent buffer to unlock
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // Audio not available
  }
}

// Play a loud, repeating alert pattern
export function playUrgentAlert() {
  if (isPlaying) return
  isPlaying = true

  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    // Create oscillator for beeping
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = 880 // A5 - high pitched, urgent

    // Create a repeating beep pattern: beep-beep-beep-pause
    // Each cycle = 2 seconds (3 beeps of 200ms with 100ms gaps, then 900ms pause)
    const now = ctx.currentTime
    gain.gain.value = 0

    // Schedule 60 seconds of beeping (30 cycles) — will stop when accepted
    for (let cycle = 0; cycle < 30; cycle++) {
      const base = now + cycle * 2
      // Beep 1
      gain.gain.setValueAtTime(0.8, base)
      gain.gain.setValueAtTime(0, base + 0.2)
      // Beep 2
      gain.gain.setValueAtTime(0.8, base + 0.3)
      gain.gain.setValueAtTime(0, base + 0.5)
      // Beep 3 (higher pitch for urgency)
      gain.gain.setValueAtTime(1.0, base + 0.6)
      gain.gain.setValueAtTime(0, base + 0.85)
      // Pause until next cycle
    }

    osc.start(now)
    osc.stop(now + 60) // Max 60 seconds

    oscillatorNode = osc
    gainNode = gain

    // Also do the frequency sweep for extra urgency
    for (let cycle = 0; cycle < 30; cycle++) {
      const base = now + cycle * 2
      osc.frequency.setValueAtTime(880, base)
      osc.frequency.setValueAtTime(880, base + 0.5)
      osc.frequency.setValueAtTime(1100, base + 0.6) // Higher on 3rd beep
      osc.frequency.setValueAtTime(880, base + 0.85)
    }

    osc.onended = () => { isPlaying = false }
  } catch {
    isPlaying = false
  }

  // Continuous vibration pulsing
  startVibration()
}

// Also play the wav file on loop as backup (some devices handle it better)
let backupAudio: HTMLAudioElement | null = null

export function playUrgentAlertWithBackup(wavFile: string) {
  playUrgentAlert()

  // Also loop the wav file for devices where Web Audio API is limited
  try {
    if (!backupAudio) {
      backupAudio = new Audio(wavFile)
      backupAudio.loop = true
    }
    backupAudio.volume = 1.0
    backupAudio.currentTime = 0
    backupAudio.play().catch(() => {})
  } catch {
    // Audio not available
  }
}

export function stopUrgentAlert() {
  isPlaying = false

  try {
    if (oscillatorNode) {
      oscillatorNode.stop()
      oscillatorNode.disconnect()
      oscillatorNode = null
    }
    if (gainNode) {
      gainNode.disconnect()
      gainNode = null
    }
  } catch {
    // Already stopped
  }

  // Stop backup wav
  if (backupAudio) {
    backupAudio.pause()
    backupAudio.currentTime = 0
  }

  // Stop vibration
  stopVibration()
}

function startVibration() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  // Pulse vibration every 2 seconds until stopped
  navigator.vibrate([400, 200, 400, 200, 400])
  vibrateInterval = setInterval(() => {
    navigator.vibrate([400, 200, 400, 200, 400])
  }, 2000)
}

function stopVibration() {
  if (vibrateInterval) {
    clearInterval(vibrateInterval)
    vibrateInterval = null
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0) // Cancel all vibration
  }
}
