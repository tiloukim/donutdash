'use client'

import { useState, useEffect, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

type TaxData = {
  year: number
  shop: { name: string; address: string; city: string; state: string; zip: string; phone: string }
  owner: { name: string; email: string }
  grossAmount: number
  platformFees: number
  netAmount: number
  transactionCount: number
  monthly: number[]
  meetsThreshold: boolean
}

export default function TaxForms() {
  const [year, setYear] = useState(new Date().getFullYear() - 1) // Default to previous year
  const [data, setData] = useState<TaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/shop/tax-forms?year=${year}`)
      .then(r => r.json())
      .then(d => { if (d.grossAmount !== undefined) setData(d) })
      .finally(() => setLoading(false))
  }, [year])

  const handlePrint = () => {
    if (!formRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>1099-K ${year} - ${data?.shop.name}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 0; padding: 40px; color: #000; background: #fff; }
        @media print { body { padding: 20px; } }
      </style></head><body>${formRef.current.innerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }

  return (
    <div>
      {/* Year selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>1099-K Tax Forms</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Payment card and third-party network transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>&lt;</button>
          <span style={{ fontWeight: 800, fontSize: 18, minWidth: 50, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= new Date().getFullYear()} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700, opacity: year >= new Date().getFullYear() ? 0.3 : 1 }}>&gt;</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading tax data...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Failed to load data</div>
      ) : (
        <>
          {/* Status banner */}
          {!data.meetsThreshold && (
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
              <strong>Note:</strong> Your gross transactions for {year} are below the $600 IRS threshold. A 1099-K may not be required, but the summary is available for your records.
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Gross Amount', value: fmt(data.grossAmount), icon: '💳', color: '#FF1493' },
              { label: 'Platform Fees', value: fmt(data.platformFees), icon: '🏷️', color: '#F59E0B' },
              { label: 'Net to You', value: fmt(data.netAmount), icon: '💰', color: '#10B981' },
              { label: 'Transactions', value: data.transactionCount.toLocaleString(), icon: '📦', color: '#6366F1' },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Monthly breakdown */}
          <div style={{ ...card, marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #FFE4EF' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Monthly Gross Transactions</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#FFF5F8' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700 }}>Month</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>Gross Amount</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, width: '40%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((amt, i) => {
                    const max = Math.max(...data.monthly, 1)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{MONTHS[i]}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: amt > 0 ? '#FF1493' : '#ccc' }}>{amt > 0 ? fmt(amt) : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {amt > 0 && (
                            <div style={{ height: 8, borderRadius: 4, background: '#FFE4EF', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(amt / max) * 100}%`, background: '#FF1493', borderRadius: 4 }} />
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#FFF5F8', fontWeight: 800 }}>
                    <td style={{ padding: '12px 16px' }}>Total</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#FF1493' }}>{fmt(data.grossAmount)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Download / Print */}
          <div style={{ ...card, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>1099-K Form — Tax Year {year}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Print or save as PDF for your tax records</p>
              </div>
              <button onClick={handlePrint} style={{ padding: '10px 24px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                🖨️ Print / Save PDF
              </button>
            </div>
          </div>

          {/* Printable 1099-K form (hidden on screen, used for print) */}
          <div ref={formRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div style={{ fontFamily: "'Courier New', monospace", maxWidth: 700, margin: '0 auto', color: '#000' }}>
              <div style={{ textAlign: 'center', borderBottom: '3px solid #000', paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>PAYER'S/PSE'S name, address, and telephone no.</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>DonutDash Inc.</div>
                <div style={{ fontSize: 12 }}>donutdash.app | support@donutdash.app</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 12, letterSpacing: 2 }}>Form 1099-K</div>
                <div style={{ fontSize: 11 }}>Payment Card and Third Party Network Transactions</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Tax Year {year}</div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>For informational purposes — consult your tax advisor</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ border: '1px solid #000', padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>PAYEE'S name</div>
                  <div style={{ fontSize: 14 }}>{data.owner.name || '—'}</div>
                </div>
                <div style={{ border: '1px solid #000', padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>PAYEE'S business name</div>
                  <div style={{ fontSize: 14 }}>{data.shop.name || '—'}</div>
                </div>
              </div>

              <div style={{ border: '1px solid #000', padding: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Street address (including apt. no.)</div>
                <div style={{ fontSize: 13 }}>
                  {data.shop.address || '—'}<br/>
                  {[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ') || '—'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: '1px solid #000', marginBottom: 20 }}>
                <div style={{ padding: 12, borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>1a. Gross amount of payment card/third party network transactions</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmt(data.grossAmount)}</div>
                </div>
                <div style={{ padding: 12, borderBottom: '1px solid #000' }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>1b. Card not present transactions</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmt(data.grossAmount)}</div>
                </div>
                <div style={{ padding: 12, borderRight: '1px solid #000' }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>2. Merchant category code</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>5462 — Bakeries</div>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>3. Number of payment transactions</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{data.transactionCount.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ border: '1px solid #000', marginBottom: 20 }}>
                <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, borderBottom: '1px solid #000', background: '#f5f5f5' }}>
                  5a–5l. Gross amount of each month
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {MONTHS.map((m, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRight: (i + 1) % 4 !== 0 ? '1px solid #ddd' : 'none', borderBottom: i < 8 ? '1px solid #ddd' : 'none' }}>
                      <div style={{ fontSize: 10, color: '#666' }}>{m.slice(0, 3)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{data.monthly[i] > 0 ? fmt(data.monthly[i]) : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 20, borderTop: '1px solid #ccc', paddingTop: 12 }}>
                This is an informational summary generated by DonutDash for tax year {year}.<br/>
                This document is provided for your records and may differ from the official IRS Form 1099-K.<br/>
                Consult your tax professional for filing requirements. Generated on {new Date().toLocaleDateString()}.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
