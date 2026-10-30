import { mulberry32 } from '../audio/tracks'
import type { RepeatMode } from './playerPrefs'

/** Fisher–Yates with a seeded PRNG so a shuffle survives re-renders. */
export function shuffleOrder(ids: string[], firstId?: string | null, seed = 1): string[] {
  const rnd = mulberry32(seed)
  const arr = ids.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (firstId && arr.includes(firstId)) {
    const idx = arr.indexOf(firstId)
    arr.splice(idx, 1)
    arr.unshift(firstId)
  }
  return arr
}

/**
 * The next track, or null when playback should stop.
 * `auto` = the track ended by itself (respects repeat-one); manual skips never do.
 */
export function nextId(
  currentId: string | null,
  order: string[],
  repeat: RepeatMode,
  auto = false,
): string | null {
  if (order.length === 0) return null
  if (auto && repeat === 'one' && currentId) return currentId
  const idx = currentId ? order.indexOf(currentId) : -1
  if (idx === -1) return order[0]
  if (idx + 1 < order.length) return order[idx + 1]
  if (auto && repeat !== 'all') return null
  return order[0]
}

export function prevId(currentId: string | null, order: string[]): string | null {
  if (order.length === 0) return null
  const idx = currentId ? order.indexOf(currentId) : -1
  if (idx <= 0) return order[order.length - 1]
  return order[idx - 1]
}

/** Restart the track if we're past the 3s grace window, otherwise go back. */
export function shouldRestartOnPrev(position: number, threshold = 3): boolean {
  return position > threshold
}
