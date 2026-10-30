import { hashString, type Track } from '../audio/tracks'

interface Props {
  track: Track
  size?: number
  className?: string
  rounded?: number
  showDisc?: boolean
}

/**
 * Deterministic procedural artwork: the gradient comes from the track palette,
 * the rings/arcs from a hash of the id — so every track looks designed without
 * shipping a single image.
 */
export function CoverArt({ track, size = 56, className = '', rounded = 12, showDisc = false }: Props) {
  const seed = hashString(track.id)
  const rings = 3 + (seed % 3)
  const rotation = seed % 360
  const points = 5 + (seed % 4)
  const cx = 50
  const cy = 50

  const star: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2
    const r = i % 2 === 0 ? 26 : 11
    star.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`)
  }

  return (
    <div
      className={`cover ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(140deg, ${track.art[0]}, ${track.art[1]})`,
      }}
      data-testid={`cover-${track.id}`}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" className="cover__art">
        <g transform={`rotate(${rotation} ${cx} ${cy})`} opacity="0.55">
          {Array.from({ length: rings }, (_, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={14 + i * 9}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={0.8}
            />
          ))}
          <polygon points={star.join(' ')} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7" />
        </g>
        <circle cx={cx} cy={cy} r="4.5" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
      </svg>
      {showDisc && <span className="cover__sheen" />}
    </div>
  )
}
