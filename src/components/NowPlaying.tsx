import { useEffect, useRef } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { trackDuration } from '../audio/tracks'
import { CoverArt } from './CoverArt'
import { FavoriteButton } from './FavoriteButton'
import { Scrubber } from './Scrubber'
import { Visualizer } from './Visualizer'
import {
  CloseIcon,
  EqIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  onOpenEq: () => void
}

export function NowPlaying({ open, onClose, onOpenEq }: Props) {
  const player = usePlayer()
  const closeRef = useRef<HTMLButtonElement>(null)
  const track = player.current

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'BUTTON') return
        e.preventDefault()
        player.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose, player])

  if (!open || !track) return null

  return (
    <div className="now" role="dialog" aria-modal="true" aria-labelledby="now-title" data-testid="now-playing">
      <div
        className="now__glow"
        style={{ background: `radial-gradient(80% 60% at 50% 0%, ${track.art[0]}55, transparent 70%)` }}
      />
      <header className="now__head">
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Cerrar pantalla de reproducción"
          ref={closeRef}
          data-testid="now-close"
        >
          <CloseIcon size={20} />
        </button>
        <p className="eyebrow">Reproduciendo ahora</p>
        <button type="button" className="icon-btn" onClick={onOpenEq} aria-label="Abrir ecualizador">
          <EqIcon size={19} />
        </button>
      </header>

      <div className="now__body">
        <CoverArt track={track} size={264} rounded={24} className="now__cover" showDisc />

        <h1 className="now__title" id="now-title">
          {track.title}
        </h1>
        <p className="now__artist">{track.artist}</p>
        <p className="now__album">
          {track.album} · {track.year} · {track.tags.join(' / ')}
        </p>

        <Visualizer playing={player.isPlaying} height={86} bars={40} />

        <div className="now__scrub">
          <Scrubber
            position={player.position}
            duration={player.duration || trackDuration(track)}
            peaks={player.peaks}
            onSeek={player.seek}
            height={40}
          />
        </div>

        <div className="now__transport">
          <button
            type="button"
            className={`icon-btn ${player.shuffle ? 'is-on' : ''}`}
            onClick={player.toggleShuffle}
            aria-pressed={player.shuffle}
            aria-label="Aleatorio"
          >
            <ShuffleIcon size={20} />
          </button>
          <button type="button" className="icon-btn icon-btn--lg" onClick={player.prev} aria-label="Anterior">
            <PrevIcon size={26} />
          </button>
          <button
            type="button"
            className={`play-btn play-btn--lg ${player.isBuffering ? 'is-loading' : ''}`}
            onClick={player.toggle}
            aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}
            data-testid="now-play-toggle"
          >
            {player.isBuffering ? (
              <span className="spinner" aria-hidden="true" />
            ) : player.isPlaying ? (
              <PauseIcon size={28} />
            ) : (
              <PlayIcon size={28} />
            )}
          </button>
          <button type="button" className="icon-btn icon-btn--lg" onClick={player.next} aria-label="Siguiente">
            <NextIcon size={26} />
          </button>
          <button
            type="button"
            className={`icon-btn ${player.repeat !== 'off' ? 'is-on' : ''}`}
            onClick={player.cycleRepeatMode}
            aria-label={`Repetir: ${player.repeat === 'off' ? 'desactivado' : player.repeat === 'all' ? 'todo' : 'una'}`}
          >
            <RepeatIcon size={20} one={player.repeat === 'one'} />
          </button>
        </div>

        <div className="now__actions">
          <FavoriteButton trackId={track.id} title={track.title} size={22} large />
          <label className="volume volume--now">
            <VolumeIcon size={18} muted={player.volume === 0} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              aria-label="Volumen"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
