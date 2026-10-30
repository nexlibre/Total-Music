/**
 * Library metadata + deterministic musical event generation.
 *
 * Total Music ships no audio binaries: each demo track is described as a
 * recipe and rendered offline into an AudioBuffer by `synth.ts`. Same seed →
 * same song, so tests and the visualizer are reproducible.
 */

export type Voice =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'bass'
  | 'pad'
  | 'arp'
  | 'lead'
  | 'bell'
  | 'vinyl'

export interface NoteEvent {
  /** seconds from track start */
  time: number
  /** seconds */
  dur: number
  voice: Voice
  /** MIDI note number */
  midi: number
  /** 0..1 */
  vel: number
  /** detune in cents, for pads/stabs */
  detune?: number
}

export type ScaleName = 'minor' | 'dorian' | 'major' | 'phrygian' | 'lydian'

export interface Recipe {
  /** MIDI note of the tonic, e.g. 45 = A2 */
  root: number
  scale: ScaleName
  /** chord roots as scale degrees (0-indexed), one per bar, looping */
  progression: number[]
  /** seventh chords give pads more colour */
  sevenths: boolean
  drums: 'four' | 'break' | 'half' | 'trap' | 'none'
  /** arpeggio subdivision in 16ths: 1 = off, 2 = 8ths, 4 = 16ths */
  arp: 0 | 2 | 4
  arpPattern: 'up' | 'updown' | 'pedal'
  /** 0 = silent */
  padLevel: number
  leadLevel: number
  bellLevel: number
  swing: number
  /** vinyl / tape hiss layer */
  vinyl: number
}

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  year: number
  bpm: number
  bars: number
  tags: string[]
  /** two-stop gradient used for the cover art */
  art: [string, string]
  recipe: Recipe
}

export const SCALES: Record<ScaleName, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
}

export const TRACKS: Track[] = [
  {
    id: 'neon-horizon',
    title: 'Neon Horizon',
    artist: 'VHS Dreamer',
    album: 'Afterglow Drive',
    year: 2024,
    bpm: 112,
    bars: 16,
    tags: ['Synthwave', 'Retro'],
    art: ['#ff2e88', '#5b1bd6'],
    recipe: {
      root: 45,
      scale: 'minor',
      progression: [0, 5, 3, 4],
      sevenths: true,
      drums: 'four',
      arp: 4,
      arpPattern: 'updown',
      padLevel: 0.5,
      leadLevel: 0.32,
      bellLevel: 0.12,
      swing: 0,
      vinyl: 0,
    },
  },
  {
    id: 'midnight-drive',
    title: 'Midnight Drive',
    artist: 'Kilometre 88',
    album: 'Night Shift',
    year: 2023,
    bpm: 122,
    bars: 16,
    tags: ['Deep House', 'Electronic'],
    art: ['#00d4ff', '#0b2a6b'],
    recipe: {
      root: 41,
      scale: 'dorian',
      progression: [0, 0, 5, 4],
      sevenths: true,
      drums: 'four',
      arp: 2,
      arpPattern: 'pedal',
      padLevel: 0.62,
      leadLevel: 0.18,
      bellLevel: 0.1,
      swing: 0,
      vinyl: 0,
    },
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    artist: 'Mora & Tape',
    album: 'Slow Static',
    year: 2025,
    bpm: 82,
    bars: 12,
    tags: ['Lo-Fi', 'Chill'],
    art: ['#ffb347', '#b2456b'],
    recipe: {
      root: 43,
      scale: 'major',
      progression: [0, 4, 5, 2],
      sevenths: true,
      drums: 'half',
      arp: 2,
      arpPattern: 'up',
      padLevel: 0.55,
      leadLevel: 0.22,
      bellLevel: 0.2,
      swing: 0.16,
      vinyl: 0.05,
    },
  },
  {
    id: 'pulse-reactor',
    title: 'Pulse Reactor',
    artist: 'Node 7',
    album: 'Critical Mass',
    year: 2022,
    bpm: 134,
    bars: 16,
    tags: ['Techno', 'Peak Time'],
    art: ['#7cff4f', '#0a4d3c'],
    recipe: {
      root: 37,
      scale: 'phrygian',
      progression: [0, 0, 1, 0],
      sevenths: false,
      drums: 'trap',
      arp: 4,
      arpPattern: 'pedal',
      padLevel: 0.35,
      leadLevel: 0.28,
      bellLevel: 0,
      swing: 0,
      vinyl: 0,
    },
  },
  {
    id: 'soft-landing',
    title: 'Soft Landing',
    artist: 'Hana Ito',
    album: 'Paper Planes',
    year: 2021,
    bpm: 68,
    bars: 10,
    tags: ['Ambient', 'Piano'],
    art: ['#c9d6ff', '#6f5bd6'],
    recipe: {
      root: 48,
      scale: 'lydian',
      progression: [0, 3, 4, 5],
      sevenths: true,
      drums: 'none',
      arp: 0,
      arpPattern: 'up',
      padLevel: 0.6,
      leadLevel: 0.34,
      bellLevel: 0.26,
      swing: 0,
      vinyl: 0.03,
    },
  },
  {
    id: 'iron-bloom',
    title: 'Iron Bloom',
    artist: 'Cáncer Club',
    album: 'Fourth Floor',
    year: 2020,
    bpm: 96,
    bars: 14,
    tags: ['Alt Rock', 'Indie'],
    art: ['#ff6a3d', '#3a1020'],
    recipe: {
      root: 40,
      scale: 'minor',
      progression: [0, 4, 5, 4],
      sevenths: false,
      drums: 'break',
      arp: 2,
      arpPattern: 'up',
      padLevel: 0.3,
      leadLevel: 0.36,
      bellLevel: 0.08,
      swing: 0.05,
      vinyl: 0.02,
    },
  },
]

