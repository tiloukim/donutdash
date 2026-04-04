'use client'

import { useState, useEffect } from 'react'

interface DriverTax {
  id: string
  name: string
  email: string
  phone: string | null
  deliveryCount: number
  totalEarnings: number
  totalPaid: number
  unpaid: number
  needs1099: boolean
  w9Status: string
}

interface Quarter {
  quarter: string
  revenue: number
  commissions: number
  serviceFees: number
  deliveryFees: number
  driverPay: number
  netIncome: number
  orderCount: number
}

interface ShopTax {
  id: string
  name: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  orderCount: number
  totalRevenue: number
  commissionPaid: number
  shopEarnings: number
  needs1099: boolean
  w9Status: string
}

interface TaxData {
  year: number
  platformIncome: {
    totalRevenue: number
    shopCommissions: number
    serviceFees: number
    deliveryFees: number
    driverPayouts: number
    tips: number
    netTaxableIncome: number
    estimatedTax: number
    estimatedIncomeTax: number
  }
  quarters: Quarter[]
  drivers: DriverTax[]
  shops: ShopTax[]
  summary: {
    totalDrivers: number
    driversNeeding1099: number
    driversMissingW9: number
    totalShops: number
    shopsNeeding1099: number
    shopsMissingW9: number
  }
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AdminTax() {
  const [data, setData] = useState<TaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/tax?year=${year}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading tax data...</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Failed to load</div>

  const { platformIncome: pi, quarters, drivers, shops, summary } = data

  return (
    <div>
      {/* Year selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1A1A2E' }}>Tax Year {year}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[2025, 2026, 2027].map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: year === y ? '#6366F1' : '#F3F4F6',
              color: year === y ? '#fff' : '#6B7280',
            }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {summary.driversMissingW9 > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>&#9888;</span>
          <div>
            <span style={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>{summary.driversMissingW9} driver{summary.driversMissingW9 > 1 ? 's' : ''} earning $600+ without W-9 on file</span>
            <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>IRS requires W-9 before issuing 1099-NEC. Collect ASAP or apply 24% backup withholding.</div>
          </div>
        </div>
      )}

      {summary.shopsMissingW9 > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>&#127978;</span>
          <div>
            <span style={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>{summary.shopsMissingW9} shop{summary.shopsMissingW9 > 1 ? 's' : ''} earning $600+ without W-9 on file</span>
            <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>IRS requires W-9 before issuing 1099-NEC to shop owners.</div>
          </div>
        </div>
      )}

      {/* Platform Income Summary */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2B55 100%)',
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Platform Taxable Income</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Revenue', value: pi.totalRevenue, color: '#10B981' },
            { label: 'Shop Commissions', value: pi.shopCommissions, color: '#8B5CF6' },
            { label: 'Service Fees', value: pi.serviceFees, color: '#06B6D4' },
            { label: 'Delivery Fees', value: pi.deliveryFees, color: '#F59E0B' },
            { label: 'Driver Payouts', value: pi.driverPayouts, color: '#EF4444', prefix: '-' },
            { label: 'Tips (pass-through)', value: pi.tips, color: '#9CA3AF' },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                {(item as any).prefix || ''}{fmt(item.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Net taxable + estimated taxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
          <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: 10, padding: 16, border: '1px solid rgba(99,102,241,0.3)' }}>
            <div style={{ fontSize: 11, color: '#A5B4FC' }}>Net Taxable Income</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#6366F1', marginTop: 4 }}>{fmt(pi.netTaxableIncome)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Commissions + Fees - Driver Pay</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 11, color: '#FCA5A5' }}>Est. Self-Employment Tax</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>{fmt(pi.estimatedTax)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>15.3% (Social Security + Medicare)</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: 10, padding: 16, border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: 11, color: '#FCD34D' }}>Est. Federal Income Tax</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>{fmt(pi.estimatedIncomeTax)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>~22% bracket estimate</div>
          </div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Quarterly Breakdown</h3>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0 0' }}>For estimated quarterly tax payments (Form 1040-ES)</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Quarter', 'Orders', 'Revenue', 'Commissions', 'Service Fees', 'Delivery Fees', 'Driver Pay', 'Net Income'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quarters.map(q => (
                <tr key={q.quarter} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, textAlign: 'right' }}>{q.quarter}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right' }}>{q.orderCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right' }}>{fmt(q.revenue)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right' }}>{fmt(q.commissions)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right' }}>{fmt(q.serviceFees)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right' }}>{fmt(q.deliveryFees)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', color: '#EF4444' }}>-{fmt(q.driverPay)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, textAlign: 'right', color: q.netIncome >= 0 ? '#10B981' : '#EF4444' }}>{fmt(q.netIncome)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: '#FAFAFA', borderTop: '2px solid #E5E7EB' }}>
                <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 14, textAlign: 'right' }}>Total</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{quarters.reduce((s, q) => s + q.orderCount, 0)}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{fmt(quarters.reduce((s, q) => s + q.revenue, 0))}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{fmt(quarters.reduce((s, q) => s + q.commissions, 0))}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{fmt(quarters.reduce((s, q) => s + q.serviceFees, 0))}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{fmt(quarters.reduce((s, q) => s + q.deliveryFees, 0))}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'right', color: '#EF4444' }}>-{fmt(quarters.reduce((s, q) => s + q.driverPay, 0))}</td>
                <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 14, textAlign: 'right', color: '#6366F1' }}>{fmt(pi.netTaxableIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 1099 Driver Tracker */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>1099-NEC Tracker</h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0 0' }}>Drivers earning $600+ require 1099-NEC filing by Jan 31</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#6366F1' }}>{summary.totalDrivers}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>{summary.driversNeeding1099}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Need 1099</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{summary.driversMissingW9}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Missing W-9</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Driver', 'Email', 'Deliveries', 'Total Earned', 'Total Paid', 'Unpaid', '1099 Required', 'W-9 Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map(driver => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #F3F4F6', background: driver.needs1099 && driver.w9Status === 'missing' ? '#FEF2F2' : undefined }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{driver.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{driver.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{driver.deliveryCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{fmt(driver.totalEarnings)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#10B981' }}>{fmt(driver.totalPaid)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: driver.unpaid > 0 ? '#F59E0B' : '#10B981' }}>{fmt(driver.unpaid)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {driver.needs1099 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#FEE2E2', color: '#DC2626' }}>Yes</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280' }}>
                        No ({fmt(600 - driver.totalEarnings)} to go)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                      background: driver.w9Status === 'approved' ? '#D1FAE5' : driver.w9Status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                      color: driver.w9Status === 'approved' ? '#065F46' : driver.w9Status === 'pending' ? '#92400E' : '#DC2626',
                    }}>
                      {driver.w9Status === 'approved' ? 'On File' : driver.w9Status === 'pending' ? 'Pending' : 'Missing'}
                    </span>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No driver activity for {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1099 Shop Owner Tracker */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Shop Owner 1099-NEC Tracker</h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0 0' }}>Shop owners earning $600+ require 1099-NEC filing by Jan 31</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#EC4899' }}>{summary.totalShops}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>{summary.shopsNeeding1099}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Need 1099</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{summary.shopsMissingW9}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Missing W-9</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Shop', 'Owner', 'Email', 'Orders', 'Revenue', 'Commission', 'Shop Earnings', '1099 Required', 'W-9 Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid #F3F4F6', background: shop.needs1099 && shop.w9Status === 'missing' ? '#FEF2F2' : undefined }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{shop.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{shop.ownerName}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{shop.ownerEmail}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{shop.orderCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{fmt(shop.totalRevenue)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{fmt(shop.commissionPaid)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{fmt(shop.shopEarnings)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {shop.needs1099 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#FEE2E2', color: '#DC2626' }}>Yes</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280' }}>
                        No ({fmt(600 - shop.shopEarnings)} to go)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                      background: shop.w9Status === 'approved' ? '#D1FAE5' : shop.w9Status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                      color: shop.w9Status === 'approved' ? '#065F46' : shop.w9Status === 'pending' ? '#92400E' : '#DC2626',
                    }}>
                      {shop.w9Status === 'approved' ? 'On File' : shop.w9Status === 'pending' ? 'Pending' : 'Missing'}
                    </span>
                  </td>
                </tr>
              ))}
              {shops.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No shop activity for {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export / Download Section */}
      <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px 0' }}>Export Tax Documents</h4>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px 0' }}>Download CSV files for your accountant or tax filing</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { type: '1099', label: '1099-NEC Summary', desc: 'Driver earnings for IRS 1099 filing', icon: '📋', color: '#EF4444' },
            { type: 'quarterly', label: 'Quarterly Tax Summary', desc: 'For estimated tax payments (1040-ES)', icon: '📊', color: '#F59E0B' },
            { type: 'monthly', label: 'Monthly Breakdown', desc: 'Revenue & expenses by month', icon: '📅', color: '#6366F1' },
            { type: 'annual', label: 'Annual P&L Statement', desc: 'Full year profit & loss', icon: '📈', color: '#10B981' },
            { type: 'driver_payments', label: 'Driver Payment History', desc: 'All payout requests & statuses', icon: '💸', color: '#3B82F6' },
            { type: 'shop_payments', label: 'Shop Payment Summary', desc: 'Shop earnings & bank details', icon: '🏪', color: '#EC4899' },
          ].map(exp => (
            <a
              key={exp.type}
              href={`/api/admin/tax/export?year=${year}&type=${exp.type}`}
              download
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
                borderRadius: 10, border: '1px solid #E5E7EB', textDecoration: 'none',
                transition: 'background 0.15s', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: exp.color + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>
                {exp.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{exp.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{exp.desc}</div>
                <div style={{ fontSize: 11, color: exp.color, fontWeight: 600, marginTop: 4 }}>Download CSV</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Tax reminders */}
      <div style={{ marginTop: 24, background: '#F0F9FF', borderRadius: 12, border: '1px solid #BAE6FD', padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0369A1', margin: '0 0 10px 0' }}>Tax Filing Reminders</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {[
            { date: 'Jan 31', task: 'Send 1099-NEC to drivers earning $600+' },
            { date: 'Jan 31', task: 'Send 1099-NEC to shop owners earning $600+' },
            { date: 'Jan 31', task: 'File all 1099-NEC copies with IRS' },
            { date: 'Apr 15', task: 'Q1 estimated tax payment (Form 1040-ES)' },
            { date: 'Jun 15', task: 'Q2 estimated tax payment' },
            { date: 'Sep 15', task: 'Q3 estimated tax payment' },
            { date: 'Jan 15', task: 'Q4 estimated tax payment' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{r.date}</span>
              <span style={{ fontSize: 13, color: '#0369A1' }}>{r.task}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
