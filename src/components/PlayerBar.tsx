import { usePlayer } from '../player/PlayerProvider'
import { useStore } from '../state/useStore'
import { eqStore } from '../state/eqStore'
import { getPreset } from '../audio/eq'
import { CoverArt } from './CoverArt'
import { FavoriteButton } from './FavoriteButton'
import { Scrubber } from './Scrubber'
import {
  ChevronDownIcon,
  EqIcon,
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons'

interface Props {
  onOpenEq: () => void
  onExpand: () => void
}

export function PlayerBar({ onOpenEq, onExpand }: Props) {
  const player = usePlayer()
  const eq = useStore(eqStore)
  const preset = getPreset(eq.presetId)
  const { current } = player

  return (
    <div className="playerbar" role="region" aria-label="Reproductor">
      <div className="playerbar__left">
      <button
        type="button"
        className="playerbar__track"
        onClick={onExpand}
        disabled={!current}
        aria-label={current ? `Abrir «${current.title}» en pantalla completa` : 'Sin pista seleccionada'}
      >
        {current ? (
          <>
            <CoverArt track={current} size={46} rounded={10} showDisc />
            <span className="playerbar__meta">
              <span className="playerbar__title">{current.title}</span>
              <span className="playerbar__artist">{current.artist}</span>
            </span>
          </>
        ) : (
          <>
            <span className="playerbar__coverPlaceholder">
              <HeartIcon size={18} />
            </span>
            <span className="playerbar__meta">
              <span className="playerbar__title">Nada sonando</span>
              <span className="playerbar__artist">Elige una pista de tu biblioteca</span>
            </span>
          </>
        )}
      </button>

      {current && <FavoriteButton trackId={current.id} title={current.title} size={19} />}
      </div>

      <div className="playerbar__center">
        <div className="transport">
          <button
            type="button"
            className={`icon-btn ${player.shuffle ? 'is-on' : ''}`}
            onClick={player.toggleShuffle}
            aria-pressed={player.shuffle}
            aria-label="Aleatorio"
            title="Aleatorio"
          >
            <ShuffleIcon size={17} />
          </button>
          <button type="button" className="icon-btn" onClick={player.prev} aria-label="Anterior" disabled={!current}>
            <PrevIcon size={19} />
          </button>
          <button
            type="button"
            className={`play-btn ${player.isBuffering ? 'is-loading' : ''}`}
            onClick={player.toggle}
            aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}
            data-testid="play-toggle"
          >
            {player.isBuffering ? (
              <span className="spinner" aria-hidden="true" />
            ) : player.isPlaying ? (
              <PauseIcon size={20} />
            ) : (
              <PlayIcon size={20} />
            )}
          </button>
          <button type="button" className="icon-btn" onClick={player.next} aria-label="Siguiente" disabled={!current}>
            <NextIcon size={19} />
          </button>
          <button
            type="button"
            className={`icon-btn ${player.repeat !== 'off' ? 'is-on' : ''}`}
            onClick={player.cycleRepeatMode}
            aria-label={`Repetir: ${player.repeat === 'off' ? 'desactivado' : player.repeat === 'all' ? 'todo' : 'una'}`}
            title={`Repetir: ${player.repeat === 'off' ? 'no' : player.repeat === 'all' ? 'todo' : 'una'}`}
          >
            <RepeatIcon size={17} one={player.repeat === 'one'} />
          </button>
        </div>

        <Scrubber
          position={player.position}
          duration={player.duration}
          peaks={player.peaks}
          onSeek={player.seek}
          height={26}
        />
      </div>

      <div className="playerbar__right">
        <button
          type="button"
          className={`eq-btn ${eq.enabled ? 'is-on' : ''}`}
          onClick={onOpenEq}
          aria-label={`Abrir ecualizador (${eq.enabled ? preset?.name ?? 'personalizado' : 'bypass'})`}
          data-testid="open-eq"
        >
          <EqIcon size={17} />
          <span className="eq-btn__label">
            {eq.enabled ? (preset?.name ?? 'EQ') : 'EQ off'}
          </span>
        </button>

        <label className="volume">
          <VolumeIcon size={17} muted={player.volume === 0} />
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

        <button
          type="button"
          className="icon-btn"
          onClick={onExpand}
          aria-label="Abrir pantalla de reproducción"
          disabled={!current}
        >
          <ChevronDownIcon size={18} className="icon-flip" />
        </button>
      </div>

      {player.error && (
        <p className="playerbar__error" role="alert">
          {player.error}
        </p>
      )}
    </div>
  )
}
