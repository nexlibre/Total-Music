/**
 * End-to-end DSP proof.
 *
 * `responseCurve()` is what the EQ screen draws. Here we filter real sample
 * data with an *independent* direct-form-II biquad implementation (same RBJ
 * coefficients the browser's BiquadFilterNode uses) and measure the actual
 * gain. If the drawing and the audio ever drift apart, these fail.
 */
import { describe, expect, it } from 'vitest'
import {
  BAND_Q,
  EQ_BANDS,
  EQ_PRESETS,
  applyPreset,
  DEFAULT_EQ,
  effectivePreampDb,
  peakingMagnitudeDb,
  responseCurve,
  suggestPreamp,
  type EqState,
} from '../src/audio/eq'

const FS = 44100

interface Coeffs {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

function peakingCoeffs(f0: number, q: number, gainDb: number, fs: number): Coeffs {
  const w0 = (2 * Math.PI * f0) / fs
  const alpha = Math.sin(w0) / (2 * q)
  const A = Math.pow(10, gainDb / 40)
  const cosW0 = Math.cos(w0)
  const a0 = 1 + alpha / A
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cosW0) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha / A) / a0,
  }
}

/** direct form II transposed */
function runBiquad(input: Float32Array, c: Coeffs): Float32Array {
  const out = new Float32Array(input.length)
  let z1 = 0
  let z2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]
    const y = c.b0 * x + z1
    z1 = c.b1 * x - c.a1 * y + z2
    z2 = c.b2 * x - c.a2 * y
    out[i] = y
  }
  return out
}

function sine(freq: number, seconds: number, amp = 0.5, fs = FS): Float32Array {
  const n = Math.floor(seconds * fs)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs)
  return buf
}

/** True if a sine has converged — used to skip the filter's transient. */
function rms(buf: Float32Array, from = 0): number {
  let sum = 0
  for (let i = from; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / (buf.length - from))
}

function amplitudeDb(buf: Float32Array, inputAmp: number): number {
  const steady = rms(buf, Math.floor(buf.length * 0.4)) * Math.SQRT2
  return 20 * Math.log10(steady / inputAmp)
}

function measureChain(state: EqState, freq: number): number {
  const input = sine(freq, 2, 0.4)
  let signal = input
  const preamp = Math.pow(10, effectivePreampDb(state) / 20)
  for (let i = 0; i < signal.length; i++) signal[i] *= preamp
  if (state.enabled) {
    for (let b = 0; b < EQ_BANDS.length; b++) {
      const gain = state.gains[b] ?? 0
      if (gain === 0) continue
      signal = runBiquad(signal, peakingCoeffs(EQ_BANDS[b], BAND_Q, gain, FS))
    }
  }
  return amplitudeDb(signal, 0.4)
}

describe('biquad implementation sanity', () => {
  it('passes a 0 dB peaking filter through untouched', () => {
    const input = sine(1000, 0.5, 0.3)
    const out = runBiquad(input, peakingCoeffs(1000, BAND_Q, 0, FS))
    for (let i = 500; i < 2000; i++) expect(out[i]).toBeCloseTo(input[i], 5)
  })

  it('actually attenuates when the band asks for it', () => {
    const input = sine(1000, 0.5, 0.3)
    const out = runBiquad(input, peakingCoeffs(1000, BAND_Q, -12, FS))
    expect(amplitudeDb(out, 0.3)).toBeCloseTo(-12, 1)
  })
})

