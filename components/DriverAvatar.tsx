// Renders a driver's profile photo as a circular avatar with an initials fallback.
// Used on the customer tracking page, shop orders page, admin drivers, and admin orders.

interface Props {
  name?: string | null
  url?: string | null
  size?: number          // px diameter — defaults to 40
  ring?: boolean         // optional white ring (looks good on colored cards)
}

export default function DriverAvatar({ name, url, size = 40, ring = false }: Props) {
  const initial = (name || '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: url
        ? `url(${url}) center/cover`
        : 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: 700,
      flexShrink: 0,
      boxShadow: ring ? '0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.12)' : undefined,
    }}>
      {!url && initial}
    </div>
  )
}
