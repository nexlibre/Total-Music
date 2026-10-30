interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const PlayIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" />
  </svg>
)

export const PauseIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1.2" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" />
  </svg>
)

export const NextIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M6 5.6v12.8a1 1 0 0 0 1.54.84l9-6.4a1 1 0 0 0 0-1.68l-9-6.4A1 1 0 0 0 6 5.6Z" />
    <rect x="17" y="5" width="2.4" height="14" rx="1.2" />
  </svg>
)

export const PrevIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M18 5.6v12.8a1 1 0 0 1-1.54.84l-9-6.4a1 1 0 0 1 0-1.68l9-6.4A1 1 0 0 1 18 5.6Z" />
    <rect x="4.6" y="5" width="2.4" height="14" rx="1.2" />
  </svg>
)

export const HeartIcon = ({ size = 20, className, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.3s-7.6-4.7-7.6-10A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.6 3.2c0 5.3-7.6 10-7.6 10Z" />
  </svg>
)

export const ShuffleIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M16 4h4v4M20 4l-6.5 6.5M4 20l5.5-5.5M16 20h4v-4M14 14l6 6M4 4l4 4" />
  </svg>
)

export const RepeatIcon = ({ size = 20, className, one }: IconProps & { one?: boolean }) => (
  <svg {...base(size)} className={className}>
    <path d="M17 3.5 20 6l-3 2.5" />
    <path d="M20 6H7.5A3.5 3.5 0 0 0 4 9.5V11" />
    <path d="M7 20.5 4 18l3-2.5" />
    <path d="M4 18h12.5A3.5 3.5 0 0 0 20 14.5V13" />
    {one && <text x="12" y="14.6" textAnchor="middle" fontSize="8" strokeWidth="0.6" fill="currentColor" stroke="none">1</text>}
  </svg>
)

export const EqIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20v-6M4 10V4M12 20v-9M12 7V4M20 20v-4M20 12V4" />
    <circle cx="4" cy="12" r="2" />
    <circle cx="12" cy="9" r="2" />
    <circle cx="20" cy="14" r="2" />
  </svg>
)

export const VolumeIcon = ({ size = 20, className, muted }: IconProps & { muted?: boolean }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9.5h3L12 5v14l-5-4.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill="currentColor" stroke="none" />
    {muted ? (
      <path d="M16 9l5 6M21 9l-5 6" />
    ) : (
      <>
        <path d="M16 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
      </>
    )}
  </svg>
)

export const SearchIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const CloseIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const ChevronDownIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const SparkIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
)

export const ResetIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 9A8 8 0 1 1 4 13" />
    <path d="M4 4v5h5" />
  </svg>
)
