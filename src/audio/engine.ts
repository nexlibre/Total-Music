/**
 * The live audio graph.
 *
 * source → preamp → bass shelf → treble shelf → 10 peaking bands → limiter
 *        → master volume → analyser → destination
 *
 * Filters are created once and re-tuned in place, so changing a band never
 * rebuilds the graph (no clicks, no lost playback position).
 */
import { BAND_Q, EQ_BANDS, clamp, effectivePreampDb, type EqState } from './eq'
import { renderTrack, type RenderedTrack } from './synth'
import type { Track } from './tracks'

type AnyCtx = AudioContext

export class AudioEngine {
  ctx: AnyCtx | null = null
  private preamp: GainNode | null = null
  private bassShelf: BiquadFilterNode | null = null
  private trebleShelf: BiquadFilterNode | null = null
  private bands: BiquadFilterNode[] = []
  private limiter: DynamicsCompressorNode | null = null
  private master: GainNode | null = null
  analyser: AnalyserNode | null = null

  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private offset = 0
  private playingFlag = false
  private stopRequested = false
  private volume = 0.8

  private requestId = 0
  private cache = new Map<string, RenderedTrack>()
  private pending = new Map<string, Promise<RenderedTrack>>()
  private lastEq: EqState | null = null

  onEnded: (() => void) | null = null

