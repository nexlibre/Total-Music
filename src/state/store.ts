/**
 * Tiny observable store with localStorage persistence.
 *
 * Every store is a singleton keyed by its storage key, so any module that
 * imports it sees the same state. React binds through `useStore` below
 * (useSyncExternalStore), and other tabs stay in sync via the `storage` event.
 */

export interface ReadableStore<T> {
  get(): T
  set(updater: T | ((prev: T) => T)): void
  subscribe(listener: () => void): () => void
  reset(): void
  key: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const registry = new Map<string, ReadableStore<unknown>>()

export function createStore<T>(
  key: string,
  initial: T,
  sanitize: (raw: unknown) => T,
  storage: StorageLike | null = safeStorage(),
): ReadableStore<T> {
  const existing = registry.get(key)
  if (existing) return existing as ReadableStore<T>

  const read = (): T => {
    if (!storage) return sanitize(initial)
    try {
      const raw = storage.getItem(key)
      if (raw === null) return sanitize(initial)
      return sanitize(JSON.parse(raw))
    } catch {
      return sanitize(initial)
    }
  }

  let state = read()
  const listeners = new Set<() => void>()

  const persist = (value: T) => {
    if (!storage) return
    try {
      storage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota / private mode — keep working in memory */
    }
  }

  const store: ReadableStore<T> = {
    key,
    get: () => state,
    set(updater) {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(state) : updater
      if (Object.is(next, state)) return
      state = next
      persist(state)
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reset() {
      state = sanitize(initial)
      if (storage) {
        try {
          storage.removeItem(key)
        } catch {
          /* ignore */
        }
      }
      listeners.forEach((l) => l())
    },
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key !== key) return
      state = read()
      listeners.forEach((l) => l())
    })
  }

  registry.set(key, store as ReadableStore<unknown>)
  return store
}

export function safeStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__tm_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

/** test helper — drop the singleton cache between suites */
export function __clearStoreRegistry() {
  registry.clear()
}