describe('analytic curve vs. measured audio', () => {
  const cases: Array<[string, EqState]> = [
    ['flat', { ...DEFAULT_EQ, enabled: true, gains: Array(10).fill(0) }],
    ['flat + 6 dB preamp', { ...DEFAULT_EQ, enabled: true, gains: Array(10).fill(0), preamp: 6 }],
    ['rock', applyPreset(DEFAULT_EQ, 'rock')],
    ['bass boost', applyPreset(DEFAULT_EQ, 'bass')],
    ['v-shape', applyPreset(DEFAULT_EQ, 'vshape')],
    ['vocal', applyPreset(DEFAULT_EQ, 'vocal')],
    ['flat but bypassed', { ...DEFAULT_EQ, enabled: false, preamp: -5 }],
    [
      'hand-tuned custom',
      {
        ...DEFAULT_EQ,
        enabled: true,
        preamp: -2,
        gains: [11, 6, 0, -4, 3, 0, 8, -9, 2, 5],
      },
    ],
  ]

  for (const [name, state] of cases) {
    it(`matches the measured response for "${name}" at every band centre`, () => {
      for (let i = 0; i < EQ_BANDS.length; i++) {
        const f = EQ_BANDS[i]
        const drawn = responseCurve(state, FS, [f])[0]
        const heard = measureChain(state, f)
        expect(
          Math.abs(drawn - heard),
          `${name} @ ${f} Hz — drawn ${drawn.toFixed(2)} dB, measured ${heard.toFixed(2)} dB`,
        ).toBeLessThan(0.35)
      }
    })
  }
})

describe('bypass semantics', () => {
  it('bypassing removes every band gain but keeps the preamp', () => {
    const loud = applyPreset(DEFAULT_EQ, 'bass')
    const bypassed = { ...loud, enabled: false }
    const measured = measureChain(bypassed, 62)
    expect(measured).toBeCloseTo(loud.preamp, 1)
  })

  it('a disabled EQ is measurably different from an enabled one', () => {
    const bass = applyPreset({ ...DEFAULT_EQ, enabled: true }, 'bass')
    const on = measureChain(bass, 62)
    const off = measureChain({ ...bass, enabled: false }, 62)
    expect(on - off).toBeGreaterThan(6)
  })
})

describe('headroom suggestion is not just cosmetic', () => {
  it('auto-headroom removes the clipping peak in the real signal', () => {
    for (const id of ['bass', 'vshape', 'dance', 'hiphop', 'treble']) {
      const state = applyPreset({ ...DEFAULT_EQ, enabled: true }, id)
      // the band with the strongest boost is where clipping would start
      const loudest = EQ_BANDS[state.gains.indexOf(Math.max(...state.gains))]
      const before = measureChain(state, loudest)
      const after = measureChain({ ...state, preamp: suggestPreamp(state) }, loudest)
      expect(before, id).toBeGreaterThan(0)
      expect(after, id).toBeLessThan(0.5)
    }
  })
})

describe('every shipped preset is measured, not assumed', () => {
  it('produces a response within 0.4 dB of its own curve', () => {
    for (const preset of EQ_PRESETS) {
      const state = { ...applyPreset({ ...DEFAULT_EQ, enabled: true }, preset.id) }
      for (const f of [125, 1000, 4000] as const) {
        const i = EQ_BANDS.indexOf(f as (typeof EQ_BANDS)[number])
        const drawn = responseCurve(state, FS, [f])[0]
        const heard = measureChain(state, f)
        expect(Math.abs(drawn - heard), `${preset.id} @ ${f}: ${drawn.toFixed(2)} vs ${heard.toFixed(2)}`).toBeLessThan(0.4)
        expect(Number.isFinite(state.gains[i])).toBe(true)
      }
    }
  })
})

describe('peakingMagnitudeDb agrees with the time domain', () => {
  it('predicts the measured gain of a single band at several frequencies', () => {
    const gain = 9
    const f0 = 1000
    const c = peakingCoeffs(f0, BAND_Q, gain, FS)
    for (const freq of [250, 500, 1000, 2000, 4000]) {
      const out = runBiquad(sine(freq, 1, 0.3), c)
      const measured = amplitudeDb(out, 0.3)
      const predicted = peakingMagnitudeDb(freq, f0, BAND_Q, gain, FS)
      expect(Math.abs(predicted - measured)).toBeLessThan(0.2)
    }
  })
})
