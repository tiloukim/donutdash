'use client'

import { useState, useEffect } from 'react'
import { useShopLang } from '@/lib/shop-lang-context'

const REASON_LABELS: Record<string, { en: string; km: string }> = {
  wrong_items: { en: 'Wrong Items', km: 'មុខម្ហូបខុស' },
  missing_items: { en: 'Missing Items', km: 'មុខម្ហូបបាត់' },
  cold_food: { en: 'Cold Food', km: 'អាហារត្រជាក់' },
  late_delivery: { en: 'Late Delivery', km: 'ដឹកជញ្ជូនយឺត' },
  never_delivered: { en: 'Never Delivered', km: 'មិនបានដឹកជញ្ជូន' },
  damaged: { en: 'Damaged', km: 'ខូចខាត' },
  other: { en: 'Other', km: 'ផ្សេងៗ' },
}

const STATUS_STYLES: Record<string, { bg: string; color: string; en: string; km: string }> = {
  pending: { bg: '#FFF3CD', color: '#856404', en: 'Pending', km: 'រង់ចាំ' },
  approved: { bg: '#D1FAE5', color: '#065F46', en: 'Approved', km: 'បានអនុម័ត' },
  rejected: { bg: '#FEE2E2', color: '#991B1B', en: 'Rejected', km: 'បានបដិសេធ' },
  refunded: { bg: '#DBEAFE', color: '#1E40AF', en: 'Refunded', km: 'បានសងប្រាក់វិញ' },
}

export default function ShopDisputesPage() {
  const { lang } = useShopLang()
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/shop/disputes')
      .then(r => r.json())
      .then(data => setDisputes(data.disputes || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const labels = {
    title: lang === 'km' ? 'របាយការណ៍បញ្ហា' : 'Customer Issues',
    noIssues: lang === 'km' ? 'មិនមានបញ្ហារបាយការណ៍ទេ' : 'No issues reported',
    noIssuesDesc: lang === 'km' ? 'អតិថិជនរបស់អ្នកមិនបានរាយការណ៍បញ្ហាទេ។' : 'Your customers haven\'t reported any issues yet.',
    customer: lang === 'km' ? 'អតិថិជន' : 'Customer',
    order: lang === 'km' ? 'ការបញ្ជាទិញ' : 'Order',
    reason: lang === 'km' ? 'មូលហេតុ' : 'Reason',
    description: lang === 'km' ? 'ការពិពណ៌នា' : 'Description',
    noDescription: lang === 'km' ? 'គ្មានការពិពណ៌នា' : 'No description provided.',
    refundRequested: lang === 'km' ? 'ទឹកប្រាក់សងវិញ' : 'Refund Requested',
    orderItems: lang === 'km' ? 'មុខម្ហូបក្នុងការបញ្ជាទិញ' : 'Order Items',
    adminDecision: lang === 'km' ? 'ការសម្រេចរបស់អ្នកគ្រប់គ្រង' : 'Admin Decision',
    deliveryProof: lang === 'km' ? 'រូបភាពដឹកជញ្ជូន' : 'Delivery Proof',
    deliveryAddress: lang === 'km' ? 'អាសយដ្ឋានដឹកជញ្ជូន' : 'Delivery Address',
    pending: lang === 'km' ? 'កំពុងពិនិត្យដោយអ្នកគ្រប់គ្រង' : 'Being reviewed by admin',
    refundNote: lang === 'km' ? 'ការសងប្រាក់វិញត្រូវបានដំណើរការដោយអ្នកគ្រប់គ្រង DonutDash។ មិនមានការកាត់ប្រាក់ពីចំណូលហាងរបស់អ្នកទេ។' : 'Refunds are handled by DonutDash admin. No deduction is made from your shop earnings.',
  }

  const stats = {
    total: disputes.length,
    pending: disputes.filter(d => d.status === 'pending').length,
    resolved: disputes.filter(d => ['approved', 'rejected', 'refunded'].includes(d.status)).length,
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{lang === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...'}</div>

  return (
    <div>
      {/* Info Banner */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12,
        padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#1E40AF', lineHeight: 1.6,
      }}>
        {labels.refundNote}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: lang === 'km' ? 'សរុប' : 'Total', value: stats.total, color: '#FF1493' },
          { label: lang === 'km' ? 'រង់ចាំ' : 'Pending', value: stats.pending, color: '#F59E0B' },
          { label: lang === 'km' ? 'ដោះស្រាយហើយ' : 'Resolved', value: stats.resolved, color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2705;</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 6 }}>{labels.noIssues}</div>
          <div style={{ fontSize: 14, color: '#888' }}>{labels.noIssuesDesc}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {disputes.map(d => {
            const isExpanded = expandedId === d.id
            const statusStyle = STATUS_STYLES[d.status] || STATUS_STYLES.pending
            const reasonLabel = REASON_LABELS[d.reason]?.[lang] || d.reason
            const delivery = Array.isArray(d.order?.delivery) ? d.order.delivery[0] : d.order?.delivery

            return (
              <div key={d.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }}>
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{d.customer?.name || 'Customer'}</span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: statusStyle.bg, color: statusStyle.color,
                      }}>
                        {statusStyle[lang]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {reasonLabel} · #{d.order_id?.slice(0, 8)} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#EF4444' }}>${Number(d.refund_amount).toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{labels.refundRequested}</div>
                    </div>
                    <span style={{ color: '#ccc' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #FFE4EF', padding: 20 }}>
                    {/* Reason & Description */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#FF1493', textTransform: 'uppercase', marginBottom: 6 }}>{labels.reason}</div>
                      <div style={{ background: '#FFF0F5', borderRadius: 8, padding: 14, border: '1px solid #FFE4EF' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{reasonLabel}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>{d.description || labels.noDescription}</div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>{labels.customer}</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{d.customer?.name}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>{d.customer?.email}</div>
                        {d.customer?.phone && <div style={{ fontSize: 13, color: '#666' }}>{d.customer.phone}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>{labels.order}</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>#{d.order_id?.slice(0, 8)}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>${Number(d.order?.total || 0).toFixed(2)}</div>
                        {d.order?.delivery_address && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{d.order.delivery_address}</div>}
                      </div>
                    </div>

                    {/* Order Items */}
                    {d.order?.items && d.order.items.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>{labels.orderItems}</div>
                        <div style={{ background: '#FAFAFA', borderRadius: 8, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                          {d.order.items.map((item: any, i: number) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
                              borderBottom: i < d.order.items.length - 1 ? '1px solid #f0f0f0' : 'none',
                              fontSize: 13,
                            }}>
                              <span>{item.quantity}x {item.name}</span>
                              <span style={{ fontWeight: 600 }}>${Number(item.price).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery Proof Photo */}
                    {delivery?.delivery_photo_url && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: 6 }}>{labels.deliveryProof}</div>
                        <img src={delivery.delivery_photo_url} alt="Delivery proof" style={{ maxWidth: 280, borderRadius: 10, border: '1px solid #e5e7eb' }} />
                      </div>
                    )}

                    {/* Admin Decision */}
                    {d.status !== 'pending' && d.admin_notes && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', marginBottom: 6 }}>{labels.adminDecision}</div>
                        <div style={{ background: '#F0F0FF', borderRadius: 8, padding: 14, border: '1px solid #E0E0FF', fontSize: 13, color: '#444' }}>
                          {d.admin_notes}
                        </div>
                      </div>
                    )}

                    {d.status === 'pending' && (
                      <div style={{ background: '#FFF3CD', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#856404' }}>
                        {labels.pending}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
