'use client'

export default function RunningDonut({ size = 100 }: { size?: number }) {
  const s = size
  const scale = s / 100

  return (
    <div style={{ width: s, height: s, position: 'relative', display: 'inline-block' }}>
      <style>{`
        @keyframes donut-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-${4 * scale}px); }
        }
        @keyframes donut-left-leg {
          0%, 100% { transform: rotate(-25deg); }
          50% { transform: rotate(25deg); }
        }
        @keyframes donut-right-leg {
          0%, 100% { transform: rotate(25deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes donut-left-arm {
          0%, 100% { transform: rotate(15deg); }
          50% { transform: rotate(-10deg); }
        }
        @keyframes donut-right-arm {
          0%, 100% { transform: rotate(-20deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes donut-speed-lines {
          0%, 100% { opacity: 0.6; transform: translateX(0); }
          50% { opacity: 0.2; transform: translateX(-${3 * scale}px); }
        }
        .donut-body {
          animation: donut-bounce 0.35s ease-in-out infinite;
        }
        .donut-left-leg {
          animation: donut-left-leg 0.35s ease-in-out infinite;
          transform-origin: ${42 * scale}px ${72 * scale}px;
        }
        .donut-right-leg {
          animation: donut-right-leg 0.35s ease-in-out infinite;
          transform-origin: ${58 * scale}px ${72 * scale}px;
        }
        .donut-left-arm {
          animation: donut-left-arm 0.35s ease-in-out infinite;
          transform-origin: ${30 * scale}px ${48 * scale}px;
        }
        .donut-right-arm {
          animation: donut-right-arm 0.35s ease-in-out infinite;
          transform-origin: ${70 * scale}px ${45 * scale}px;
        }
        .donut-speed-lines {
          animation: donut-speed-lines 0.35s ease-in-out infinite;
        }
      `}</style>
      <svg viewBox="0 0 100 100" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
        {/* Speed lines */}
        <g className="donut-speed-lines">
          <line x1="5" y1="35" x2="15" y2="35" stroke="#FF69B4" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="2" y1="42" x2="14" y2="42" stroke="#FF69B4" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <line x1="5" y1="49" x2="13" y2="49" stroke="#FF69B4" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </g>

        {/* Left leg */}
        <g className="donut-left-leg">
          <rect x="37" y="72" width="8" height="14" rx="4" fill="#8B4513" />
          <ellipse cx="39" cy="88" rx="7" ry="4" fill="#FF6B00" />
          <ellipse cx="36" cy="88" rx="3" ry="2.5" fill="white" />
        </g>

        {/* Right leg */}
        <g className="donut-right-leg">
          <rect x="55" y="72" width="8" height="14" rx="4" fill="#8B4513" />
          <ellipse cx="61" cy="88" rx="7" ry="4" fill="#FF6B00" />
          <ellipse cx="64" cy="88" rx="3" ry="2.5" fill="white" />
        </g>

        {/* Body group (bounces) */}
        <g className="donut-body">
          {/* Left arm */}
          <g className="donut-left-arm">
            <rect x="18" y="45" width="14" height="7" rx="3.5" fill="#8B4513" />
            <circle cx="18" cy="48.5" r="4" fill="#8B4513" />
          </g>

          {/* Right arm holding coffee */}
          <g className="donut-right-arm">
            <rect x="68" y="40" width="14" height="7" rx="3.5" fill="#8B4513" />
            {/* Coffee cup */}
            <g transform="translate(78, 30)">
              <rect x="-4" y="0" width="10" height="14" rx="2" fill="white" />
              <rect x="-4" y="0" width="10" height="4" rx="2" fill="#8B4513" />
              <path d="M6,4 Q10,4 10,8 Q10,12 6,12" fill="none" stroke="white" strokeWidth="1.5" />
              {/* Steam */}
              <path d="M-1,-3 Q0,-6 1,-3" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <path d="M3,-2 Q4,-5 5,-2" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
            </g>
          </g>

          {/* Donut body - chocolate */}
          <ellipse cx="50" cy="48" rx="24" ry="26" fill="#8B4513" />

          {/* Donut hole */}
          <ellipse cx="50" cy="48" rx="8" ry="9" fill="#D2691E" />

          {/* Pink frosting */}
          <ellipse cx="50" cy="44" rx="23" ry="22" fill="#FF69B4" />

          {/* Frosting drips */}
          <path d="M28,50 Q28,58 30,55" fill="#FF69B4" />
          <path d="M35,54 Q34,62 37,58" fill="#FF69B4" />
          <path d="M63,54 Q64,61 66,57" fill="#FF69B4" />
          <path d="M70,49 Q71,56 73,53" fill="#FF69B4" />

          {/* Donut hole in frosting */}
          <ellipse cx="50" cy="44" rx="7" ry="8" fill="#D2691E" />

          {/* Sprinkles */}
          <rect x="35" y="32" width="5" height="2" rx="1" fill="white" transform="rotate(-30 37 33)" />
          <rect x="55" y="30" width="5" height="2" rx="1" fill="#FFD700" transform="rotate(20 57 31)" />
          <rect x="42" y="52" width="5" height="2" rx="1" fill="white" transform="rotate(10 44 53)" />
          <rect x="60" y="50" width="5" height="2" rx="1" fill="#00CED1" transform="rotate(-15 62 51)" />
          <rect x="33" y="44" width="5" height="2" rx="1" fill="#FFD700" transform="rotate(30 35 45)" />
          <rect x="63" y="40" width="5" height="2" rx="1" fill="white" transform="rotate(-25 65 41)" />
          <rect x="45" y="27" width="4" height="2" rx="1" fill="#00CED1" transform="rotate(15 47 28)" />

          {/* Face - eyes */}
          <ellipse cx="42" cy="42" rx="3.5" ry="4" fill="white" />
          <ellipse cx="58" cy="42" rx="3.5" ry="4" fill="white" />
          <ellipse cx="43" cy="42.5" rx="2" ry="2.5" fill="#1A1A2E" />
          <ellipse cx="59" cy="42.5" rx="2" ry="2.5" fill="#1A1A2E" />
          {/* Eye shine */}
          <circle cx="44" cy="41" r="0.8" fill="white" />
          <circle cx="60" cy="41" r="0.8" fill="white" />

          {/* Mouth - happy smile */}
          <path d="M45,49 Q50,55 55,49" fill="none" stroke="#1A1A2E" strokeWidth="1.8" strokeLinecap="round" />

          {/* Blush */}
          <ellipse cx="37" cy="49" rx="3" ry="2" fill="rgba(255,105,180,0.4)" />
          <ellipse cx="63" cy="49" rx="3" ry="2" fill="rgba(255,105,180,0.4)" />
        </g>
      </svg>
    </div>
  )
}
