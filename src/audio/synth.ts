/**
 * Offline synthesizer: NoteEvent[] -> AudioBuffer.
 *
 * Rendering offline (instead of scheduling oscillators live) buys us real
 * seeking, exact durations, waveform peaks for the scrubber, and a loop that
 * sounds identical every pass — which matters when you A/B an EQ curve.
 */
import { buildTrackEvents, midiToFreq, trackDuration, type NoteEvent, type Track, type Voice } from './tracks'

type Ctx = OfflineAudioContext

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

export function getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached
  const len = Math.floor(ctx.sampleRate * 2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseCache.set(ctx, buf)
  return buf
}

export function createImpulseResponse(ctx: BaseAudioContext, seconds = 2.2, decay = 2.6): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / len
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
    }
  }
  return buf
}

function envGain(ctx: Ctx, start: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain()
  const p = g.gain
  p.setValueAtTime(0.0001, start)
  p.linearRampToValueAtTime(peak, start + attack)
  if (hold > 0) p.setValueAtTime(peak, start + attack + hold)
  p.exponentialRampToValueAtTime(0.0001, start + attack + hold + release)
  return g
}

function playEvent(ctx: Ctx, ev: NoteEvent, out: AudioNode, reverb: GainNode, noise: AudioBuffer): void {
  const t = ev.time
  const v = ev.vel
  const dest = out
  const send = reverb

  switch (ev.voice as Voice) {
    case 'kick': {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const g = envGain(ctx, t, 0.002, 0.02, ev.dur, v * 0.9)
      osc.frequency.setValueAtTime(150, t)
      osc.frequency.exponentialRampToValueAtTime(44, t + 0.11)
      osc.connect(g).connect(dest)
      osc.start(t)
      osc.stop(t + 0.11 + ev.dur)
      break
    }
    case 'snare':
    case 'clap': {
      const src = ctx.createBufferSource()
      src.buffer = noise
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = ev.voice === 'clap' ? 900 : 1400
      const g = envGain(ctx, t, 0.001, ev.voice === 'clap' ? 0.01 : 0.005, ev.dur, v * 0.42)
      src.connect(hp).connect(g).connect(dest)
      g.connect(send)
      src.start(t, Math.random() * 1.2, Math.min(0.4, ev.dur + 0.15))
      if (ev.voice === 'snare') {
        const body = ctx.createOscillator()
        body.type = 'triangle'
        body.frequency.setValueAtTime(190, t)
        const bg = envGain(ctx, t, 0.001, 0.01, ev.dur * 0.5, v * 0.22)
        body.connect(bg).connect(dest)
        body.start(t)
        body.stop(t + ev.dur + 0.1)
      } else {
        // clap = three tight bursts
        for (const d of [0.006, 0.014]) {
          const s2 = ctx.createBufferSource()
          s2.buffer = noise
          const g2 = envGain(ctx, t + d, 0.001, 0.002, ev.dur * 0.6, v * 0.3)
          s2.connect(hp).connect(g2).connect(dest)
          s2.start(t + d, Math.random(), 0.12)
        }
      }
      break
    }
    case 'hat':
    case 'openhat': {
      const src = ctx.createBufferSource()
      src.buffer = noise
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 7200
      const decay = ev.voice === 'openhat' ? 0.22 : 0.045
      const g = envGain(ctx, t, 0.001, 0.002, decay, v * 0.2)
      const pan = ctx.createStereoPanner()
      pan.pan.value = 0.25
      src.connect(hp).connect(g).connect(pan).connect(dest)
      src.start(t, Math.random(), decay + 0.05)
      break
    }
    case 'bass': {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = midiToFreq(ev.midi)
      const sub = ctx.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = midiToFreq(ev.midi) / 2
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = 6
      lp.frequency.setValueAtTime(220 + v * 420, t)
      lp.frequency.exponentialRampToValueAtTime(180, t + ev.dur)
      const g = envGain(ctx, t, 0.006, ev.dur * 0.5, ev.dur * 0.6, v * 0.4)
      const subGain = ctx.createGain()
      subGain.gain.value = 0.35
      osc.connect(lp).connect(g)
      sub.connect(subGain).connect(g)
      g.connect(dest)
      osc.start(t)
      sub.start(t)
      osc.stop(t + ev.dur * 1.5)
      sub.stop(t + ev.dur * 1.5)
      break
    }
    case 'pad': {
      const g = ctx.createGain()
      const attack = 0.45
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(v * 0.13, t + attack)
      g.gain.setValueAtTime(v * 0.13, t + Math.max(attack, ev.dur - 0.6))
      g.gain.exponentialRampToValueAtTime(0.0001, t + ev.dur + 0.35)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1500
      lp.Q.value = 0.7
      g.connect(lp).connect(dest)
      g.connect(send)
      for (const det of [ev.detune ?? 0, -5, 7]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midiToFreq(ev.midi)
        o.detune.value = det
        o.connect(g)
        o.start(t)
        o.stop(t + ev.dur + 0.4)
      }
      break
    }
    case 'arp': {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = midiToFreq(ev.midi)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(4200, t)
      lp.frequency.exponentialRampToValueAtTime(900, t + ev.dur)
      const g = envGain(ctx, t, 0.004, 0.01, ev.dur * 0.9, v * 0.16)
      const pan = ctx.createStereoPanner()
      pan.pan.value = -0.2
      o.connect(lp).connect(g).connect(pan).connect(dest)
      g.connect(send)
      o.start(t)
      o.stop(t + ev.dur + 0.1)
      break
    }
    case 'lead': {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = midiToFreq(ev.midi)
      const vib = ctx.createOscillator()
      vib.frequency.value = 5.5
      const vibGain = ctx.createGain()
      vibGain.gain.value = 3
      vib.connect(vibGain).connect(o.detune)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2600
      const g = envGain(ctx, t, 0.02, ev.dur * 0.4, ev.dur * 0.9, v * 0.14)
      o.connect(lp).connect(g).connect(dest)
      g.connect(send)
      o.start(t)
      vib.start(t)
      o.stop(t + ev.dur * 1.4)
      vib.stop(t + ev.dur * 1.4)
      break
    }
    case 'bell': {
      const partials = [1, 2.01, 3.02]
      for (const [i, mult] of partials.entries()) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = midiToFreq(ev.midi) * mult
        const g = envGain(ctx, t, 0.004, 0.01, ev.dur * (1 - i * 0.22), (v * 0.2) / (i + 1))
        o.connect(g).connect(dest)
        g.connect(send)
        o.start(t)
        o.stop(t + ev.dur + 0.2)
      }
      break
    }
    case 'vinyl': {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2600
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 400
      const g = ctx.createGain()
      g.gain.value = v * 0.5
      src.connect(hp).connect(lp).connect(g).connect(dest)
      src.start(t, Math.random())
      src.stop(t + ev.dur)
      break
    }
  }
}

