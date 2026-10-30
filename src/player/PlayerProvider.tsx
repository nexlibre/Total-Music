import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AudioEngine } from '../audio/engine'
import { getTrack, TRACK_IDS, trackDuration, type Track } from '../audio/tracks'
import { useStore } from '../state/useStore'
import { eqStore } from '../state/eqStore'
import { cycleRepeat, playerPrefsStore, updatePrefs, type RepeatMode } from '../state/playerPrefs'
import { nextId, prevId, shouldRestartOnPrev, shuffleOrder } from '../state/queue'

export const engine = new AudioEngine()

export interface PlayerApi {
  currentId: string | null
  current: Track | null
  isPlaying: boolean
  isBuffering: boolean
  position: number
  duration: number
  peaks: Float32Array | null
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  order: string[]
  error: string | null
  play: (id?: string, contextIds?: string[]) => void
  toggle: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
  stop: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const prefs = useStore(playerPrefsStore)
  const eq = useStore(eqStore)

  const [currentId, setCurrentId] = useState<string | null>(() => {
    const last = playerPrefsStore.get().lastTrackId
    return last && getTrack(last) ? last : null
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [contextIds, setContextIds] = useState<string[]>(TRACK_IDS)
  const [shuffleSeed, setShuffleSeed] = useState(7)

  const playToken = useRef(0)
  const current = getTrack(currentId)

  const order = useMemo(() => {
    const base = contextIds.length ? contextIds : TRACK_IDS
    return prefs.shuffle ? shuffleOrder(base, currentId, shuffleSeed) : base
  }, [contextIds, prefs.shuffle, currentId, shuffleSeed])

  // ------------------------------------------------------------- audio graph
  useEffect(() => {
    engine.applyEq(eq)
  }, [eq])

  useEffect(() => {
    engine.setVolume(prefs.volume)
  }, [prefs.volume])

  const startTrack = useCallback(
    async (id: string, offset = 0) => {
      const track = getTrack(id)
      if (!track) return
      const token = ++playToken.current
      setCurrentId(id)
      setError(null)
      setIsBuffering(!engine.isCached(id))
      engine.currentTrack = track
      try {
        await engine.play(track, offset)
        if (token !== playToken.current) return
        setIsPlaying(true)
        setPosition(offset)
        updatePrefs({ lastTrackId: id })
      } catch (err) {
        if (token !== playToken.current) return
        setIsPlaying(false)
        setError(err instanceof Error ? err.message : 'No se pudo reproducir esta pista.')
      } finally {
        if (token === playToken.current) setIsBuffering(false)
      }
    },
    [],
  )

  const handleEnded = useCallback(() => {
    const active = getTrack(engine.currentTrack?.id ?? null)
    if (!active) {
      setIsPlaying(false)
      return
    }
    const following = nextId(active.id, order, playerPrefsStore.get().repeat, true)
    if (!following) {
      setIsPlaying(false)
      setPosition(trackDuration(active))
      engine.pause()
      return
    }
    void startTrack(following, 0)
  }, [order, startTrack])

  useEffect(() => {
    engine.onEnded = handleEnded
    return () => {
      engine.onEnded = null
    }
  }, [handleEnded])

  // position ticker (~12 fps: smooth enough, cheap enough)
  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last > 80) {
        last = now
        setPosition(engine.position)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  const play = useCallback(
    (id?: string, ids?: string[]) => {
      if (ids && ids.length) setContextIds(ids)
      const target = id ?? currentId ?? (ids?.[0] ?? TRACK_IDS[0])
      if (!target) return
      if (target === currentId && engine.isPlaying) return
      const atEnd = engine.duration > 0 && engine.position >= engine.duration - 0.3
      if (target === currentId && !atEnd && engine.position > 0.3 && !engine.isPlaying) {
        engine.currentTrack = getTrack(target) ?? null
        engine.resume()
        setIsPlaying(true)
        return
      }
      void startTrack(target, 0)
    },
    [currentId, startTrack],
  )

  const pause = useCallback(() => {
    engine.pause()
    setIsPlaying(false)
    setPosition(engine.position)
  }, [])

  const toggle = useCallback(() => {
    if (engine.isPlaying) {
      pause()
      return
    }
    if (currentId) {
      play(currentId, contextIds)
    } else {
      play(order[0], contextIds)
    }
  }, [currentId, contextIds, order, pause, play])

  const next = useCallback(() => {
    const following = nextId(currentId, order, prefs.repeat, false)
    if (following) void startTrack(following, 0)
  }, [currentId, order, prefs.repeat, startTrack])

  const prev = useCallback(() => {
    if (shouldRestartOnPrev(engine.position)) {
      engine.seek(0)
      setPosition(0)
      return
    }
    const previous = prevId(currentId, order)
    if (previous) void startTrack(previous, 0)
  }, [currentId, order, startTrack])

  const seek = useCallback((seconds: number) => {
    engine.seek(seconds)
    setPosition(engine.position)
  }, [])

  const setVolume = useCallback((v: number) => {
    updatePrefs({ volume: v })
    engine.setVolume(v)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffleSeed((s) => s + 1)
    const nextVal = !playerPrefsStore.get().shuffle
    updatePrefs({ shuffle: nextVal })
  }, [])

  const cycleRepeatMode = useCallback(() => {
    updatePrefs({ repeat: cycleRepeat(playerPrefsStore.get().repeat) })
  }, [])

  const stop = useCallback(() => {
    engine.stop()
    setIsPlaying(false)
    setPosition(0)
  }, [])

  // --------------------------------------------------------- media session
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
      })
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
      navigator.mediaSession.setActionHandler('play', () => toggle())
      navigator.mediaSession.setActionHandler('pause', () => pause())
      navigator.mediaSession.setActionHandler('nexttrack', () => next())
      navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    } catch {
      /* MediaMetadata unavailable */
    }
  }, [current, isPlaying, toggle, pause, next, prev])

  const value: PlayerApi = {
    currentId,
    current: current ?? null,
    isPlaying,
    isBuffering,
    position,
    duration: current ? trackDuration(current) : 0,
    peaks: currentId ? engine.getPeaks(currentId) : null,
    volume: prefs.volume,
    shuffle: prefs.shuffle,
    repeat: prefs.repeat,
    order,
    error,
    play,
    toggle,
    pause,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
    stop,
  }

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>')
  return ctx
}
