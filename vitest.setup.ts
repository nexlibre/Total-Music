import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/* ------------------------------------------------------------------ *
 * jsdom has no Web Audio, no canvas and no ResizeObserver. These stubs
 * follow the real interfaces closely enough that the production code paths
 * genuinely execute (graph building, filter tuning, canvas drawing) instead
 * of being skipped — so the tests exercise the code we ship.
 * ------------------------------------------------------------------ */

class ParamStub {
  value: number
  constructor(v = 0) { this.value = v }
  setValueAtTime = vi.fn((v: number) => { this.value = v; return this })
  linearRampToValueAtTime = vi.fn((v: number) => { this.value = v; return this })
  exponentialRampToValueAtTime = vi.fn((v: number) => { this.value = v; return this })
  setTargetAtTime = vi.fn((v: number) => { this.value = v; return this })
  cancelScheduledValues = vi.fn(() => this)
}

class NodeStub {
  connect(dest: unknown) { return dest }
  disconnect() {}
  addEventListener() {}
  removeEventListener() {}
}

class FakeContext {
  state = 'running'
  currentTime = 0
  sampleRate = 44100
  baseLatency = 0.01
  destination = new NodeStub()
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })

  createGain() { return Object.assign(new NodeStub(), { gain: new ParamStub(1) }) }
  createBiquadFilter() {
    return Object.assign(new NodeStub(), {
      type: 'peaking',
      frequency: new ParamStub(1000),
      Q: new ParamStub(1),
      gain: new ParamStub(0),
    })
  }
  createDynamicsCompressor() {
    return Object.assign(new NodeStub(), {
      threshold: new ParamStub(-24),
      knee: new ParamStub(30),
      ratio: new ParamStub(12),
      attack: new ParamStub(0.003),
      release: new ParamStub(0.25),
      reduction: 0,
    })
  }
  createAnalyser() {
    return Object.assign(new NodeStub(), {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 200
      }),
      getByteTimeDomainData: vi.fn(),
    })
  }
  createBufferSource() {
    return Object.assign(new NodeStub(), {
      buffer: null,
      onended: null,
      loop: false,
      playbackRate: new ParamStub(1),
      start: vi.fn(),
      stop: vi.fn(),
    })
  }
  createOscillator() {
    return Object.assign(new NodeStub(), {
      type: 'sine',
      frequency: new ParamStub(440),
      detune: new ParamStub(0),
      start: vi.fn(),
      stop: vi.fn(),
    })
  }
  createConvolver() { return Object.assign(new NodeStub(), { buffer: null, normalize: true }) }
  createStereoPanner() { return Object.assign(new NodeStub(), { pan: new ParamStub(0) }) }
  createDelay() { return Object.assign(new NodeStub(), { delayTime: new ParamStub(0) }) }
  createWaveShaper() { return Object.assign(new NodeStub(), { curve: null, oversample: 'none' }) }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: Math.max(1, channels) }, () => new Float32Array(Math.max(1, length)))
    return {
      numberOfChannels: Math.max(1, channels),
      length: Math.max(1, length),
      sampleRate,
      duration: Math.max(1, length) / sampleRate,
      getChannelData: (i: number) => data[Math.min(i, data.length - 1)],
      copyToChannel: vi.fn(),
    }
  }
}

class FakeAudioContext extends FakeContext {
  static instances: FakeAudioContext[] = []
  constructor(_opts?: unknown) {
    super()
    FakeAudioContext.instances.push(this)
  }
}

class FakeOfflineAudioContext extends FakeContext {
  numberOfChannels: number
  length: number
  constructor(channels: number, length: number, sampleRate: number) {
    super()
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
  }
  startRendering = vi.fn(async () => this.createBuffer(this.numberOfChannels, this.length, this.sampleRate))
}

/* ---------------------------- canvas ---------------------------- */
class GradientStub {
  addColorStop = vi.fn()
}
class CanvasRenderingContext2DStub {
  canvas: unknown
  fillStyle: unknown = '#000'
  strokeStyle: unknown = '#000'
  lineWidth = 1
  lineJoin = 'miter'
  globalAlpha = 1
  font = '10px sans-serif'
  constructor(canvas: unknown) { this.canvas = canvas }
  setTransform = vi.fn()
  clearRect = vi.fn()
  fillRect = vi.fn()
  strokeRect = vi.fn()
  beginPath = vi.fn()
  closePath = vi.fn()
  moveTo = vi.fn()
  lineTo = vi.fn()
  arc = vi.fn()
  quadraticCurveTo = vi.fn()
  roundRect = vi.fn()
  fill = vi.fn()
  stroke = vi.fn()
  fillText = vi.fn()
  save = vi.fn()
  restore = vi.fn()
  createLinearGradient = vi.fn(() => new GradientStub())
  createRadialGradient = vi.fn(() => new GradientStub())
}

const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  window.localStorage.clear()
  FakeAudioContext.instances = []

  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('webkitAudioContext', FakeAudioContext)
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type === '2d') {
      return new CanvasRenderingContext2DStub(this) as unknown as CanvasRenderingContext2D
    }
    return originalGetContext.call(this, type as '2d')
  } as typeof HTMLCanvasElement.prototype.getContext

  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 1
      }
    }
    vi.stubGlobal('PointerEvent', PointerEventPolyfill)
  }

  Element.prototype.setPointerCapture = function () {}
  Element.prototype.releasePointerCapture = function () {}
  Element.prototype.hasPointerCapture = function () { return false }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

export { FakeAudioContext, FakeOfflineAudioContext }
