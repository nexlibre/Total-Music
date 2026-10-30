import { describe, expect, it } from 'vitest'
import { nextId, prevId, shouldRestartOnPrev, shuffleOrder } from '../src/state/queue'
import { cycleRepeat, sanitizePrefs, DEFAULT_PREFS } from '../src/state/playerPrefs'

const order = ['a', 'b', 'c']

describe('nextId', () => {
  it('walks forward through the order', () => {
    expect(nextId('a', order, 'off')).toBe('b')
    expect(nextId('b', order, 'off')).toBe('c')
  })

  it('wraps on a manual skip at the end', () => {
    expect(nextId('c', order, 'off', false)).toBe('a')
  })

  it('stops at the end when the track ended by itself and repeat is off', () => {
    expect(nextId('c', order, 'off', true)).toBeNull()
  })

  it('wraps when repeat is all', () => {
    expect(nextId('c', order, 'all', true)).toBe('a')
  })

  it('repeats the same track when repeat is one (auto only)', () => {
    expect(nextId('b', order, 'one', true)).toBe('b')
    expect(nextId('b', order, 'one', false)).toBe('c')
  })

  it('starts from the top when nothing is playing', () => {
    expect(nextId(null, order, 'off', true)).toBe('a')
  })

  it('returns null for an empty queue', () => {
    expect(nextId('a', [], 'all', true)).toBeNull()
    expect(nextId(null, [], 'off', false)).toBeNull()
  })

  it('falls back to the first track if the current one is not in the queue', () => {
    expect(nextId('zzz', order, 'off')).toBe('a')
  })
})

describe('prevId', () => {
  it('walks backwards', () => {
    expect(prevId('c', order)).toBe('b')
    expect(prevId('a', order)).toBe('c')
  })

  it('handles empty queues', () => {
    expect(prevId(null, [])).toBeNull()
  })
})

describe('shouldRestartOnPrev', () => {
  it('restarts when past the grace window', () => {
    expect(shouldRestartOnPrev(3.5)).toBe(true)
    expect(shouldRestartOnPrev(2.9)).toBe(false)
    expect(shouldRestartOnPrev(5, 10)).toBe(false)
  })
})

describe('shuffleOrder', () => {
  const ids = ['1', '2', '3', '4', '5', '6', '7', '8']

  it('keeps every element exactly once', () => {
    const shuffled = shuffleOrder(ids, '3', 42)
    expect(shuffled).toHaveLength(ids.length)
    expect([...shuffled].sort()).toEqual([...ids].sort())
  })

  it('puts the requested first track at the top', () => {
    expect(shuffleOrder(ids, '5', 9)[0]).toBe('5')
  })

  it('is deterministic for a given seed', () => {
    expect(shuffleOrder(ids, '1', 7)).toEqual(shuffleOrder(ids, '1', 7))
    expect(shuffleOrder(ids, '1', 7)).not.toEqual(shuffleOrder(ids, '1', 8))
  })

  it('does not mutate the input', () => {
    const copy = ids.slice()
    shuffleOrder(ids, '2', 3)
    expect(ids).toEqual(copy)
  })
})

describe('player preferences', () => {
  it('cycles repeat modes', () => {
    expect(cycleRepeat('off')).toBe('all')
    expect(cycleRepeat('all')).toBe('one')
    expect(cycleRepeat('one')).toBe('off')
  })

  it('sanitizes stored preferences', () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(sanitizePrefs({ volume: 5 }).volume).toBe(1)
    expect(sanitizePrefs({ volume: -3 }).volume).toBe(0)
    expect(sanitizePrefs({ volume: NaN }).volume).toBe(DEFAULT_PREFS.volume)
    expect(sanitizePrefs({ repeat: 'bogus' }).repeat).toBe('off')
    expect(sanitizePrefs({ repeat: 'one' }).repeat).toBe('one')
    expect(sanitizePrefs({ shuffle: 'yes' }).shuffle).toBe(false)
    expect(sanitizePrefs({ view: 'liked' }).view).toBe('liked')
    expect(sanitizePrefs({ lastTrackId: 42 }).lastTrackId).toBeNull()
  })
})
