import { describe, expect, it } from 'vitest'
import {
  SCALES,
  TRACKS,
  buildTrackEvents,
  degreeToMidi,
  formatTime,
  getTrack,
  hashString,
  midiToFreq,
  mulberry32,
  trackDuration,
} from '../src/audio/tracks'
import { computePeaks } from '../src/audio/synth'

describe('library metadata', () => {
  it('has unique ids and sane tempos', () => {
    const ids = TRACKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TRACKS) {
      expect(t.bpm).toBeGreaterThan(50)
      expect(t.bpm).toBeLessThan(200)
      expect(t.bars).toBeGreaterThan(0)
      expect(trackDuration(t)).toBeGreaterThan(15)
      expect(getTrack(t.id)).toBe(t)
    }
  })

  it('returns undefined for unknown ids', () => {
    expect(getTrack('nope')).toBeUndefined()
    expect(getTrack(null)).toBeUndefined()
  })
})

describe('music theory helpers', () => {
  it('maps scale degrees across octaves', () => {
    expect(degreeToMidi(48, 'major', 0)).toBe(48)
    expect(degreeToMidi(48, 'major', 2)).toBe(52)
    expect(degreeToMidi(48, 'major', 7)).toBe(60) // one octave up
    expect(degreeToMidi(48, 'major', -1)).toBe(47)
  })

  it('has seven degrees in every scale', () => {
    for (const scale of Object.values(SCALES)) expect(scale).toHaveLength(7)
  })

  it('converts MIDI to frequency (A4 = 440)', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6)
    expect(midiToFreq(57)).toBeCloseTo(220, 6)
    expect(midiToFreq(81)).toBeCloseTo(880, 6)
  })
})

describe('deterministic PRNG', () => {
  it('repeats for the same seed and differs across seeds', () => {
    const a = Array.from({ length: 5 }, mulberry32(123))
    const b = Array.from({ length: 5 }, mulberry32(123))
    const c = Array.from({ length: 5 }, mulberry32(124))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('hashes strings consistently', () => {
    expect(hashString('neon-horizon')).toBe(hashString('neon-horizon'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})

describe('buildTrackEvents', () => {
  for (const track of TRACKS) {
    describe(track.title, () => {
      const events = buildTrackEvents(track)
      const duration = trackDuration(track)

      it('is deterministic', () => {
        expect(buildTrackEvents(track)).toEqual(events)
      })

      it('produces events sorted by time inside the track', () => {
        expect(events.length).toBeGreaterThan(50)
        for (let i = 1; i < events.length; i++) {
          expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time)
        }
        expect(events[0].time).toBeGreaterThanOrEqual(0)
        expect(events[events.length - 1].time).toBeLessThan(duration)
      })

      it('never emits NaN, negative durations or silent velocities', () => {
        for (const ev of events) {
          expect(Number.isFinite(ev.time)).toBe(true)
          expect(Number.isFinite(ev.dur)).toBe(true)
          expect(Number.isFinite(ev.midi)).toBe(true)
          expect(ev.dur).toBeGreaterThan(0)
          expect(ev.vel).toBeGreaterThan(0)
          expect(ev.vel).toBeLessThanOrEqual(1.0001)
          expect(ev.midi).toBeGreaterThanOrEqual(0)
          expect(ev.midi).toBeLessThan(128)
        }
      })

      it('includes a bass line and a pad', () => {
        expect(events.some((e) => e.voice === 'bass')).toBe(true)
        expect(events.some((e) => e.voice === 'pad')).toBe(true)
      })

      it('respects the drum recipe', () => {
        const hasDrums = events.some((e) => ['kick', 'snare', 'hat', 'clap'].includes(e.voice))
        expect(hasDrums).toBe(track.recipe.drums !== 'none')
      })

      it('only adds an arpeggio when the recipe asks for it', () => {
        const hasArp = events.some((e) => e.voice === 'arp')
        expect(hasArp).toBe(track.recipe.arp > 0)
      })
    })
  }
})

describe('computePeaks', () => {
  it('normalises to 0..1 with the requested number of bins', () => {
    const buffer = {
      length: 1000,
      getChannelData: () => {
        const data = new Float32Array(1000)
        for (let i = 0; i < 1000; i++) data[i] = Math.sin(i / 20)
        return data
      },
    } as unknown as AudioBuffer
    const peaks = computePeaks(buffer, 50)
    expect(peaks).toHaveLength(50)
    expect(Math.max(...peaks)).toBeCloseTo(1, 6)
    for (const p of peaks) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })
})

describe('formatTime', () => {
  it('formats mm:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(600)).toBe('10:00')
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(-4)).toBe('0:00')
  })
})
