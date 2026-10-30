import { useEffect, useRef } from 'react'
import { EQ_BANDS, frequencyGrid, responseCurve, type EqState } from '../../audio/eq'

const DB_TOP = 16
const DB_BOTTOM = -16
const F_MIN = 20
const F_MAX = 20000

const xFor = (freq: number, w: number) => (Math.log10(freq / F_MIN) / Math.log10(F_MAX / F_MIN)) * w
const yFor = (db: number, h: number) => ((DB_TOP - db) / (DB_TOP - DB_BOTTOM)) * h

interface Props {
  state: EqState
  height?: number
}

/** Live frequency response, computed from the same biquad math that is audible. */
export function EqCurve({ state, height = 170 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0

    const draw = () => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth ?? 600
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

      // --- grid
      ctx.lineWidth = 1
      for (const db of [-12, -6, 0, 6, 12]) {
        const y = Math.round(yFor(db, h)) + 0.5
        ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
        if (db !== 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)'
          ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
          ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 4, y - 3)
        }
      }
      for (const f of EQ_BANDS) {
        const x = Math.round(xFor(f, w)) + 0.5
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      // --- curve
      const gains = state.gains
      const curve = responseCurve(state, 44100, frequencyGrid(280))
      const freqs = frequencyGrid(280)
      const pts = curve.map((db, i) => [xFor(freqs[i], w), yFor(db, h)] as const)

      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, '#ffb020')
      grad.addColorStop(0.5, '#ff7a59')
      grad.addColorStop(1, '#5ce1e6')

      ctx.beginPath()
      ctx.moveTo(pts[0][0], yFor(0, h))
      for (const [x, y] of pts) ctx.lineTo(x, y)
      ctx.lineTo(pts[pts.length - 1][0], yFor(0, h))
      ctx.closePath()
      const fill = ctx.createLinearGradient(0, 0, 0, h)
      fill.addColorStop(0, 'rgba(255,176,32,0.28)')
      fill.addColorStop(0.5, 'rgba(255,122,89,0.10)')
      fill.addColorStop(1, 'rgba(92,225,230,0.18)')
      ctx.fillStyle = state.enabled ? fill : 'rgba(255,255,255,0.04)'
      ctx.fill()

      ctx.beginPath()
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.strokeStyle = state.enabled ? grad : 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()

      // --- band nodes
      if (state.enabled) {
        EQ_BANDS.forEach((f, i) => {
          const x = xFor(f, w)
          const y = yFor(gains[i], h)
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fillStyle = '#0b0d12'
          ctx.fill()
          ctx.lineWidth = 1.6
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'
          ctx.stroke()
        })
      }
    }

    draw()
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [state, height])

  return (
    <div className="eq-curve" data-testid="eq-curve">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="eq-curve__legend">
        <span>20 Hz</span>
        <span>200</span>
        <span>2k</span>
        <span>20 kHz</span>
      </div>
    </div>
  )
}
