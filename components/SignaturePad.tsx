'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  width?: number
  height?: number
}

export default function SignaturePad({ onSave, width = 500, height = 200 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Set white background
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Draw signature line
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(canvas.width - 20, height - 40)
    ctx.stroke()
    // "Sign here" text
    ctx.fillStyle = '#ccc'
    ctx.font = '12px sans-serif'
    ctx.fillText('Sign above this line', 20, height - 20)
  }, [height])

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.strokeStyle = '#1A1A2E'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setIsDrawing(true)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDrawing(false)
  }

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(canvas.width - 20, height - 40)
    ctx.stroke()
    ctx.fillStyle = '#ccc'
    ctx.font = '12px sans-serif'
    ctx.fillText('Sign above this line', 20, height - 20)
    setHasSignature(false)
  }, [height])

  const save = () => {
    if (!canvasRef.current || !hasSignature) return
    onSave(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{
          width: '100%',
          maxWidth: width,
          height: 'auto',
          border: '2px solid #e5e7eb',
          borderRadius: 12,
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button
          type="button"
          onClick={clear}
          style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid #ddd',
            background: '#fff', color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasSignature}
          style={{
            padding: '8px 24px', borderRadius: 8, border: 'none',
            background: hasSignature ? '#FF8C00' : '#ccc',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: hasSignature ? 'pointer' : 'not-allowed',
          }}
        >
          Accept & Sign
        </button>
      </div>
    </div>
  )
}
