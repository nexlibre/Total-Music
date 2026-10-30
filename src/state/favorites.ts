/**
 * Favorites ("Liked") — the one piece of library state that must survive
 * reloads, tab switches and the back button.
 *
 * Order is newest-liked-first so the Liked list behaves like a real playlist.
 */
import { createStore, type ReadableStore } from './store'

export const FAVORITES_KEY = 'tm.favorites.v1'

export interface FavoritesState {
  /** newest first */
  ids: string[]
}

export const EMPTY_FAVORITES: FavoritesState = { ids: [] }

export function sanitizeFavorites(raw: unknown): FavoritesState {
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as { ids?: unknown }).ids)
      ? ((raw as { ids: unknown[] }).ids ?? [])
      : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of list) {
    if (typeof item !== 'string' || item.length === 0) continue
    if (seen.has(item)) continue
    seen.add(item)
    ids.push(item)
  }
  return { ids }
}

export function isFavorite(state: FavoritesState, id: string): boolean {
  return state.ids.includes(id)
}

export function toggleFavorite(state: FavoritesState, id: string): FavoritesState {
  if (!id) return state
  if (state.ids.includes(id)) {
    return { ids: state.ids.filter((x) => x !== id) }
  }
  return { ids: [id, ...state.ids] }
}

export function addFavorite(state: FavoritesState, id: string): FavoritesState {
  if (!id || state.ids.includes(id)) return state
  return { ids: [id, ...state.ids] }
}

export function removeFavorite(state: FavoritesState, id: string): FavoritesState {
  if (!state.ids.includes(id)) return state
  return { ids: state.ids.filter((x) => x !== id) }
}

export function favoriteCount(state: FavoritesState): number {
  return state.ids.length
}

/** Keep only ids that still exist in the library (tracks can be removed). */
export function intersectLibrary(state: FavoritesState, libraryIds: string[]): string[] {
  const known = new Set(libraryIds)
  return state.ids.filter((id) => known.has(id))
}

/** Favorites ordered like the library, used inside the Liked tab. */
export function orderedFavorites(state: FavoritesState, libraryIds: string[]): string[] {
  const favs = new Set(state.ids)
  return libraryIds.filter((id) => favs.has(id))
}

export const favoritesStore: ReadableStore<FavoritesState> = createStore<FavoritesState>(
  FAVORITES_KEY,
  EMPTY_FAVORITES,
  sanitizeFavorites,
)

export const toggleFavoriteTrack = (id: string) =>
  favoritesStore.set((prev) => toggleFavorite(prev, id))
export const setFavorite = (id: string, value: boolean) =>
  favoritesStore.set((prev) => (value ? addFavorite(prev, id) : removeFavorite(prev, id)))
