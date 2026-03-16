import { ORDER_STATUS_LABELS } from '@/lib/constants'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FFF3CD', text: '#856404' },
  confirmed: { bg: '#D1ECF1', text: '#0C5460' },
  preparing: { bg: '#E8DAFF', text: '#6F42C1' },
  ready_for_pickup: { bg: '#D4EDDA', text: '#155724' },
  picked_up: { bg: '#CCE5FF', text: '#004085' },
  delivering: { bg: '#FFE0F0', text: '#FF1493' },
  delivered: { bg: '#D4EDDA', text: '#155724' },
  cancelled: { bg: '#F8D7DA', text: '#721C24' },
}

export default function OrderStatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: '#f0f0f0', text: '#666' }
  const label = ORDER_STATUS_LABELS[status] || status

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.3rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
