import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../audio/tracks'
import { fillRoundRect } from './canvas'

interface Props {
  position: number
  duration: number
  peaks: Float32Array | null
  onSeek: (seconds: number) => void
  height?: number
  showTimes?: boolean
  label?: string
}

const FALLBACK_BARS = 96

/**
 * Waveform scrubber. Dragging only *previews* the position and commits on
 * release — otherwise every pointermove would restart the buffer source.
 */
export function Scrubber({
  position,
  duration,
  peaks,
  onSeek,
  height = 34,
  showTimes = true,
  label = 'Posición de reproducción',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const ratio = dragRatio ?? (duration > 0 ? Math.min(1, position / duration) : 0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.parentElement?.clientWidth ?? 400
    const h = height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const bars = peaks && peaks.length ? peaks.length : FALLBACK_BARS
    const gap = 1.5
    const barW = Math.max(1, (w - gap * (bars - 1)) / bars)
    const mid = h / 2
    const playedX = ratio * w

    for (let i = 0; i < bars; i++) {
      const x = i * (barW + gap)
      const peak = peaks && peaks.length ? peaks[i] : 0.25 + 0.12 * Math.sin(i * 0.7)
      const bh = Math.max(2, peak * (h - 4))
      const played = x + barW * 0.5 <= playedX
      ctx.fillStyle = played
        ? 'rgba(255,255,255,0.92)'
        : 'rgba(255,255,255,0.20)'
      fillRoundRect(ctx, x, mid - bh / 2, barW, bh, Math.min(barW / 2, 1.2))
    }

    ctx.fillStyle = 'rgba(255,176,32,0.95)'
    ctx.fillRect(Math.max(0, playedX - 1), 0, 2, h)
  }, [height, peaks, ratio])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(() => draw())
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement)
    return () => ro.disconnect()
  }, [draw])

  const ratioFromEvent = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  return (
    <div className="scrubber">
      <div
        className="scrubber__hit"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(dragRatio !== null ? dragRatio * duration : position)}
        aria-valuetext={`${formatTime(position)} de ${formatTime(duration)}`}
        onPointerDown={(e) => {
          if (duration <= 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragRatio(ratioFromEvent(e.clientX, e.currentTarget))
        }}
        onPointerMove={(e) => {
          if (dragRatio === null) return
          setDragRatio(ratioFromEvent(e.clientX, e.currentTarget))
        }}
        onPointerUp={(e) => {
          if (dragRatio === null) return
          const r = ratioFromEvent(e.clientX, e.currentTarget)
          setDragRatio(null)
          onSeek(r * duration)
        }}
        onKeyDown={(e) => {
          if (duration <= 0) return
          const step = e.shiftKey ? 15 : 5
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            onSeek(Math.min(duration, position + step))
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onSeek(Math.max(0, position - step))
          } else if (e.key === 'Home') {
            e.preventDefault()
            onSeek(0)
          }
        }}
        data-testid="scrubber"
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        {dragRatio !== null && (
          <span className="scrubber__bubble" style={{ left: `${dragRatio * 100}%` }}>
            {formatTime(dragRatio * duration)}
          </span>
        )}
      </div>
      {showTimes && (
        <div className="scrubber__times">
          <span>{formatTime(dragRatio !== null ? dragRatio * duration : position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  )
}
