'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  file: File
  onCancel: () => void
  // Receives the cropped image as a JPEG blob (1024px × 1024px max).
  onCrop: (blob: Blob) => void
}

const VIEWPORT = 280       // square crop window shown on screen
const OUTPUT = 1024        // final image resolution sent to the server

export default function AvatarCropper({ file, onCancel, onCrop }: Props) {
  const [src, setSrc] = useState<string>('')
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [working, setWorking] = useState(false)
  const dragging = useRef<{ x: number; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Read the picked file into a data URL.
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = e => setSrc(String(e.target?.result || ''))
    reader.readAsDataURL(file)
  }, [file])

  // When the image loads, size it so the SHORT side fills the viewport at scale=1
  // — i.e. you can never zoom out past "image fills the circle." Then center it.
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const ratio = VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight)
    const w = img.naturalWidth * ratio
    const h = img.naturalHeight * ratio
    setImgSize({ w, h })
    setScale(1)
    setPos({ x: (VIEWPORT - w) / 2, y: (VIEWPORT - h) / 2 })
  }

  // Keep the image covering the viewport — clamp pos so edges never reveal background.
  const clamp = (x: number, y: number, s: number) => {
    const w = imgSize.w * s
    const h = imgSize.h * s
    const minX = VIEWPORT - w
    const minY = VIEWPORT - h
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const next = clamp(e.clientX - dragging.current.x, e.clientY - dragging.current.y, scale)
    setPos(next)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragging.current = null
  }

  const onScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value)
    // Re-clamp position so the new scale doesn't reveal a gap at the edge.
    setPos(p => clamp(p.x, p.y, next))
    setScale(next)
  }

  const handleCrop = async () => {
    if (!imgRef.current) return
    setWorking(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) { setWorking(false); return }

    // The viewport shows imgSize.w * scale × imgSize.h * scale of the rendered image,
    // offset by pos. Map that crop region back to the source image's natural pixels
    // and draw OUTPUT × OUTPUT.
    const renderedW = imgSize.w * scale
    const naturalToRendered = imgRef.current.naturalWidth / renderedW
    const sx = -pos.x * naturalToRendered
    const sy = -pos.y * naturalToRendered
    const sSize = VIEWPORT * naturalToRendered

    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob(blob => {
      setWorking(false)
      if (blob) onCrop(blob)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Crop your photo</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>Drag to reposition, slide to zoom.</p>

        <div
          style={{
            width: VIEWPORT, height: VIEWPORT, margin: '0 auto', borderRadius: '50%',
            overflow: 'hidden', position: 'relative', background: '#000',
            touchAction: 'none', cursor: dragging.current ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              style={{
                position: 'absolute',
                left: pos.x, top: pos.y,
                width: imgSize.w * scale, height: imgSize.h * scale,
                maxWidth: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
            <span>Zoom</span>
            <input
              type="range" min={1} max={3} step={0.01} value={scale}
              onChange={onScaleChange}
              style={{ flex: 1 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={onCancel}
            disabled={working}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#666', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={handleCrop}
            disabled={working}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: '#FF8C00', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >{working ? 'Processing...' : 'Use Photo'}</button>
        </div>
      </div>
    </div>
  )
}
