'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface SelfieCaptureModalProps {
  onComplete: (photos: File[]) => void
  onClose: () => void
}

const STEPS = [
  { instruction: 'Look straight at the camera', icon: '😐', direction: 'center' },
  { instruction: 'Turn your head to the LEFT', icon: '👈', direction: 'left' },
  { instruction: 'Turn your head to the RIGHT', icon: '👉', direction: 'right' },
]

export default function SelfieCaptureModal({ onComplete, onClose }: SelfieCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)

  // Start camera
  useEffect(() => {
    let mounted = true
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setCameraReady(true)
        }
      } catch {
        setError('Camera access denied. Please allow camera access and try again.')
      }
    }
    startCamera()
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror the image (front camera is mirrored)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      const direction = STEPS[step].direction
      const file = new File([blob], `selfie-${direction}-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const preview = URL.createObjectURL(blob)

      const newPhotos = [...photos, file]
      const newPreviews = [...previews, preview]
      setPhotos(newPhotos)
      setPreviews(newPreviews)

      if (step < STEPS.length - 1) {
        setStep(step + 1)
        setCountdown(null)
      } else {
        // All 3 captured — stop camera and complete
        streamRef.current?.getTracks().forEach(t => t.stop())
        onComplete(newPhotos)
      }
    }, 'image/jpeg', 0.9)
  }, [step, photos, previews, onComplete])

  const handleCapture = () => {
    setCountdown(3)
  }

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      capturePhoto()
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, capturePhoto])

  const handleRetake = () => {
    setStep(0)
    setPhotos([])
    setPreviews(p => { p.forEach(URL.revokeObjectURL); return [] })
    setCountdown(null)
    // Restart camera if stopped
    if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      }).then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }).catch(() => {})
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#1A1A2E', borderRadius: 20, maxWidth: 420, width: '100%',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
            Identity Verification ({step + 1}/{STEPS.length})
          </h3>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose() }}
            style={{ background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Camera view */}
        <div style={{ position: 'relative', background: '#000' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%', height: 320, objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Oval guide overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 200, height: 260, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.5)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }} />
          </div>

          {/* Countdown overlay */}
          {countdown !== null && countdown > 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,140,0,0.9)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 40, fontWeight: 800, color: '#fff',
              }}>
                {countdown}
              </div>
            </div>
          )}
        </div>

        {/* Step progress dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          padding: '12px 0',
        }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < step ? '#10B981' : i === step ? '#FF8C00' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Instruction */}
        <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>{STEPS[step].icon}</div>
          <p style={{
            color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 0',
          }}>
            {STEPS[step].instruction}
          </p>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            Position your face inside the oval
          </p>
        </div>

        {/* Previews of captured photos */}
        {previews.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 20px 12px' }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} alt={`Step ${i + 1}`} width={60} height={60}
                  style={{ borderRadius: 8, objectFit: 'cover', border: '2px solid #10B981' }} />
                <div style={{
                  position: 'absolute', bottom: -4, right: -4,
                  background: '#10B981', borderRadius: '50%', width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#fff', fontWeight: 700,
                }}>✓</div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>
              {error}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
          {photos.length > 0 && step < STEPS.length && (
            <button onClick={handleRetake} style={{
              flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}>
              Start Over
            </button>
          )}
          <button
            onClick={handleCapture}
            disabled={!cameraReady || countdown !== null}
            style={{
              flex: 2, padding: '14px', borderRadius: 12, border: 'none',
              background: !cameraReady || countdown !== null ? '#555' : '#FF8C00',
              color: '#fff', fontWeight: 700, fontSize: 16, cursor: !cameraReady ? 'wait' : 'pointer',
            }}
          >
            {!cameraReady ? 'Starting camera...' : countdown !== null ? 'Hold still...' : `📸 Capture (${STEPS[step].direction})`}
          </button>
        </div>
      </div>
    </div>
  )
}
