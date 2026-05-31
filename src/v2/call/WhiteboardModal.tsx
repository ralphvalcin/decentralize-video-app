import { useRef, useEffect, useCallback } from 'react'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useCallStore } from '../store/useCallStore'
import { WhiteboardToolbar } from './WhiteboardToolbar'
import { ThumbnailStrip } from './ThumbnailStrip'
import { WhiteboardParticipantDropdown } from './WhiteboardParticipantDropdown'
import type { Stroke, StrokePoint } from '../types'

interface WhiteboardModalProps {
  onStroke: (stroke: Stroke) => void
  onClear: () => void
  onClose: () => void
  canDraw: boolean
  onGrant: (peerId: string) => void
  onRevoke: (peerId: string) => void
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  if (stroke.points.length < 2) return
  ctx.save()
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = stroke.width
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h)
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h)
  }
  ctx.stroke()
  ctx.restore()
}

export function WhiteboardModal({ onStroke, onClear, onClose, canDraw, onGrant, onRevoke }: WhiteboardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])

  const socketId = useCallStore((s) => s.socketId)
  const isHost = useCallStore((s) => s.isHost)
  const strokes = useWhiteboardStore((s) => s.strokes)
  const currentTool = useWhiteboardStore((s) => s.currentTool)
  const currentColor = useWhiteboardStore((s) => s.currentColor)
  const setTool = useWhiteboardStore((s) => s.setTool)
  const setColor = useWhiteboardStore((s) => s.setColor)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height)
    }
  }, [strokes])

  const redrawRef = useRef<() => void>(redraw)
  useEffect(() => { redrawRef.current = redraw }, [redraw])

  useEffect(() => { redraw() }, [redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Sync dimensions immediately before first ResizeObserver callback fires
    if (canvas.offsetWidth) canvas.width = canvas.offsetWidth
    if (canvas.offsetHeight) canvas.height = canvas.offsetHeight
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      redrawRef.current()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])  // created once on mount only

  function getPoint(e: React.MouseEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / (canvas.width || 1),
      y: (e.clientY - rect.top) / (canvas.height || 1),
    }
  }

  function getTouchPoint(e: React.TouchEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    return {
      x: (touch.clientX - rect.left) / (canvas.width || 1),
      y: (touch.clientY - rect.top) / (canvas.height || 1),
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canDraw) return
    isDrawingRef.current = true
    currentPointsRef.current = [getPoint(e)]
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !canDraw) return
    currentPointsRef.current.push(getPoint(e))
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height)
    }
    drawStroke(ctx, {
      id: '__preview',
      tool: currentTool,
      color: currentColor,
      width: currentTool === 'eraser' ? 20 : 3,
      points: currentPointsRef.current,
      drawerId: '__local',
    }, canvas.width, canvas.height)
  }

  function finalizeStroke() {
    if (!isDrawingRef.current || !canDraw) return
    isDrawingRef.current = false
    const points = currentPointsRef.current
    currentPointsRef.current = []
    if (points.length < 2) return
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      tool: currentTool,
      color: currentColor,
      width: currentTool === 'eraser' ? 20 : 3,
      points,
      drawerId: socketId ?? '__local',
    }
    onStroke(stroke)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-testid="whiteboard-modal">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">✏️ Whiteboard</span>
          {!canDraw && (
            <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded">
              View only
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isHost && <WhiteboardParticipantDropdown onGrant={onGrant} onRevoke={onRevoke} />}
          <button
            data-testid="btn-whiteboard-close"
            aria-label="Close whiteboard"
            onClick={onClose}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          >
            ↩ Exit
          </button>
        </div>
      </div>

      {canDraw && (
        <WhiteboardToolbar
          currentTool={currentTool}
          currentColor={currentColor}
          onToolChange={setTool}
          onColorChange={setColor}
          onClear={onClear}
        />
      )}

      <canvas
        ref={canvasRef}
        data-testid="whiteboard-canvas"
        className="flex-1 w-full cursor-crosshair"
        style={{ touchAction: 'none', background: '#fff' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finalizeStroke}
        onMouseLeave={finalizeStroke}
        onTouchStart={(e) => {
          e.preventDefault()
          if (!canDraw) return
          isDrawingRef.current = true
          currentPointsRef.current = [getTouchPoint(e)]
        }}
        onTouchMove={(e) => {
          e.preventDefault()
          if (!isDrawingRef.current || !canDraw) return
          currentPointsRef.current.push(getTouchPoint(e))
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          for (const stroke of strokes) {
            drawStroke(ctx, stroke, canvas.width, canvas.height)
          }
          drawStroke(ctx, {
            id: '__preview',
            tool: currentTool,
            color: currentColor,
            width: currentTool === 'eraser' ? 20 : 3,
            points: currentPointsRef.current,
            drawerId: '__local',
          }, canvas.width, canvas.height)
        }}
        onTouchEnd={() => finalizeStroke()}
      />

      <div className="shrink-0 border-t border-[var(--border-subtle)]">
        <ThumbnailStrip />
      </div>
    </div>
  )
}
