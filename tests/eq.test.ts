import { describe, expect, it } from 'vitest'
import {
  BAND_COUNT,
  BAND_Q,
  DEFAULT_EQ,
  EQ_BANDS,
  EQ_PRESETS,
  GAIN_MAX,
  GAIN_MIN,
  applyPreset,
  formatBand,
  formatGain,
  frequencyGrid,
  isFlat,
  matchPreset,
  parseEqState,
  peakBoostDb,
  peakingMagnitudeDb,
  resetBand,
  responseCurve,
  round1,
  setBandGain,
  setPreamp,
  suggestPreamp,
} from '../src/audio/eq'

const SR = 48000

const eqWith = (over: Partial<typeof DEFAULT_EQ> = {}) => ({
  ...DEFAULT_EQ,
  enabled: true,
  gains: DEFAULT_EQ.gains.slice(),
  ...over,
})

describe('band layout', () => {
  it('has Poweramp’s ten octave-spaced bands', () => {
    expect(BAND_COUNT).toBe(10)
    expect([...EQ_BANDS]).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000])
  })

  it('every preset has one gain per band and stays in range', () => {
    for (const preset of EQ_PRESETS) {
      expect(preset.gains, preset.id).toHaveLength(BAND_COUNT)
      for (const g of preset.gains) {
        expect(g).toBeGreaterThanOrEqual(GAIN_MIN)
        expect(g).toBeLessThanOrEqual(GAIN_MAX)
      }
    }
  })

  it('preset ids are unique', () => {
    const ids = EQ_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('peakingMagnitudeDb (RBJ cookbook)', () => {
  it('is exactly 0 dB for a 0 dB band', () => {
    expect(peakingMagnitudeDb(1000, 1000, BAND_Q, 0, SR)).toBe(0)
  })

  it('equals the requested gain at the centre frequency', () => {
    for (const gain of [-12, -6, -1, 3.5, 6, 12]) {
      const measured = peakingMagnitudeDb(1000, 1000, BAND_Q, gain, SR)
      expect(measured).toBeCloseTo(gain, 6)
    }
  })

  it('is symmetric in dB for ±gain (within 0.01 dB)', () => {
    const up = peakingMagnitudeDb(700, 1000, BAND_Q, 8, SR)
    const down = peakingMagnitudeDb(700, 1000, BAND_Q, -8, SR)
    expect(up + down).toBeCloseTo(0, 1)
  })

  it('leaves distant frequencies almost untouched', () => {
    const boost = peakingMagnitudeDb(31, 16000, BAND_Q, 12, SR)
    expect(Math.abs(boost)).toBeLessThan(0.1)
  })

  it('decays as we move away from the centre', () => {
    const atCentre = Math.abs(peakingMagnitudeDb(1000, 1000, BAND_Q, 9, SR))
    const nearby = Math.abs(peakingMagnitudeDb(1400, 1000, BAND_Q, 9, SR))
    const far = Math.abs(peakingMagnitudeDb(4000, 1000, BAND_Q, 9, SR))
    expect(atCentre).toBeGreaterThan(nearby)
    expect(nearby).toBeGreaterThan(far)
  })
})

describe('responseCurve', () => {
  it('is flat at preamp level when the EQ is bypassed', () => {
    const curve = responseCurve(eqWith({ enabled: false, preamp: -3 }), SR)
    expect(curve.every((db) => Math.abs(db + 3) < 1e-9)).toBe(true)
  })

  it('is 0 dB everywhere for an enabled flat curve', () => {
    const curve = responseCurve(eqWith(), SR)
    for (const db of curve) expect(Math.abs(db)).toBeLessThan(1e-9)
  })

  it('matches the preamp + band sum at the band centre', () => {
    const state = eqWith({ preamp: 2, gains: [0, 0, 0, 0, 0, 6, 0, 0, 0, 0] })
    const grid = [1000]
    const [db] = responseCurve(state, SR, grid)
    expect(db).toBeCloseTo(8, 4) // 6 dB band + 2 dB preamp
  })

  it('produces the documented grid size', () => {
    expect(frequencyGrid()).toHaveLength(240)
    const grid = frequencyGrid(240)
    expect(grid[0]).toBeCloseTo(20, 6)
    expect(grid[grid.length - 1]).toBeCloseTo(20000, 3)
    for (let i = 1; i < grid.length; i++) expect(grid[i]).toBeGreaterThan(grid[i - 1])
  })
})

describe('state transitions', () => {
  it('dragging a band clamps to ±12 dB and switches to custom', () => {
    let state = eqWith()
    state = setBandGain(state, 3, 40)
    expect(state.gains[3]).toBe(GAIN_MAX)
    expect(state.presetId).toBe('custom')

    state = setBandGain(state, 3, -40)
    expect(state.gains[3]).toBe(GAIN_MIN)
  })

  it('ignores out-of-range band indexes', () => {
    const state = eqWith()
    expect(setBandGain(state, 99, 6)).toBe(state)
    expect(setBandGain(state, -1, 6)).toBe(state)
  })

  it('does not mutate the previous state object', () => {
    const before = eqWith()
    const after = setBandGain(before, 0, 6)
    expect(before.gains[0]).toBe(0)
    expect(after.gains[0]).toBe(6)
    expect(after.gains).not.toBe(before.gains)
  })

  it('re-detects the preset after a band returns to a preset value', () => {
    const rock = eqWith({ ...applyPreset(DEFAULT_EQ, 'rock') })
    let state = setBandGain(rock, 0, 0)
    expect(state.presetId).toBe('custom')
    state = setBandGain(state, 0, rock.gains[0])
    expect(state.presetId).toBe('rock')
  })

  it('applyPreset copies gains instead of sharing the preset array', () => {
    const state = applyPreset(DEFAULT_EQ, 'jazz')
    expect(state.presetId).toBe('jazz')
    const mutated = setBandGain(state, 2, 9)
    expect(mutated.gains).not.toBe(state.gains)
    expect(EQ_PRESETS.find((p) => p.id === 'jazz')!.gains[2]).toBe(1.5)
  })

  it('applyPreset ignores unknown ids', () => {
    expect(applyPreset(DEFAULT_EQ, 'nope')).toBe(DEFAULT_EQ)
  })

  it('resetBand zeroes a single band only', () => {
    const state = resetBand(applyPreset(DEFAULT_EQ, 'pop'), 4)
    expect(state.gains[4]).toBe(0)
    expect(state.gains[3]).toBe(3)
  })

  it('setPreamp clamps and re-matches presets', () => {
    expect(setPreamp(DEFAULT_EQ, 99).preamp).toBe(12)
    expect(setPreamp(DEFAULT_EQ, -99).preamp).toBe(-12)
    const bass = applyPreset(DEFAULT_EQ, 'bass') // preamp -4
    expect(setPreamp(bass, 0).presetId).toBe('custom')
    expect(setPreamp(setPreamp(bass, 0), -4).presetId).toBe('bass')
  })

  it('matchPreset needs both gains and preamp to agree', () => {
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0)).toBe('flat')
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3)).toBeNull()
  })

  it('isFlat only cares about the bands', () => {
    expect(isFlat(DEFAULT_EQ)).toBe(true)
    expect(isFlat(eqWith({ gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }))).toBe(false)
  })
})

