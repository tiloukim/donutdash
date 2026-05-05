// Renders a driver's profile photo as a circular avatar with an initials fallback.
// Used on the customer tracking page, shop orders page, admin drivers, and admin orders.

interface Props {
  name?: string | null
  url?: string | null
  // Fallback used when `url` is missing — typically the verification "selfie-combined"
  // strip uploaded during driver onboarding. The strip is 3 frames side-by-side
  // (CENTER, LEFT, RIGHT) so we CSS-crop to roughly the center pose.
  selfieUrl?: string | null
  size?: number          // px diameter — defaults to 40
  ring?: boolean         // optional white ring (looks good on colored cards)
}

export default function DriverAvatar({ name, url, selfieUrl, size = 40, ring = false }: Props) {
  const initial = (name || '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'

  // Real avatar takes precedence — full background-cover.
  if (url) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `url(${url}) center/cover`,
        flexShrink: 0,
        boxShadow: ring ? '0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.12)' : undefined,
      }} />
    )
  }

  // Selfie fallback — the strip is approximately 1928×480 (three 640×480 frames
  // with 4px gaps between). We scale to fit avatar height and shift left so the
  // center frame's face (~x=320 of 1928) lands at avatar center. Math:
  //   scaledImageWidth ≈ size × (1928/480) ≈ 4.017 × size
  //   faceX in scaled = scaledImageWidth × 0.166 ≈ 0.667 × size
  //   to put faceX at size/2: leftOffset = size/2 - 0.667×size = -0.167×size
  if (selfieUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        overflow: 'hidden', position: 'relative', background: '#1A1A2E',
        flexShrink: 0,
        boxShadow: ring ? '0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.12)' : undefined,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selfieUrl}
          alt=""
          style={{
            position: 'absolute',
            height: size, width: 'auto', maxWidth: 'none',
            left: -0.167 * size, top: 0,
          }}
        />
      </div>
    )
  }

  // Initials fallback.
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: 700,
      flexShrink: 0,
      boxShadow: ring ? '0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.12)' : undefined,
    }}>
      {initial}
    </div>
  )
}
