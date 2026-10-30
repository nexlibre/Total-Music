import { beforeEach, describe, expect, it } from 'vitest'
import {
  EMPTY_FAVORITES,
  FAVORITES_KEY,
  addFavorite,
  favoriteCount,
  favoritesStore,
  intersectLibrary,
  isFavorite,
  orderedFavorites,
  removeFavorite,
  sanitizeFavorites,
  setFavorite,
  toggleFavorite,
  toggleFavoriteTrack,
} from '../src/state/favorites'

const lib = ['a', 'b', 'c', 'd']

beforeEach(() => {
  favoritesStore.reset()
})

describe('pure favorite operations', () => {
  it('starts empty', () => {
    expect(EMPTY_FAVORITES).toEqual({ ids: [] })
    expect(favoriteCount(EMPTY_FAVORITES)).toBe(0)
  })

  it('toggles on and off', () => {
    const on = toggleFavorite(EMPTY_FAVORITES, 'a')
    expect(isFavorite(on, 'a')).toBe(true)
    expect(on.ids).toEqual(['a'])

    const off = toggleFavorite(on, 'a')
    expect(isFavorite(off, 'a')).toBe(false)
    expect(off.ids).toEqual([])
  })

  it('keeps the newest favorite first', () => {
    const state = toggleFavorite(toggleFavorite(toggleFavorite(EMPTY_FAVORITES, 'a'), 'b'), 'c')
    expect(state.ids).toEqual(['c', 'b', 'a'])
  })

  it('never duplicates an id', () => {
    const state = addFavorite(addFavorite(EMPTY_FAVORITES, 'x'), 'x')
    expect(state.ids).toEqual(['x'])
  })

  it('removeFavorite is a no-op when absent (same object)', () => {
    const state = addFavorite(EMPTY_FAVORITES, 'a')
    expect(removeFavorite(state, 'zzz')).toBe(state)
  })

  it('addFavorite on an existing id returns the same object', () => {
    const state = addFavorite(EMPTY_FAVORITES, 'a')
    expect(addFavorite(state, 'a')).toBe(state)
  })

  it('ignores empty ids', () => {
    expect(toggleFavorite(EMPTY_FAVORITES, '')).toBe(EMPTY_FAVORITES)
    expect(addFavorite(EMPTY_FAVORITES, '')).toBe(EMPTY_FAVORITES)
  })

  it('does not mutate the input state', () => {
    const state = addFavorite(EMPTY_FAVORITES, 'a')
    toggleFavorite(state, 'b')
    expect(state.ids).toEqual(['a'])
    expect(EMPTY_FAVORITES.ids).toEqual([])
  })
})

describe('sanitizeFavorites', () => {
  it('survives corrupted payloads', () => {
    expect(sanitizeFavorites(null).ids).toEqual([])
    expect(sanitizeFavorites('x').ids).toEqual([])
    expect(sanitizeFavorites({ ids: 'nope' }).ids).toEqual([])
    expect(sanitizeFavorites({}).ids).toEqual([])
  })

  it('drops non-string and empty entries', () => {
    expect(sanitizeFavorites({ ids: [1, null, '', 'a', {}, 'b'] }).ids).toEqual(['a', 'b'])
  })

  it('deduplicates while preserving order', () => {
    expect(sanitizeFavorites({ ids: ['b', 'a', 'b', 'c', 'a'] }).ids).toEqual(['b', 'a', 'c'])
  })
})

describe('favorites ↔ library helpers', () => {
  it('orders favorites like the library', () => {
    const state = toggleFavorite(toggleFavorite(EMPTY_FAVORITES, 'c'), 'a')
    expect(orderedFavorites(state, lib)).toEqual(['a', 'c'])
  })

  it('ignores ids that left the library', () => {
    const state = toggleFavorite(EMPTY_FAVORITES, 'ghost')
    expect(intersectLibrary(state, lib)).toEqual([])
    expect(orderedFavorites(state, lib)).toEqual([])
  })
})

describe('favoritesStore persistence', () => {
  it('persists to localStorage on every change', () => {
    toggleFavoriteTrack('b')
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!).ids).toEqual(['b'])

    toggleFavoriteTrack('a')
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!).ids).toEqual(['a', 'b'])

    toggleFavoriteTrack('a')
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!).ids).toEqual(['b'])
  })

  it('notifies subscribers exactly once per change', () => {
    let calls = 0
    const unsub = favoritesStore.subscribe(() => calls++)
    toggleFavoriteTrack('a')
    toggleFavoriteTrack('b')
    expect(calls).toBe(2)
    unsub()
    toggleFavoriteTrack('c')
    expect(calls).toBe(2)
  })

  it('restores state written by a previous session', () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ ids: ['golden-hour', 'neon-horizon'] }))
    // simulate a fresh page load
    const fresh = JSON.parse(localStorage.getItem(FAVORITES_KEY)!)
    expect(sanitizeFavorites(fresh).ids).toEqual(['golden-hour', 'neon-horizon'])
  })

  it('ignores malformed stored values instead of throwing', () => {
    localStorage.setItem(FAVORITES_KEY, '{not json')
    expect(() => sanitizeFavorites(undefined)).not.toThrow()
  })

  it('setFavorite(true/false) is idempotent', () => {
    setFavorite('a', true)
    setFavorite('a', true)
    expect(favoritesStore.get().ids).toEqual(['a'])
    setFavorite('a', false)
    setFavorite('a', false)
    expect(favoritesStore.get().ids).toEqual([])
  })

  it('reset() clears both memory and storage', () => {
    toggleFavoriteTrack('a')
    favoritesStore.reset()
    expect(favoritesStore.get().ids).toEqual([])
    expect(localStorage.getItem(FAVORITES_KEY)).toBeNull()
  })
})
