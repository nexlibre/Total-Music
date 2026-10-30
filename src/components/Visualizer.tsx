import { useEffect, useRef } from 'react'
import { engine } from '../player/PlayerProvider'
import { fillRoundRect } from './canvas'

interface Props {
  playing: boolean
  bars?: number
  height?: number
  className?: string
}

/**
 * Log-spaced spectrum driven by the AnalyserNode that sits *after* the EQ, so
 * what you see is the post-EQ signal — move a band and the bars move with it.
 */
export function Visualizer({ playing, bars = 44, height = 92, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelsRef = useRef<Float32Array>(new Float32Array(bars))

  useEffect(() => {
    levelsRef.current = new Float32Array(bars)
  }, [bars])

    useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0
    const spectrum = new Uint8Array(1024)

    const draw = () => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth ?? 420
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

      const analyser = engine.analyser
      const levels = levelsRef.current
      if (analyser && playing) {
        engine.getSpectrum(spectrum)
        const binCount = analyser.frequencyBinCount
        const nyquist = (engine.ctx?.sampleRate ?? 44100) / 2
        for (let i = 0; i < bars; i++) {
          // log-frequency mapping 40Hz..16kHz
          const f0 = 40 * Math.pow(16000 / 40, i / bars)
          const f1 = 40 * Math.pow(16000 / 40, (i + 1) / bars)
          const b0 = Math.floor((f0 / nyquist) * binCount)
          const b1 = Math.max(b0 + 1, Math.floor((f1 / nyquist) * binCount))
          let peak = 0
          for (let b = b0; b < Math.min(b1, binCount); b++) peak = Math.max(peak, spectrum[b])
          const target = Math.min(1, (peak / 255) * 1.15)
          levels[i] = levels[i] * 0.72 + target * 0.28
        }
      } else {
        for (let i = 0; i < bars; i++) levels[i] *= 0.86
      }

      const gap = 2
      const barW = Math.max(2, (w - gap * (bars - 1)) / bars)
      const grad = ctx.createLinearGradient(0, h, 0, 0)
      grad.addColorStop(0, 'rgba(124,92,255,0.95)')
      grad.addColorStop(0.55, 'rgba(255,90,170,0.95)')
      grad.addColorStop(1, 'rgba(255,196,60,0.98)')

      for (let i = 0; i < bars; i++) {
        const level = Math.max(0.02, levels[i])
        const bh = Math.max(3, level * h * 0.86)
        const x = i * (barW + gap)
        const r = Math.min(barW / 2, 3)
        ctx.fillStyle = grad
        ctx.globalAlpha = 0.95
        fillRoundRect(ctx, x, h - bh, barW, bh, r)

        // reflection
        ctx.globalAlpha = 0.16
        fillRoundRect(ctx, x, h - bh * 0.28, barW, Math.min(bh * 0.3, 14), r)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [playing, bars, height])

  return (
    <div className={`visualizer ${className}`} data-testid="visualizer">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