  /** Must be called from a user gesture (browser autoplay policy). */
  async ensure(): Promise<AnyCtx> {
    if (!this.ctx) {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) throw new Error('Web Audio no está disponible en este navegador.')
      const ctx = new Ctor({ latencyHint: 'playback' })
      this.ctx = ctx
      this.build(ctx)
      if (this.lastEq) this.applyEq(this.lastEq)
      this.setVolume(this.volume)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  private build(ctx: AnyCtx) {
    this.preamp = ctx.createGain()
    this.preamp.gain.value = 1

    this.bassShelf = ctx.createBiquadFilter()
    this.bassShelf.type = 'lowshelf'
    this.bassShelf.frequency.value = 180

    this.trebleShelf = ctx.createBiquadFilter()
    this.trebleShelf.type = 'highshelf'
    this.trebleShelf.frequency.value = 6000

    this.bands = EQ_BANDS.map((f) => {
      const node = ctx.createBiquadFilter()
      node.type = 'peaking'
      node.frequency.value = f
      node.Q.value = BAND_Q
      node.gain.value = 0
      return node
    })

    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -3
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.002
    this.limiter.release.value = 0.12

    this.master = ctx.createGain()
    this.master.gain.value = this.volume

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.82

    let node: AudioNode = this.preamp
    node.connect(this.bassShelf)
    node = this.bassShelf
    node.connect(this.trebleShelf)
    node = this.trebleShelf
    for (const band of this.bands) {
      node.connect(band)
      node = band
    }
    node.connect(this.limiter)
    this.limiter.connect(this.master)
    this.master.connect(this.analyser)
    this.analyser.connect(ctx.destination)
  }

  applyEq(state: EqState) {
    this.lastEq = state
    if (!this.ctx || !this.preamp) return
    const now = this.ctx.currentTime
    const pre = Math.pow(10, effectivePreampDb(state) / 20)
    this.preamp.gain.setTargetAtTime(pre, now, 0.02)
    if (this.bassShelf) this.bassShelf.gain.setTargetAtTime(state.enabled ? state.tone.bass : 0, now, 0.02)
    if (this.trebleShelf) this.trebleShelf.gain.setTargetAtTime(state.enabled ? state.tone.treble : 0, now, 0.02)
    for (let i = 0; i < this.bands.length; i++) {
      const gain = state.enabled ? clamp(state.gains[i] ?? 0, -24, 24) : 0
      this.bands[i].gain.setTargetAtTime(gain, now, 0.02)
    }
    if (this.limiter) {
      this.limiter.threshold.setTargetAtTime(state.limiter ? -3 : 0, now, 0.02)
      this.limiter.ratio.setTargetAtTime(state.limiter ? 20 : 1, now, 0.02)
    }
  }

  setVolume(v: number) {
    this.volume = clamp(v, 0, 1)
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
  }

  async prepare(track: Track): Promise<RenderedTrack> {
    const hit = this.cache.get(track.id)
    if (hit) return hit
    const inflight = this.pending.get(track.id)
    if (inflight) return inflight
    const job = renderTrack(track, this.ctx?.sampleRate ?? 44100).then((rendered) => {
      this.cache.set(track.id, rendered)
      this.pending.delete(track.id)
      return rendered
    })
    this.pending.set(track.id, job)
    return job
  }

  isCached(id: string) {
    return this.cache.has(id)
  }

  getPeaks(id: string): Float32Array | null {
    return this.cache.get(id)?.peaks ?? null
  }

  get duration(): number {
    return this.currentBuffer?.duration ?? 0
  }

  private currentBuffer: AudioBuffer | null = null
  private currentId: string | null = null

  async play(track: Track, offset = 0): Promise<void> {
    const ctx = await this.ensure()
    const request = ++this.requestId
    const rendered = await this.prepare(track)
    // A newer play() superseded us while we were rendering: drop this one.
    if (request !== this.requestId) return
    this.currentTrack = track
    this.stopSource()
    this.currentBuffer = rendered.buffer
    this.currentId = track.id
    const src = ctx.createBufferSource()
    src.buffer = rendered.buffer
    src.connect(this.preamp!)
    src.onended = () => {
      if (this.stopRequested) return
      if (!this.playingFlag) return
      this.playingFlag = false
      this.offset = rendered.buffer.duration
      this.onEnded?.()
    }
    const start = clamp(offset, 0, Math.max(0, rendered.buffer.duration - 0.02))
    src.start(0, start)
    this.source = src
    this.startedAt = ctx.currentTime - start
    this.offset = start
    this.playingFlag = true
    this.stopRequested = false
  }

  private stopSource() {
    if (this.source) {
      this.stopRequested = true
      try {
        this.source.onended = null
        this.source.stop()
      } catch {
        /* already stopped */
      }
      this.source.disconnect()
      this.source = null
    }
  }

  pause() {
    if (!this.playingFlag) return
    this.offset = this.position
    this.playingFlag = false
    this.stopSource()
  }

  async resume(): Promise<void> {
    if (!this.ctx || !this.currentBuffer || !this.currentId) return
    if (this.playingFlag) return
    const track = this.currentTrack
    if (!track) return
    // Pressing play on a finished track starts it over instead of playing 20 ms.
    const from = this.offset >= this.duration - 0.25 ? 0 : this.offset
    await this.play(track, from)
  }

  currentTrack: Track | null = null

  stop() {
    this.requestId++
    this.stopSource()
    this.playingFlag = false
    this.offset = 0
    this.currentBuffer = null
  }

  get isPlaying() {
    return this.playingFlag
  }

  get position(): number {
    if (!this.ctx) return this.offset
    if (!this.playingFlag) return this.offset
    return Math.min(this.ctx.currentTime - this.startedAt, this.duration)
  }

  seek(seconds: number) {
    const track = this.currentTrack
    const target = clamp(seconds, 0, Math.max(0, this.duration))
    const wasPlaying = this.playingFlag
    this.stopSource()
    this.playingFlag = false
    this.offset = target
    if (wasPlaying && track && this.currentBuffer) {
      void this.play(track, target)
    } else if (this.ctx) {
      this.startedAt = this.ctx.currentTime - target
    }
  }

  getSpectrum(target: Uint8Array): Uint8Array {
    if (!this.analyser) return target.fill(0)
    this.analyser.getByteFrequencyData(target as unknown as Uint8Array<ArrayBuffer>)
    return target
  }

  get latency(): number {
    return (this.ctx as unknown as { baseLatency?: number })?.baseLatency ?? 0
  }

  async dispose() {
    this.stopSource()
    this.playingFlag = false
    if (this.ctx) {
      try {
        await this.ctx.close()
      } catch {
        /* ignore */
      }
      this.ctx = null
    }
    this.bands = []
  }
}