describe('headroom', () => {
  it('peakBoostDb follows the curve', () => {
    const state = eqWith({ preamp: 0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    expect(peakBoostDb(state, SR)).toBeLessThan(0.01)
    const boosted = eqWith({ gains: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12] })
    expect(peakBoostDb(boosted, SR)).toBeGreaterThan(12)
  })

  it('suggestPreamp recovers headroom for the biggest boost', () => {
    for (const id of ['bass', 'vshape', 'dance', 'metal']) {
      const state = applyPreset(eqWith(), id)
      const suggested = suggestPreamp(state)
      const fixed = { ...state, preamp: suggested }
      expect(peakBoostDb(fixed, SR)).toBeLessThanOrEqual(0.35)
    }
  })
})

describe('parseEqState (untrusted storage)', () => {
  it('falls back to defaults on garbage', () => {
    for (const raw of [null, undefined, 42, 'nope', [], {}]) {
      const parsed = parseEqState(raw)
      expect(parsed.gains).toHaveLength(BAND_COUNT)
      expect(parsed.enabled).toBe(false)
    }
  })

  it('clamps out-of-range numbers and fills missing bands', () => {
    const parsed = parseEqState({ enabled: true, preamp: 99, gains: [99, -99, 'x'] })
    expect(parsed.enabled).toBe(true)
    expect(parsed.preamp).toBe(12)
    expect(parsed.gains[0]).toBe(12)
    expect(parsed.gains[1]).toBe(-12)
    expect(parsed.gains[2]).toBe(0)
    expect(parsed.gains).toHaveLength(BAND_COUNT)
  })

  it('drops NaN and Infinity', () => {
    const parsed = parseEqState({ gains: [NaN, Infinity, -Infinity] })
    expect(parsed.gains.slice(0, 3)).toEqual([0, 0, 0])
    expect(Number.isFinite(parsed.preamp)).toBe(true)
  })

  it('keeps the limiter on unless explicitly disabled', () => {
    expect(parseEqState({}).limiter).toBe(true)
    expect(parseEqState({ limiter: false }).limiter).toBe(false)
  })

  it('round-trips a real state', () => {
    const state = { ...applyPreset(DEFAULT_EQ, 'rock'), enabled: true }
    const parsed = parseEqState(JSON.parse(JSON.stringify(state)))
    expect(parsed).toEqual(state)
  })
})

describe('formatting', () => {
  it('formats gains with a real minus sign', () => {
    expect(formatGain(0)).toBe('0')
    expect(formatGain(3.5)).toBe('+3.5')
    expect(formatGain(-2)).toBe('−2')
  })

  it('formats band labels', () => {
    expect(formatBand(31)).toBe('31')
    expect(formatBand(1000)).toBe('1k')
    expect(formatBand(16000)).toBe('16k')
  })

  it('round1 keeps one decimal', () => {
    expect(round1(1.249)).toBe(1.2)
    expect(round1(1.25)).toBe(1.3)
  })
})
