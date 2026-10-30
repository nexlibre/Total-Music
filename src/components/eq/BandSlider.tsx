import { useCallback, useId, useRef } from 'react'
import { GAIN_MAX, GAIN_MIN, clamp, formatBand, formatGain, round1 } from '../../audio/eq'

interface Props {
  freq: number
  gain: number
  disabled?: boolean
  onChange: (gain: number) => void
  onReset: () => void
}

const SNAP = 0.5
const snap = (v: number) => round1(Math.round(clamp(v, GAIN_MIN, GAIN_MAX) / SNAP) * SNAP)

/**
 * Vertical graphic-EQ fader. A div with role="slider" instead of a rotated
 * <input type=range>: correct semantics, real keyboard control, and no
 * cross-browser transform hacks.
 */
export function BandSlider({ freq, gain, disabled = false, onChange, onReset }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const labelId = useId()

  const valueFromPointer = useCallback((clientY: number) => {
    const el = ref.current
    if (!el) return gain
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) return gain
    const ratio = 1 - (clientY - rect.top) / rect.height
    return snap(GAIN_MIN + ratio * (GAIN_MAX - GAIN_MIN))
  }, [gain])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(valueFromPointer(e.clientY))
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      onChange(valueFromPointer(e.clientY))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const step = e.shiftKey ? 0.5 : 1
    const map: Record<string, number> = {
      ArrowUp: gain + step,
      ArrowRight: gain + step,
      ArrowDown: gain - step,
      ArrowLeft: gain - step,
      PageUp: gain + 3,
      PageDown: gain - 3,
      Home: GAIN_MIN,
      End: GAIN_MAX,
      '0': 0,
    }
    if (e.key in map) {
      e.preventDefault()
      onChange(snap(map[e.key]))
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onReset()
    }
  }

  const pct = ((gain - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100
  const zeroPct = ((0 - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100
  const from = Math.min(pct, zeroPct)
  const height = Math.abs(pct - zeroPct)

  return (
    <div className={`band ${disabled ? 'is-disabled' : ''}`}>
      <output className="band__value" aria-hidden="true">
        {formatGain(gain)}
      </output>
      <div
        ref={ref}
        className="band__track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-orientation="vertical"
        aria-valuemin={GAIN_MIN}
        aria-valuemax={GAIN_MAX}
        aria-valuenow={gain}
        aria-valuetext={`${formatGain(gain)} decibelios`}
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDoubleClick={onReset}
        onKeyDown={handleKeyDown}
        data-testid={`band-${freq}`}
      >
        <span className="band__rail" />
        <span className="band__zero" style={{ bottom: `${zeroPct}%` }} />
        <span className="band__fill" style={{ bottom: `${from}%`, height: `${height}%` }} />
        <span className="band__thumb" style={{ bottom: `calc(${pct}% - 9px)` }} />
      </div>
      <span className="band__label" id={labelId}>
        {formatBand(freq)}
      </span>
    </div>
  )
}
