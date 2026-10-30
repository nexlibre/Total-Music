/**
 * Graphic equalizer model + exact biquad magnitude math.
 *
 * The ten bands mirror Poweramp's octave-spaced 10-band graphic EQ. Every band
 * is a Web Audio `peaking` BiquadFilterNode, so the response we *draw* is
 * computed with the very same RBJ cookbook coefficients the browser uses to
 * *filter*. That keeps the curve honest instead of being a decorative spline.
 */

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const BAND_COUNT = EQ_BANDS.length

export const GAIN_MIN = -12
export const GAIN_MAX = 12
export const PREAMP_MIN = -12
export const PREAMP_MAX = 12
/** Octave-spaced graphic EQ → Q of 1.41 is the textbook-correct bandwidth. */
export const BAND_Q = 1.41

export type BandGains = number[]

export interface EqState {
  /** Master bypass. When false the chain is fed dry (preamp still applies). */
  enabled: boolean
  /** Preset currently selected, or 'custom' once a band is dragged. */
  presetId: string
  preamp: number
  gains: BandGains
  /** Soft limiter after the EQ chain, prevents clipping from big boost curves. */
  limiter: boolean
  /** Stereo widen-ish "bass focus" curve used by Poweramp's tone page. */
  tone: { bass: number; treble: number }
}

export interface EqPreset {
  id: string
  name: string
  gains: BandGains
  preamp?: number
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const CUSTOM_ID = 'custom'

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'rock', name: 'Rock', gains: [5, 4.5, 3, 1, -1, -1.5, 0.5, 2.5, 3.5, 4] },
  { id: 'pop', name: 'Pop', gains: [-1.5, -0.5, 1, 3, 4, 3.5, 1, -1, -1.5, -2] },
  { id: 'jazz', name: 'Jazz', gains: [3, 2.5, 1.5, 1, -0.5, -0.5, 0, 1.5, 2.5, 3] },
  { id: 'classical', name: 'Classical', gains: [3.5, 3, 2, 1.5, -0.5, -0.5, 0, 2, 3, 3.5] },
  { id: 'dance', name: 'Dance', gains: [6, 5, 2.5, 0, -1, 0.5, 2.5, 3.5, 4, 3] },
  { id: 'hiphop', name: 'Hip-Hop', gains: [6.5, 5.5, 3, 0.5, -1, 0.5, 1.5, 2.5, 3, 3.5] },
  { id: 'metal', name: 'Metal', gains: [0, 1.5, 2, 1, -1.5, -1, 1, 3, 4, 4.5] },
  { id: 'vocal', name: 'Vocal', gains: [-3, -2, 0, 2.5, 4, 4.5, 3, 1, -1, -2.5] },
  { id: 'bass', name: 'Bass Boost', gains: [9, 8, 6, 3, 0, -0.5, -1, -1, -0.5, 0], preamp: -4 },
  { id: 'treble', name: 'Treble Boost', gains: [-1, -1, -0.5, 0, 1, 2.5, 4.5, 6, 7.5, 8], preamp: -4 },
  { id: 'vshape', name: 'V-Shape', gains: [7, 6, 4, 1, -2, -3, -1, 2, 4.5, 6], preamp: -3 },
  { id: 'lofi', name: 'Lo-Fi', gains: [2, 1.5, 0.5, -1, -2.5, -3, -2, -1, -0.5, -1.5], preamp: 2 },
]

export function getPreset(id: string): EqPreset | undefined {
  return EQ_PRESETS.find((p) => p.id === id)
}

export const DEFAULT_EQ: EqState = {
  enabled: false,
  presetId: 'flat',
  preamp: 0,
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  limiter: true,
  tone: { bass: 0, treble: 0 },
}

/** A preset only counts as "active" if the gains still match it. */
export function matchPreset(gains: BandGains, preamp: number): string | null {
  const hit = EQ_PRESETS.find(
    (p) =>
      p.gains.length === gains.length &&
      p.gains.every((g, i) => Math.abs(g - gains[i]) < 0.05) &&
      Math.abs((p.preamp ?? 0) - preamp) < 0.05,
  )
  return hit ? hit.id : null
}

/** Dragging a band leaves a named preset behind and becomes "custom". */
export function setBandGain(state: EqState, index: number, gain: number): EqState {
  if (index < 0 || index >= BAND_COUNT) return state
  const gains = state.gains.slice()
  gains[index] = round1(clamp(gain, GAIN_MIN, GAIN_MAX))
  return { ...state, gains, presetId: matchPreset(gains, state.preamp) ?? CUSTOM_ID }
}

export function resetBand(state: EqState, index: number): EqState {
  return setBandGain(state, index, 0)
}

export function applyPreset(state: EqState, presetId: string): EqState {
  const preset = getPreset(presetId)
  if (!preset) return state
  const gains = preset.gains.slice()
  return { ...state, presetId: preset.id, gains, preamp: preset.preamp ?? 0 }
}

