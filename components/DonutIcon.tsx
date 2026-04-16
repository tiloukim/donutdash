// Decorative donut illustration used as a fallback for shops without a logo.
// Pink glazed donut with rainbow sprinkles.

interface DonutIconProps {
  size?: number
  className?: string
}

export default function DonutIcon({ size = 120, className }: DonutIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="dough" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#E8A863" />
          <stop offset="60%" stopColor="#C08049" />
          <stop offset="100%" stopColor="#8B5A2B" />
        </radialGradient>
        <radialGradient id="glaze" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFD6E8" />
          <stop offset="50%" stopColor="#FF69B4" />
          <stop offset="100%" stopColor="#E91E8C" />
        </radialGradient>
        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Donut dough (ring) */}
      <g filter="url(#dropShadow)">
        <circle cx="100" cy="100" r="85" fill="url(#dough)" />
        <circle cx="100" cy="100" r="28" fill="#FFF6EC" />
      </g>

      {/* Pink glaze — drippy top layer */}
      <path
        d="M 100 15
           C 55 15, 15 55, 15 100
           C 15 120, 22 138, 34 152
           C 36 146, 42 142, 48 148
           C 54 154, 60 150, 62 145
           C 64 152, 72 155, 78 148
           C 85 140, 92 148, 94 153
           C 98 145, 108 148, 110 155
           C 115 148, 124 150, 126 145
           C 130 152, 138 150, 140 143
           C 144 150, 152 152, 158 146
           C 170 134, 180 118, 184 102
           C 188 54, 148 15, 100 15 Z"
        fill="url(#glaze)"
      />

      {/* Inner hole highlight on glaze */}
      <circle cx="100" cy="100" r="32" fill="#FFF6EC" />

      {/* Sprinkles */}
      <g>
        <rect x="58" y="42" width="6" height="16" rx="3" fill="#FFD700" transform="rotate(-25 61 50)" />
        <rect x="82" y="30" width="6" height="16" rx="3" fill="#00C9A7" transform="rotate(15 85 38)" />
        <rect x="108" y="35" width="6" height="16" rx="3" fill="#FFFFFF" transform="rotate(-10 111 43)" />
        <rect x="132" y="48" width="6" height="16" rx="3" fill="#FF6B35" transform="rotate(35 135 56)" />
        <rect x="46" y="72" width="6" height="16" rx="3" fill="#4A90E2" transform="rotate(-45 49 80)" />
        <rect x="150" y="78" width="6" height="16" rx="3" fill="#9C27B0" transform="rotate(60 153 86)" />
        <rect x="42" y="108" width="6" height="16" rx="3" fill="#FFD700" transform="rotate(-70 45 116)" />
        <rect x="154" y="118" width="6" height="16" rx="3" fill="#FFFFFF" transform="rotate(80 157 126)" />
        <rect x="62" y="138" width="6" height="16" rx="3" fill="#00C9A7" transform="rotate(-10 65 146)" />
        <rect x="138" y="142" width="6" height="16" rx="3" fill="#FF6B35" transform="rotate(20 141 150)" />
        <rect x="68" y="55" width="4" height="10" rx="2" fill="#FFFFFF" transform="rotate(10 70 60)" />
        <rect x="120" y="68" width="4" height="10" rx="2" fill="#4A90E2" transform="rotate(-30 122 73)" />
        <rect x="80" y="128" width="4" height="10" rx="2" fill="#9C27B0" transform="rotate(45 82 133)" />
      </g>

      {/* Soft glaze highlight */}
      <ellipse cx="72" cy="55" rx="22" ry="10" fill="#FFFFFF" opacity="0.3" />
    </svg>
  )
}
