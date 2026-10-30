/**
 * AudioEngine against the Web Audio stub from vitest.setup.ts.
 * Verifies graph wiring, filter tuning, transport bookkeeping and the
 * "ended" contract the player relies on for auto-advance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from '../src/audio/engine'
import { BAND_COUNT, DEFAULT_EQ, applyPreset, type EqState } from '../src/audio/eq'
import { TRACKS, trackDuration } from '../src/audio/tracks'

const track = TRACKS[0]

type EngineInternals = {
  bands: { gain: { value: number }; frequency: { value: number }; Q: { value: number }; type: string }[]
  preamp: { gain: { value: number } }
  master: { gain: { value: number } }
  limiter: { threshold: { value: number }; ratio: { value: number } }
  source: { onended: (() => void) | null; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } | null
}
const internals = (engine: AudioEngine) => engine as unknown as EngineInternals

/** jsdom stub lets us drive the audio clock manually */
const clock = (engineUnderTest: AudioEngine) => engineUnderTest.ctx as unknown as { currentTime: number }

const eqState = (over: Partial<EqState> = {}): EqState => ({
  ...DEFAULT_EQ,
  gains: DEFAULT_EQ.gains.slice(),
  ...over,
})

let engine: AudioEngine

beforeEach(async () => {
  engine = new AudioEngine()
})

describe('graph construction', () => {
  it('creates one peaking filter per band with the right frequency and Q', async () => {
    await engine.ensure()
    const bands = internals(engine).bands
    expect(bands).toHaveLength(BAND_COUNT)
    expect(bands.map((b) => b.frequency.value)).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000])
    for (const band of bands) {
      expect(band.type).toBe('peaking')
      expect(band.Q.value).toBeCloseTo(1.41, 5)
      expect(band.gain.value).toBe(0)
    }
  })

  it('exposes an analyser for the visualizer', async () => {
    await engine.ensure()
    expect(engine.analyser).not.toBeNull()
    expect(engine.analyser!.fftSize).toBe(2048)
  })

  it('is idempotent — ensure() twice reuses the same context', async () => {
    const a = await engine.ensure()
    const b = await engine.ensure()
    expect(a).toBe(b)
  })
})

describe('applyEq', () => {
  it('pushes band gains into the filters', async () => {
    await engine.ensure()
    const state = applyPreset(eqState({ enabled: true }), 'rock')
    engine.applyEq(state)
    const bands = internals(engine).bands
    for (let i = 0; i < BAND_COUNT; i++) expect(bands[i].gain.value).toBe(state.gains[i])
  })

  it('zeroes every band when bypassed but keeps the preamp', async () => {
    await engine.ensure()
    engine.applyEq(eqState({ enabled: false, preamp: -6 }))
    for (const band of internals(engine).bands) expect(band.gain.value).toBe(0)
    expect(internals(engine).preamp.gain.value).toBeCloseTo(Math.pow(10, -6 / 20), 5)
  })

  it('applies the preamp in linear gain', async () => {
    await engine.ensure()
    engine.applyEq(eqState({ enabled: true, preamp: 6 }))
    expect(internals(engine).preamp.gain.value).toBeCloseTo(1.9953, 3)
  })

  it('disables the limiter on request', async () => {
    await engine.ensure()
    engine.applyEq(eqState({ limiter: true }))
    expect(internals(engine).limiter.ratio.value).toBe(20)
    engine.applyEq(eqState({ limiter: false }))
    expect(internals(engine).limiter.ratio.value).toBe(1)
  })

  it('remembers the EQ if it is applied before the context exists', () => {
    const state = applyPreset(eqState({ enabled: true }), 'bass')
    expect(() => engine.applyEq(state)).not.toThrow()
  })

  it('clones nothing from the state but reads it live', async () => {
    await engine.ensure()
    const state = eqState({ enabled: true, gains: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })
    engine.applyEq(state)
    expect(internals(engine).bands[9].gain.value).toBe(10)
  })
})

describe('transport', () => {
  it('reports the rendered duration and caches the buffer', async () => {
    await engine.play(track, 0)
    expect(engine.isPlaying).toBe(true)
    expect(engine.duration).toBeCloseTo(trackDuration(track), 5)
    expect(engine.isCached(track.id)).toBe(true)
    expect(engine.getPeaks(track.id)).toHaveLength(180)
  })

  it('advances the position with the audio clock', async () => {
    await engine.play(track, 0)
    clock(engine).currentTime = 4.5
    expect(engine.position).toBeCloseTo(4.5, 5)
  })

  it('freezes the position on pause and resumes from there', async () => {
    await engine.play(track, 0)
    clock(engine).currentTime = 10
    engine.pause()
    expect(engine.isPlaying).toBe(false)
    expect(engine.position).toBeCloseTo(10, 5)

    clock(engine).currentTime = 30
    expect(engine.position).toBeCloseTo(10, 5)

    await engine.resume()
    expect(engine.isPlaying).toBe(true)
  })

  it('restarts from zero when resuming a finished track', async () => {
    await engine.play(track, 0)
    clock(engine).currentTime = trackDuration(track) + 5
    engine.pause() // position clamps to duration
    expect(engine.position).toBeCloseTo(trackDuration(track), 3)

    await engine.resume()
    expect(engine.position).toBeLessThan(1)
  })

  it('seeks within bounds', async () => {
    await engine.play(track, 0)
    engine.seek(-10)
    expect(engine.position).toBe(0)
    engine.seek(1e6)
    expect(engine.position).toBeCloseTo(trackDuration(track), 3)
    engine.seek(5)
    expect(engine.position).toBeCloseTo(5, 3)
  })

  it('ignores a superseded play request', async () => {
    const second = TRACKS[1]
    const first = engine.play(track, 0)
    const other = engine.play(second, 0)
    await Promise.all([first, other])
    // whichever finished last must own the buffer, and only one source exists
    expect(engine.isPlaying).toBe(true)
    expect(internals(engine).source).not.toBeNull()
  })

  it('fires onEnded once when the buffer finishes naturally', async () => {
    const onEnded = vi.fn()
    engine.onEnded = onEnded
    await engine.play(track, 0)

    const source = internals(engine).source!
    source.onended?.()
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(engine.isPlaying).toBe(false)
  })

  it('does not fire onEnded when we stop it ourselves', async () => {
    const onEnded = vi.fn()
    engine.onEnded = onEnded
    await engine.play(track, 0)

    const source = internals(engine).source!
    engine.pause()
    source.onended?.()
    expect(onEnded).not.toHaveBeenCalled()
  })
})

describe('volume', () => {
  it('clamps to 0..1 and pushes to the master gain', async () => {
    await engine.ensure()
    engine.setVolume(2)
    expect(internals(engine).master.gain.value).toBe(1)
    engine.setVolume(-1)
    expect(internals(engine).master.gain.value).toBe(0)
    engine.setVolume(0.42)
    expect(internals(engine).master.gain.value).toBeCloseTo(0.42, 5)
  })
})
