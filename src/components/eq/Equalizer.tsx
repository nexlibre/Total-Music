import { useCallback, useEffect, useRef } from 'react'
import {
  BAND_COUNT,
  EQ_BANDS,
  EQ_PRESETS,
  GAIN_MAX,
  GAIN_MIN,
  PREAMP_MAX,
  PREAMP_MIN,
  applyPreset,
  formatGain,
  getPreset,
  isFlat,
  peakBoostDb,
  resetBand,
  setBandGain,
  setPreamp,
  suggestPreamp,
  type EqState,
} from '../../audio/eq'
import { eqStore, setEq } from '../../state/eqStore'
import { useStore } from '../../state/useStore'
import { BandSlider } from './BandSlider'
import { EqCurve } from './EqCurve'
import { CloseIcon, ResetIcon, SparkIcon } from '../Icons'

const update = (fn: (s: EqState) => EqState) => setEq((prev) => fn(prev))

export function Equalizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const eq = useStore(eqStore)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])

  const onPreset = useCallback((id: string) => {
    update((s) => applyPreset(s, id))
  }, [])

  if (!open) return null

  const activePreset = getPreset(eq.presetId)
  const peak = peakBoostDb(eq)
  const clippingRisk = peak > 0.2

  return (
    <div className="sheet" role="presentation">
      <div className="sheet__backdrop" onClick={onClose} data-testid="eq-backdrop" />
      <div
        className="sheet__panel eq-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eq-title"
        ref={panelRef}
        data-testid="eq-panel"
      >
        <div className="sheet__grip" aria-hidden="true" />

        <header className="sheet__head">
          <div>
            <p className="eyebrow">Procesado de audio</p>
            <h2 id="eq-title" className="sheet__title">
              Ecualizador <span className="sheet__sub">10 bandas</span>
            </h2>
          </div>
          <div className="sheet__headActions">
            <button
              type="button"
              role="switch"
              aria-checked={eq.enabled}
              className={`switch ${eq.enabled ? 'is-on' : ''}`}
              onClick={() => update((s) => ({ ...s, enabled: !s.enabled }))}
              data-testid="eq-toggle"
              aria-label="Activar ecualizador"
            >
              <span className="switch__dot" />
              <span className="switch__label">{eq.enabled ? 'Activo' : 'Bypass'}</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Cerrar ecualizador"
              ref={closeRef}
              data-testid="eq-close"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </header>

        <div className="presets" role="group" aria-label="Presets de ecualización">
          {EQ_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`chip ${eq.presetId === preset.id ? 'is-active' : ''}`}
              onClick={() => onPreset(preset.id)}
              data-testid={`preset-${preset.id}`}
              aria-pressed={eq.presetId === preset.id}
            >
              {preset.name}
            </button>
          ))}
          {eq.presetId === 'custom' && (
            <span className="chip chip--custom is-active" aria-live="polite">
              Personalizado
            </span>
          )}
        </div>

        <EqCurve state={eq} height={168} />

        <div className="eq-controls">
          <div className="eq-controls__row">
            <label className="mini-slider">
              <span className="mini-slider__label">Preamp</span>
              <input
                type="range"
                min={PREAMP_MIN}
                max={PREAMP_MAX}
                step={0.5}
                value={eq.preamp}
                onChange={(e) => update((s) => setPreamp(s, Number(e.target.value)))}
                aria-label="Pre-amplificación"
                data-testid="preamp"
              />
              <output className="mini-slider__value">{formatGain(eq.preamp)} dB</output>
            </label>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => update((s) => setPreamp(s, suggestPreamp(s)))}
              title="Bajar el preamp para recuperar headroom"
            >
              <SparkIcon size={13} />
              Auto-headroom
            </button>
          </div>

          <div className="bands" role="group" aria-label="Bandas del ecualizador">
            {EQ_BANDS.map((freq, i) => (
              <BandSlider
                key={freq}
                freq={freq}
                gain={eq.gains[i] ?? 0}
                disabled={!eq.enabled}
                onChange={(g) => update((s) => setBandGain(s, i, g))}
                onReset={() => update((s) => resetBand(s, i))}
              />
            ))}
          </div>

          <div className="eq-tone">
            <label className="mini-slider">
              <span className="mini-slider__label">Graves</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.tone.bass}
                onChange={(e) => update((s) => ({ ...s, tone: { ...s.tone, bass: Number(e.target.value) } }))}
                aria-label="Control de graves"
                data-testid="tone-bass"
              />
              <output className="mini-slider__value">{formatGain(eq.tone.bass)}</output>
            </label>
            <label className="mini-slider">
              <span className="mini-slider__label">Agudos</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.tone.treble}
                onChange={(e) => update((s) => ({ ...s, tone: { ...s.tone, treble: Number(e.target.value) } }))}
                aria-label="Control de agudos"
                data-testid="tone-treble"
              />
              <output className="mini-slider__value">{formatGain(eq.tone.treble)}</output>
            </label>
          </div>
        </div>

        <footer className="eq-footer">
          <div className="eq-footer__status">
            <span className={`dot ${clippingRisk ? 'dot--warn' : 'dot--ok'}`} aria-hidden="true" />
            <span data-testid="headroom">
              {clippingRisk
                ? `Pico de ${formatGain(peak)} dB · ${eq.limiter ? 'limitador activo' : 'riesgo de saturación'}`
                : `Headroom OK · pico ${formatGain(peak)} dB`}
            </span>
            <span className="eq-footer__preset">{activePreset ? activePreset.name : 'Curva personalizada'}</span>
          </div>
          <div className="eq-footer__actions">
            <button
              type="button"
              role="switch"
              aria-checked={eq.limiter}
              className={`switch switch--sm ${eq.limiter ? 'is-on' : ''}`}
              onClick={() => update((s) => ({ ...s, limiter: !s.limiter }))}
              data-testid="limiter-toggle"
            >
              <span className="switch__dot" />
              <span className="switch__label">Limitador</span>
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => update((s) => ({ ...s, gains: Array(BAND_COUNT).fill(0), preamp: 0, presetId: 'flat' }))}
              disabled={isFlat(eq) && eq.preamp === 0}
              data-testid="eq-reset"
            >
              <ResetIcon size={13} />
              Aplanar
            </button>
          </div>
        </footer>

        <p className="eq-hint">
          Arrastra una banda o usa ↑ ↓ · doble clic para volver a 0 dB · bandas {GAIN_MIN} a {GAIN_MAX} dB
        </p>
      </div>
    </div>
  )
}