export interface RenderedTrack {
  buffer: AudioBuffer
  peaks: Float32Array
}

/** Downsample to N peaks in 0..1 for the scrubber. */
export function computePeaks(buffer: AudioBuffer, bins = 180): Float32Array {
  const out = new Float32Array(bins)
  const ch = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(ch.length / bins))
  for (let i = 0; i < bins; i++) {
    let peak = 0
    const start = i * step
    const end = Math.min(ch.length, start + step)
    for (let j = start; j < end; j++) {
      const abs = Math.abs(ch[j])
      if (abs > peak) peak = abs
    }
    out[i] = peak
  }
  const max = Math.max(...out, 0.0001)
  for (let i = 0; i < bins; i++) out[i] = out[i] / max
  return out
}

export async function renderTrack(track: Track, sampleRate = 44100): Promise<RenderedTrack> {
  const duration = trackDuration(track)
  const Offline = (globalThis as unknown as {
    OfflineAudioContext: typeof OfflineAudioContext
  }).OfflineAudioContext

  const ctx = new Offline(2, Math.ceil(duration * sampleRate), sampleRate)

  const master = ctx.createGain()
  master.gain.value = 0.72

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.004
  comp.release.value = 0.18

  const reverb = ctx.createConvolver()
  reverb.buffer = createImpulseResponse(ctx)
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = 0.36

  const bus = ctx.createGain()
  bus.connect(master)
  master.connect(comp)
  comp.connect(ctx.destination)
  bus.connect(reverb)
  reverb.connect(reverbGain).connect(comp)

  const events = buildTrackEvents(track)
  const noise = getNoiseBuffer(ctx)
  for (const ev of events) playEvent(ctx, ev, bus, reverbGain, noise)

  // gentle fade in/out so loops don't click
  const fade = ctx.createGain()
  fade.gain.setValueAtTime(0.0001, 0)
  fade.gain.linearRampToValueAtTime(1, 0.06)
  fade.gain.setValueAtTime(1, duration - 0.25)
  fade.gain.linearRampToValueAtTime(0.0001, duration)
  bus.disconnect()
  bus.connect(fade)
  bus.connect(reverb)
  fade.connect(master)

  const buffer = await ctx.startRendering()
  return { buffer, peaks: computePeaks(buffer) }
}
