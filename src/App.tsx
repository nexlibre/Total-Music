import { useEffect, useRef, useState } from 'react'
import { PlayerProvider, usePlayer } from './player/PlayerProvider'
import { Library } from './components/Library'
import { PlayerBar } from './components/PlayerBar'
import { Equalizer } from './components/eq/Equalizer'
import { NowPlaying } from './components/NowPlaying'
import { favoritesStore } from './state/favorites'
import { useStore } from './state/useStore'
import { playerPrefsStore, updatePrefs } from './state/playerPrefs'
import { HeartIcon, EqIcon, SparkIcon } from './components/Icons'
import { TRACKS } from './audio/tracks'

function Shell() {
  const player = usePlayer()
  const prefs = useStore(playerPrefsStore)
  const favorites = useStore(favoritesStore)
  const [eqOpen, setEqOpen] = useState(false)
  const [nowOpen, setNowOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const prevCount = useRef(favorites.ids.length)

  // favourite feedback
  useEffect(() => {
    const before = prevCount.current
    prevCount.current = favorites.ids.length
    if (favorites.ids.length > before) setToast('Añadido a Favoritos')
    else if (favorites.ids.length < before) setToast('Quitado de Favoritos')
  }, [favorites.ids.length])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  // global shortcuts (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      if (typing) return
      if (e.key === ' ' && target?.tagName !== 'BUTTON') {
        e.preventDefault()
        player.toggle()
      }
      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey) setEqOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail__brand">
          <span className="brand__mark">
            <SparkIcon size={18} />
          </span>
          <span className="brand__text">
            <span className="brand__name">Total Music</span>
            <span className="brand__ver">v1.8.3</span>
          </span>
        </div>

        <nav className="rail__nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`navbtn ${prefs.view === 'library' ? 'is-active' : ''}`}
            onClick={() => updatePrefs({ view: 'library' })}
          >
            <SparkIcon size={17} />
            Biblioteca
            <span className="navbtn__badge">{TRACKS.length}</span>
          </button>
          <button
            type="button"
            className={`navbtn ${prefs.view === 'liked' ? 'is-active' : ''}`}
            onClick={() => updatePrefs({ view: 'liked' })}
          >
            <HeartIcon size={17} filled={prefs.view === 'liked'} />
            Favoritos
            <span className="navbtn__badge" data-testid="rail-liked-count">
              {favorites.ids.length}
            </span>
          </button>
          <button type="button" className="navbtn" onClick={() => setEqOpen(true)}>
            <EqIcon size={17} />
            Ecualizador
          </button>
        </nav>

        <div className="rail__foot">
          <p className="rail__hint">
            <kbd>Espacio</kbd> reproducir · <kbd>E</kbd> ecualizador
          </p>
          <p className="rail__hint rail__hint--dim">
            Audio sintetizado en tiempo real · sin archivos ni servidor
          </p>
        </div>
      </aside>

      <main className="app__main">
        <header className="topbar">
          <span className="brand__mark">
            <SparkIcon size={16} />
          </span>
          <span className="brand__name">Total Music</span>
          <span className="brand__ver">v1.8.3</span>
        </header>
        <Library onOpenEq={() => setEqOpen(true)} />
      </main>

      <PlayerBar onOpenEq={() => setEqOpen(true)} onExpand={() => setNowOpen(true)} />

      <Equalizer open={eqOpen} onClose={() => setEqOpen(false)} />
      <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} onOpenEq={() => setEqOpen(true)} />

      {toast && (
        <div className="toast" role="status" aria-live="polite" data-testid="toast">
          <HeartIcon size={15} filled />
          {toast}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  )
}