export function getTrack(id: string | null | undefined): Track | undefined {
  return TRACKS.find((t) => t.id === id)
}

export const TRACK_IDS = TRACKS.map((t) => t.id)

/** Deterministic 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const BEATS_PER_BAR = 4

export function trackDuration(track: Track): number {
  return (track.bars * BEATS_PER_BAR * 60) / track.bpm
}

/** Scale degree (may exceed 7 / go negative) → MIDI note. */
export function degreeToMidi(root: number, scale: ScaleName, degree: number): number {
  const steps = SCALES[scale]
  const octave = Math.floor(degree / steps.length)
  const idx = ((degree % steps.length) + steps.length) % steps.length
  return root + steps[idx] + octave * 12
}

export function chordMidi(root: number, scale: ScaleName, degree: number, sevenths: boolean): number[] {
  const tones = sevenths ? [0, 2, 4, 6] : [0, 2, 4, 6]
  return tones.map((t) => degreeToMidi(root, scale, degree + t))
}

/**
 * Turn a recipe into a flat, time-stamped note list. Pure and deterministic —
 * the renderer is just a synthesizer for this list.
 */
export function buildTrackEvents(track: Track): NoteEvent[] {
  const { recipe: r, bpm, bars } = track
  const rnd = mulberry32(hashString(track.id))
  const events: NoteEvent[] = []
  const spb = 60 / bpm
  const step = spb / 4 // 16th note
  const barLen = spb * BEATS_PER_BAR
  const swingOffset = (i: number) => (r.swing && i % 2 === 1 ? step * r.swing * 0.5 : 0)

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * barLen
    const degree = r.progression[bar % r.progression.length]

    // ---- drums
    for (let s = 0; s < 16; s++) {
      const t = barStart + s * step + swingOffset(s)
      const pos = s / 16
      if (r.drums === 'four') {
        if (s % 4 === 0) events.push({ time: t, dur: 0.3, voice: 'kick', midi: 36, vel: 1 })
        if (s === 4 || s === 12) events.push({ time: t, dur: 0.2, voice: 'snare', midi: 38, vel: 0.85 })
        if (s % 2 === 0) events.push({ time: t, dur: 0.05, voice: 'hat', midi: 42, vel: s % 4 === 2 ? 0.5 : 0.28 })
        if (s === 14 && bar % 4 === 3) events.push({ time: t, dur: 0.12, voice: 'openhat', midi: 46, vel: 0.45 })
      } else if (r.drums === 'break') {
        if (s === 0 || s === 10) events.push({ time: t, dur: 0.3, voice: 'kick', midi: 36, vel: 0.95 })
        if (s === 4 || s === 12) events.push({ time: t, dur: 0.22, voice: 'snare', midi: 38, vel: 0.8 })
        if (s === 7 && rnd() > 0.5) events.push({ time: t, dur: 0.15, voice: 'snare', midi: 38, vel: 0.35 })
        if (s % 2 === 0) events.push({ time: t, dur: 0.05, voice: 'hat', midi: 42, vel: 0.3 })
      } else if (r.drums === 'half') {
        if (s === 0 || s === 8) events.push({ time: t, dur: 0.3, voice: 'kick', midi: 36, vel: 0.9 })
        if (s === 8) events.push({ time: t, dur: 0.2, voice: 'snare', midi: 38, vel: 0.55 })
        if (s % 4 === 2) events.push({ time: t, dur: 0.06, voice: 'hat', midi: 42, vel: 0.24 })
      } else if (r.drums === 'trap') {
        if (s % 4 === 0) events.push({ time: t, dur: 0.28, voice: 'kick', midi: 36, vel: 1 })
        if (s === 8 || s === 11) events.push({ time: t, dur: 0.18, voice: 'clap', midi: 39, vel: 0.7 })
        if (s % 2 === 0) events.push({ time: t, dur: 0.04, voice: 'hat', midi: 42, vel: 0.22 + pos * 0.2 })
        if (bar % 2 === 1 && s >= 12) events.push({ time: t, dur: 0.04, voice: 'hat', midi: 42, vel: 0.18 })
      }
    }

    // ---- bass: root + fifth groove
    const bassRoot = degreeToMidi(r.root - 12, r.scale, degree)
    const bassPattern = [0, 3, 6, 8, 11, 14]
    for (let i = 0; i < bassPattern.length; i++) {
      const s = bassPattern[i]
      const t = barStart + s * step + swingOffset(s)
      const alt = i === 3 ? 7 : i === 5 ? 3 : 0
      events.push({
        time: t,
        dur: step * 1.6,
        voice: 'bass',
        midi: bassRoot + alt,
        vel: i === 0 ? 0.95 : 0.6,
      })
    }

    // ---- pad chord, held for the bar
    if (r.padLevel > 0) {
      const chord = chordMidi(r.root, r.scale, degree, r.sevenths)
      for (const [i, midi] of chord.entries()) {
        events.push({
          time: barStart,
          dur: barLen * 1.02,
          voice: 'pad',
          midi: midi + 12,
          vel: r.padLevel * (i === 0 ? 1 : 0.8),
          detune: (i % 2 === 0 ? 1 : -1) * 6,
        })
      }
    }

    // ---- arpeggio over chord tones
    if (r.arp > 0) {
      const chord = chordMidi(r.root, r.scale, degree, r.sevenths).map((n) => n + 12)
      const pattern =
        r.arpPattern === 'updown'
          ? [...chord, ...chord.slice(1, -1).reverse()]
          : r.arpPattern === 'pedal'
            ? chord.map((n, i) => (i % 2 === 0 ? chord[0] : n))
            : chord
      const count = (16 / r.arp) | 0
      for (let i = 0; i < count; i++) {
        const s = i * r.arp
        const t = barStart + s * step + swingOffset(s)
        const midi = pattern[i % pattern.length] + (i >= pattern.length ? 12 : 0)
        events.push({ time: t, dur: step * r.arp * 0.9, voice: 'arp', midi, vel: 0.34 + (i % 2 === 0 ? 0.12 : 0) })
      }
    }

    // ---- lead: seeded melody on bars 2..n, resting sometimes
    if (r.leadLevel > 0 && bar >= 1 && bar % 4 !== 3) {
      let deg = degree + 2
      for (let i = 0; i < 4; i++) {
        if (rnd() < 0.22) continue
        deg += Math.round((rnd() - 0.45) * 4)
        deg = Math.max(-2, Math.min(11, deg))
        const s = i * 4 + (rnd() < 0.3 ? 1 : 0)
        events.push({
          time: barStart + s * step + swingOffset(s),
          dur: step * (2 + Math.floor(rnd() * 3)),
          voice: 'lead',
          midi: degreeToMidi(r.root, r.scale, deg) + 12,
          vel: r.leadLevel * (0.8 + rnd() * 0.4),
        })
      }
    }

    // ---- bell accents at phrase ends
    if (r.bellLevel > 0 && bar % 8 === 7) {
      const chord = chordMidi(r.root, r.scale, degree, r.sevenths)
      events.push({ time: barStart, dur: barLen, voice: 'bell', midi: chord[2] + 24, vel: r.bellLevel })
    }

    // ---- vinyl bed
    if (r.vinyl > 0) {
      events.push({ time: barStart, dur: barLen, voice: 'vinyl', midi: 0, vel: r.vinyl })
    }
  }

  return events.sort((a, b) => a.time - b.time)
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