export function setPreamp(state: EqState, preamp: number): EqState {
  const p = round1(clamp(preamp, PREAMP_MIN, PREAMP_MAX))
  return { ...state, preamp: p, presetId: matchPreset(state.gains, p) ?? CUSTOM_ID }
}

export const round1 = (v: number) => Math.round(v * 10) / 10

export function isFlat(state: EqState): boolean {
  return state.gains.every((g) => Math.abs(g) < 0.05)
}

/** The full chain gain = preamp + tone shelves. Used by the engine. */
export function effectivePreampDb(state: EqState): number {
  return clamp(state.preamp + state.tone.bass * 0.4 + state.tone.treble * 0.3, PREAMP_MIN * 2, PREAMP_MAX)
}

/**
 * |H(e^{jw})| in dB for a peaking biquad — RBJ cookbook, identical to Chrome's
 * BiquadFilterNode implementation for type 'peaking'.
 */
export function peakingMagnitudeDb(freq: number, f0: number, q: number, gainDb: number, sampleRate: number): number {
  if (gainDb === 0) return 0
  const w0 = (2 * Math.PI * f0) / sampleRate
  const alpha = Math.sin(w0) / (2 * q)
  const A = Math.pow(10, gainDb / 40)
  const cosW0 = Math.cos(w0)

  const b0 = 1 + alpha * A
  const b1 = -2 * cosW0
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cosW0
  const a2 = 1 - alpha / A

  const w = (2 * Math.PI * Math.min(freq, sampleRate / 2 - 1)) / sampleRate
  const cosW = Math.cos(w)
  const sinW = Math.sin(w)
  const cos2W = Math.cos(2 * w)
  const sin2W = Math.sin(2 * w)

  const numRe = b0 + b1 * cosW + b2 * cos2W
  const numIm = -(b1 * sinW + b2 * sin2W)
  const denRe = a0 + a1 * cosW + a2 * cos2W
  const denIm = -(a1 * sinW + a2 * sin2W)

  const num = Math.hypot(numRe, numIm)
  const den = Math.hypot(denRe, denIm)
  if (den === 0) return 0
  return 20 * Math.log10(num / den)
}

/** Log-spaced frequency grid from 20 Hz to 20 kHz. */
export function frequencyGrid(points = 240, min = 20, max = 20000): number[] {
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    out.push(min * Math.pow(max / min, t))
  }
  return out
}

/**
 * Combined response of the whole chain, in dB, including preamp.
 * Bypassed EQ still reports the preamp — that is what the user actually hears.
 */
export function responseCurve(state: EqState, sampleRate = 44100, freqs = frequencyGrid()): number[] {
  const preamp = effectivePreampDb(state)
  if (!state.enabled) return freqs.map(() => preamp)
  return freqs.map((f) => {
    let db = preamp
    for (let i = 0; i < BAND_COUNT; i++) {
      db += peakingMagnitudeDb(f, EQ_BANDS[i], BAND_Q, state.gains[i] ?? 0, sampleRate)
    }
    return db
  })
}

/** Highest combined boost in dB — drives the clipping warning + limiter readout. */
export function peakBoostDb(state: EqState, sampleRate = 44100): number {
  if (!state.enabled) return effectivePreampDb(state)
  const curve = responseCurve(state, sampleRate)
  return Math.max(...curve)
}

/** Suggests the preamp that keeps a curve at or below 0 dB of headroom. */
export function suggestPreamp(state: EqState): number {
  if (!state.enabled) return state.preamp
  let peak = 0
  for (const band of state.gains) peak += Math.max(0, band)
  const budget = round1(clamp(-peak, PREAMP_MIN, 0))
  return budget
}

// ---------------------------------------------------------------- validation

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Never trust localStorage: a hand-edited value must not break the audio graph. */
export function parseEqState(raw: unknown): EqState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_EQ, gains: DEFAULT_EQ.gains.slice() }
  const o = raw as Record<string, unknown>
  const rawGains = Array.isArray(o.gains) ? o.gains : []
  const gains = EQ_BANDS.map((_, i) => round1(clamp(num(rawGains[i], 0), GAIN_MIN, GAIN_MAX)))
  const preamp = round1(clamp(num(o.preamp, 0), PREAMP_MIN, PREAMP_MAX))
  const toneRaw = (o.tone ?? {}) as Record<string, unknown>
  return {
    enabled: o.enabled === true,
    presetId: typeof o.presetId === 'string' ? o.presetId : matchPreset(gains, preamp) ?? CUSTOM_ID,
    preamp,
    gains,
    limiter: o.limiter !== false,
    tone: {
      bass: round1(clamp(num(toneRaw.bass, 0), -12, 12)),
      treble: round1(clamp(num(toneRaw.treble, 0), -12, 12)),
    },
  }
}

export function formatGain(g: number): string {
  const r = round1(g)
  if (r === 0) return '0'
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}`
}

export function formatBand(f: number): string {
  return f >= 1000 ? `${f / 1000}k` : `${f}`
}
