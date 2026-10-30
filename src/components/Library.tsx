import { useMemo, useState } from 'react'
import { TRACKS, formatTime, trackDuration, type Track } from '../audio/tracks'
import { favoritesStore, orderedFavorites } from '../state/favorites'
import { useStore } from '../state/useStore'
import { playerPrefsStore, updatePrefs } from '../state/playerPrefs'
import { usePlayer } from '../player/PlayerProvider'
import { CoverArt } from './CoverArt'
import { FavoriteButton } from './FavoriteButton'
import { HeartIcon, PlayIcon, SearchIcon, EqIcon } from './Icons'

type SortKey = 'default' | 'title' | 'artist' | 'duration'

function sortTracks(list: Track[], key: SortKey): Track[] {
  if (key === 'default') return list
  const copy = list.slice()
  if (key === 'title') copy.sort((a, b) => a.title.localeCompare(b.title, 'es'))
  if (key === 'artist') copy.sort((a, b) => a.artist.localeCompare(b.artist, 'es'))
  if (key === 'duration') copy.sort((a, b) => trackDuration(a) - trackDuration(b))
  return copy
}

export function Library({ onOpenEq }: { onOpenEq: () => void }) {
  const player = usePlayer()
  const favorites = useStore(favoritesStore)
  const prefs = useStore(playerPrefsStore)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('default')

  const view = prefs.view
  const likedIds = orderedFavorites(favorites, TRACKS.map((t) => t.id))

  const visible = useMemo(() => {
    const base = view === 'liked' ? TRACKS.filter((t) => likedIds.includes(t.id)) : TRACKS
    const q = query.trim().toLowerCase()
    const filtered = q
      ? base.filter((t) =>
          [t.title, t.artist, t.album, ...t.tags].some((field) => field.toLowerCase().includes(q)),
        )
      : base
    return sortTracks(filtered, sort)
  }, [view, query, sort, likedIds])

  const visibleIds = visible.map((t) => t.id)
  const totalSeconds = visible.reduce((acc, t) => acc + trackDuration(t), 0)

  return (
    <section className="library" aria-labelledby="library-title">
      <div className="library__head">
        <div>
          <p className="eyebrow">Tu colección</p>
          <h1 id="library-title" className="library__title">
            {view === 'liked' ? 'Favoritos' : 'Biblioteca'}
          </h1>
          <p className="library__meta" data-testid="library-meta">
            {visible.length} {visible.length === 1 ? 'pista' : 'pistas'} · {formatTime(totalSeconds)}
          </p>
        </div>
        <div className="library__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => player.play(visibleIds[0], visibleIds)}
            disabled={visible.length === 0}
          >
            <PlayIcon size={16} />
            Reproducir todo
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpenEq}>
            <EqIcon size={16} />
            Ecualizador
          </button>
        </div>
      </div>

      <div className="library__toolbar">
        <div className="tabs" role="tablist" aria-label="Vista de biblioteca">
          <button
            role="tab"
            aria-selected={view === 'library'}
            className={`tab ${view === 'library' ? 'is-active' : ''}`}
            onClick={() => updatePrefs({ view: 'library' })}
            data-testid="tab-library"
          >
            Biblioteca
          </button>
          <button
            role="tab"
            aria-selected={view === 'liked'}
            className={`tab ${view === 'liked' ? 'is-active' : ''}`}
            onClick={() => updatePrefs({ view: 'liked' })}
            data-testid="tab-liked"
          >
            <HeartIcon size={14} filled={view === 'liked'} />
            Favoritos
            <span className="badge" data-testid="liked-count">
              {likedIds.length}
            </span>
          </button>
        </div>

        <div className="library__filters">
          <label className="search">
            <SearchIcon size={16} />
            <input
              type="search"
              placeholder="Buscar pista, artista, álbum…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar en la biblioteca"
              data-testid="search"
            />
          </label>
          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Ordenar por"
          >
            <option value="default">Orden original</option>
            <option value="title">Título (A–Z)</option>
            <option value="artist">Artista (A–Z)</option>
            <option value="duration">Duración</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty" data-testid="empty-state">
          <div className="empty__icon">
            <HeartIcon size={26} />
          </div>
          {view === 'liked' && !query ? (
            <>
              <h2>Todavía no hay favoritos</h2>
              <p>
                Toca el corazón de cualquier pista y aparecerá aquí, lista para sonar cuando quieras.
              </p>
              <button type="button" className="btn btn--ghost" onClick={() => updatePrefs({ view: 'library' })}>
                Explorar la biblioteca
              </button>
            </>
          ) : (
            <>
              <h2>Sin resultados</h2>
              <p>No encontramos nada para «{query}».</p>
              <button type="button" className="btn btn--ghost" onClick={() => setQuery('')}>
                Limpiar búsqueda
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="tracklist" data-testid="tracklist">
          {visible.map((track, i) => {
            const isCurrent = player.currentId === track.id
            const isPlaying = isCurrent && player.isPlaying
            return (
              <li key={track.id}>
                <div
                  className={`trackrow ${isCurrent ? 'is-current' : ''}`}
                  data-testid={`row-${track.id}`}
                  onClick={() => player.play(track.id, visibleIds)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Reproducir ${track.title} de ${track.artist}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      player.play(track.id, visibleIds)
                    }
                  }}
                >
                  <span className="trackrow__index">
                    {isPlaying ? (
                      <span className="playing-bars" aria-label="Sonando">
                        <i /> <i /> <i />
                      </span>
                    ) : (
                      <span className="trackrow__num">{String(i + 1).padStart(2, '0')}</span>
                    )}
                  </span>

                  <CoverArt track={track} size={48} rounded={10} />

                  <span className="trackrow__main">
                    <span className="trackrow__title">
                      {track.title}
                      {isCurrent && <span className="pill pill--live">{player.isPlaying ? 'Sonando' : 'En pausa'}</span>}
                    </span>
                    <span className="trackrow__sub">
                      {track.artist} · {track.album} · {track.year}
                    </span>
                  </span>

                  <span className="trackrow__tags">
                    {track.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </span>

                  <span className="trackrow__dur">{formatTime(trackDuration(track))}</span>

                  <FavoriteButton trackId={track.id} title={track.title} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
