import { createStore, type ReadableStore } from './store'
import { clamp } from '../audio/eq'

export type RepeatMode = 'off' | 'all' | 'one'

export interface PlayerPrefs {
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  /** last track that was playing, restored on reload (paused) */
  lastTrackId: string | null
  /** library filter: all tracks or only liked ones */
  view: 'library' | 'liked'
}

export const PLAYER_KEY = 'tm.player.v1'

export const DEFAULT_PREFS: PlayerPrefs = {
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  lastTrackId: null,
  view: 'library',
}

export function sanitizePrefs(raw: unknown): PlayerPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS }
  const o = raw as Record<string, unknown>
  const repeat: RepeatMode =
    o.repeat === 'all' || o.repeat === 'one' || o.repeat === 'off' ? o.repeat : 'off'
  const volume = typeof o.volume === 'number' && Number.isFinite(o.volume) ? clamp(o.volume, 0, 1) : DEFAULT_PREFS.volume
  return {
    volume,
    shuffle: o.shuffle === true,
    repeat,
    lastTrackId: typeof o.lastTrackId === 'string' ? o.lastTrackId : null,
    view: o.view === 'liked' ? 'liked' : 'library',
  }
}

export const playerPrefsStore: ReadableStore<PlayerPrefs> = createStore<PlayerPrefs>(
  PLAYER_KEY,
  DEFAULT_PREFS,
  sanitizePrefs,
)

export const updatePrefs = (patch: Partial<PlayerPrefs>) =>
  playerPrefsStore.set((prev) => ({ ...prev, ...patch }))

export const cycleRepeat = (mode: RepeatMode): RepeatMode =>
  mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'
