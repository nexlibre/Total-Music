import { useCallback } from 'react'
import { HeartIcon } from './Icons'
import { favoritesStore } from '../state/favorites'
import { useStore } from '../state/useStore'
import { isFavorite, toggleFavoriteTrack } from '../state/favorites'

interface Props {
  trackId: string
  title: string
  size?: number
  className?: string
  /** big variant used in the now-playing panel */
  large?: boolean
}

export function FavoriteButton({ trackId, title, size = 18, className = '', large = false }: Props) {
  const favorites = useStore(favoritesStore)
  const liked = isFavorite(favorites, trackId)

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      toggleFavoriteTrack(trackId)
    },
    [trackId],
  )

  return (
    <button
      type="button"
      className={`icon-btn heart ${liked ? 'is-liked' : ''} ${large ? 'heart--large' : ''} ${className}`}
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? `Quitar «${title}» de favoritos` : `Añadir «${title}» a favoritos`}
      title={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      data-testid={`fav-${trackId}`}
    >
      <HeartIcon size={size} filled={liked} />
      <span className="sr-only">{liked ? 'En favoritos' : 'Sin favorito'}</span>
    </button>
  )
}
