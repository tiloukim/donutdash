// DonutDash D3c alert melody — bright xylophone cascade
// Plays a repeating melodic pattern until stopped
// Used by: customer orders, shop orders, driver alerts, admin

let audioCtx: AudioContext | null = null
let isPlaying = false
let vibrateInterval: ReturnType<typeof setInterval> | null = null
let scheduledSources: OscillatorNode[] = []
let masterGain: GainNode | null = null

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

// Unlock audio context on user interaction (required for mobile)
export function unlockAudio() {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // Audio not available
  }
}

// E3 melody: cheerful pop bounce
// Notes: D5 → F#5 → A5 → D6, bounce F#6, resolve D6
const MELODY_NOTES = [
  { freq: 587,  start: 0.00, dur: 0.10 },  // D5
  { freq: 740,  start: 0.08, dur: 0.10 },  // F#5
  { freq: 880,  start: 0.16, dur: 0.10 },  // A5
  { freq: 1175, start: 0.26, dur: 0.18 },  // D6
  // bounce
  { freq: 988,  start: 0.46, dur: 0.08 },  // B5
  { freq: 1175, start: 0.54, dur: 0.08 },  // D6
  { freq: 1319, start: 0.62, dur: 0.08 },  // E6
  { freq: 1480, start: 0.70, dur: 0.25 },  // F#6 (bright!)
  // resolve
  { freq: 1175, start: 1.05, dur: 0.12 },  // D6
  { freq: 1319, start: 1.17, dur: 0.12 },  // E6
  { freq: 1175, start: 1.29, dur: 0.35 },  // D6 (home)
]
const CYCLE_DURATION = 2.0 // seconds per cycle (notes + pause)

function scheduleNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  volume: number = 0.28
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(dest)

  // Warm bell-like tone (sine with harmonics)
  osc.type = 'sine'
  osc.frequency.value = freq

  // Envelope: quick attack, smooth release
  const attack = 0.008
  const release = 0.04
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + attack)
  gain.gain.setValueAtTime(volume, startTime + duration - release)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)

  scheduledSources.push(osc)

  // Add a harmonic overtone for shimmer
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.connect(gain2)
  gain2.connect(dest)
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2
  gain2.gain.setValueAtTime(0, startTime)
  gain2.gain.linearRampToValueAtTime(volume * 0.35, startTime + attack)
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.6)
  osc2.start(startTime)
  osc2.stop(startTime + duration + 0.01)

  scheduledSources.push(osc2)
}

// Play the D3c melody on a loop until stopped
export function playUrgentAlert() {
  if (isPlaying) return
  isPlaying = true

  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    masterGain = master

    const now = ctx.currentTime
    const totalCycles = 30 // 60 seconds max

    for (let cycle = 0; cycle < totalCycles; cycle++) {
      const cycleStart = now + cycle * CYCLE_DURATION
      for (const note of MELODY_NOTES) {
        scheduleNote(ctx, master, note.freq, cycleStart + note.start, note.dur)
      }
    }
  } catch {
    isPlaying = false
  }

  startVibration()
}

// Also loop the wav file as backup
let backupAudio: HTMLAudioElement | null = null

export function playUrgentAlertWithBackup(wavFile: string) {
  playUrgentAlert()

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
    for (const osc of scheduledSources) {
      try { osc.stop(); osc.disconnect() } catch { /* already stopped */ }
    }
    scheduledSources = []

    if (masterGain) {
      masterGain.disconnect()
      masterGain = null
    }
  } catch {
    // Already stopped
  }

  if (backupAudio) {
    backupAudio.pause()
    backupAudio.currentTime = 0
  }

  stopVibration()
}

function startVibration() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
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
    navigator.vibrate(0)
  }
}
