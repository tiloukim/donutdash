'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

type TaxData = {
  year: number
  shop: { name: string; address: string; city: string; state: string; zip: string; phone: string; tax_id: string | null }
  owner: { name: string; email: string }
  grossAmount: number
  platformFees: number
  netAmount: number
  transactionCount: number
  monthly: number[]
  meetsThreshold: boolean
}

function build1099K(data: TaxData, year: number): string {
  const mo = (i: number) => data.monthly[i] > 0 ? fmt(data.monthly[i]).slice(1) : '0.00'
  const shopAddr = [data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')

  return `<!DOCTYPE html><html><head><title>1099-K ${year} - ${data.shop.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;padding:0.5in;color:#000;background:#fff;font-size:9px;line-height:1.3}
@media print{body{padding:0.4in}@page{margin:0.4in;size:letter}}
table.form{border-collapse:collapse;width:100%;border:2px solid #000}
table.form td{border:1px solid #000;padding:3px 5px;vertical-align:top;font-size:9px}
.lbl{font-size:6.5px;line-height:1.2}
.val{font-size:9px;margin-top:1px}
.val-lg{font-size:12px;font-weight:bold;margin-top:2px}
.val-xl{font-size:42px;font-weight:900;line-height:1;letter-spacing:-1px}
.chk{display:inline-block;width:10px;height:10px;border:1.5px solid #000;text-align:center;font-size:9px;font-weight:bold;line-height:9px;margin-right:2px;vertical-align:middle}
.page2{page-break-before:always}
.cover p{margin-top:4px;font-size:7.5px;line-height:1.45}
.footer{display:flex;justify-content:space-between;margin-top:5px;font-size:7px}
</style></head><body>

<!-- PAGE 1: Cover Letter -->
<div style="display:flex;justify-content:space-between">
  <div style="font-size:10px;line-height:1.5">Kimco LLC d/b/a DonutDash<br>7205 S Broadway Ave. #400<br>Tyler, TX 75703</div>
  <div style="font-size:9px;text-align:right">If you have questions contact:<br>support@donutdash.app</div>
</div>
<div style="margin:50px 0 50px 60px;font-size:12px;line-height:1.6">
  <b>${data.shop.name}</b><br>${data.shop.address || ''}<br>${shopAddr}
</div>
<div style="display:flex;gap:24px;margin-top:30px">
  <div class="cover" style="flex:1">
    <div style="font-size:12px;font-weight:bold;margin-bottom:8px">Instructions for Payee</div>
    <p>You have received this form because you have either (a) accepted payment cards for payments, or (b) received payments through a third party network in the calendar year reported on this form.</p>
    <p>Merchant acquirers and third party settlement organizations, as payment settlement entities (PSEs), must report the proceeds of payment card and third party network transactions made to you on Form 1099-K under Internal Revenue Code section 6050W.</p>
    <p><b>Payee's taxpayer identification number (TIN).</b> For your protection, this form may show only the last four digits of your TIN.</p>
    <p><b>Account number.</b> May show an account number or other unique number the PSE assigned to distinguish your account.</p>
    <p><b>Box 1a.</b> Shows the aggregate gross amount of payment card/third party network transactions made to you through the PSE during the calendar year.</p>
  </div>
  <div class="cover" style="flex:1">
    <p><b>Note:</b> The gross amount is the total dollar amount of total reportable payment transactions without regard to any adjustments for credits, cash equivalents, discount amounts, fees, refunded amounts, shipping amounts, or any other amounts.</p>
    <p><b>Box 1b.</b> Shows the aggregate gross amount of all reportable payment transactions where the card was not present at the time of the transaction.</p>
    <p><b>Box 2.</b> Shows the merchant category code used for payment card/third party network transactions.</p>
    <p><b>Box 3.</b> Shows the number of payment transactions (not including refund transactions) processed through the payment card/third party network.</p>
    <p><b>Box 4.</b> Shows backup withholding.</p>
    <p><b>Boxes 5a-5l.</b> Show the gross amount of payment card/third party network transactions made to you for each month of the calendar year.</p>
    <p><b>Boxes 6-8.</b> Show state and local income tax withheld from the payments.</p>
  </div>
</div>

<!-- PAGE 2: 1099-K Form -->
<div class="page2">
<table class="form">
  <colgroup><col style="width:37%"><col style="width:18%"><col style="width:18%"><col style="width:27%"></colgroup>
  <tbody>
    <tr>
      <td rowspan="4">
        <div class="lbl">FILER'S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
        <div style="font-size:10px;margin-top:4px;line-height:1.5">Kimco LLC d/b/a DonutDash<br>7205 S Broadway Ave. #400<br>Tyler, TX 75703</div>
      </td>
      <td><div class="lbl">FILER'S TIN</div><div class="val">83-4598794</div></td>
      <td><div class="lbl">OMB No. 1545-2205</div></td>
      <td rowspan="2" style="text-align:center;vertical-align:middle;padding:8px 4px">
        <div style="font-size:13px;font-weight:bold;line-height:1.3">Payment Card<br>and Third Party<br>Network<br>Transactions</div>
      </td>
    </tr>
    <tr>
      <td><div class="lbl">PAYEE'S TIN</div><div class="val">${data.shop.tax_id ? 'XX-XXX' + data.shop.tax_id.replace(/[^0-9]/g, '').slice(-4) : 'Not provided'}</div></td>
      <td style="text-align:center;vertical-align:middle;padding:6px 2px"><div style="font-size:44px;line-height:1;letter-spacing:-1px"><span style="font-weight:300">${String(year).slice(0,2)}</span><span style="font-weight:900">${String(year).slice(2)}</span></div></td>
    </tr>
    <tr>
      <td colspan="2"><div class="lbl">1a&ensp;Gross amount of payment card/third party network transactions</div><div class="val-lg">$ ${fmt(data.grossAmount).slice(1)}</div></td>
      <td style="text-align:center;vertical-align:middle"><div style="font-size:13px;font-weight:bold">Form 1099-K</div></td>
    </tr>
    <tr>
      <td><div class="lbl">1b&ensp;Card Not Present transactions</div><div style="font-size:10px;font-weight:bold;margin-top:1px">$ ${fmt(data.grossAmount).slice(1)}</div></td>
      <td><div class="lbl">2&ensp;Merchant category code</div><div class="val">5462</div></td>
      <td rowspan="2" style="vertical-align:top;padding:6px 5px;text-align:center">
        <div style="font-size:10px;font-weight:bold">Copy B</div>
        <div style="font-size:9px;font-weight:bold">For Payee</div>
        <div style="font-size:6.5px;line-height:1.3;margin-top:4px;text-align:left">This is important tax information and is being furnished to the IRS. If you are required to file a return, a negligence penalty or other sanction may be imposed on you if taxable income results from this transaction and the IRS determines that it has not been reported.</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="lbl">Check to indicate if FILER is a (an):</div>
        <div style="font-size:8px;line-height:1.7;margin-top:1px"><span class="chk">X</span> Payment settlement entity (PSE)<br><span class="chk">&nbsp;</span> Electronic Payment Facilitator (EPF)/Other third party</div>
      </td>
      <td><div class="lbl">3&ensp;Number of payment transactions</div><div class="val">${data.transactionCount.toLocaleString()}</div></td>
      <td><div class="lbl">4&ensp;Federal income tax withheld</div><div class="val">$</div></td>
    </tr>
    <tr>
      <td>
        <div class="lbl">Check to indicate transactions reported are:</div>
        <div style="font-size:8px;margin-top:1px"><span class="chk">&nbsp;</span> Payment card&ensp;&ensp;<span class="chk">X</span> Third party network</div>
      </td>
      <td><div class="lbl">5a&ensp;January</div><div class="val">$ ${mo(0)}</div></td>
      <td><div class="lbl">5b&ensp;February</div><div class="val">$ ${mo(1)}</div></td>
      <td rowspan="7" style="vertical-align:top">&nbsp;</td>
    </tr>
    <tr>
      <td rowspan="5">
        <div class="lbl">PAYEE'S name, street address (including apt. no.), city or town, state or province, country, and ZIP or foreign postal code</div>
        <div style="font-size:10px;font-weight:bold;margin-top:4px;line-height:1.5">${data.shop.name}</div>
        <div style="font-size:9px;line-height:1.5">${data.shop.address || ''}<br>${shopAddr}</div>
      </td>
      <td><div class="lbl">5c&ensp;March</div><div class="val">$ ${mo(2)}</div></td>
      <td><div class="lbl">5d&ensp;April</div><div class="val">$ ${mo(3)}</div></td>
    </tr>
    <tr><td><div class="lbl">5e&ensp;May</div><div class="val">$ ${mo(4)}</div></td><td><div class="lbl">5f&ensp;June</div><div class="val">$ ${mo(5)}</div></td></tr>
    <tr><td><div class="lbl">5g&ensp;July</div><div class="val">$ ${mo(6)}</div></td><td><div class="lbl">5h&ensp;August</div><div class="val">$ ${mo(7)}</div></td></tr>
    <tr><td><div class="lbl">5i&ensp;September</div><div class="val">$ ${mo(8)}</div></td><td><div class="lbl">5j&ensp;October</div><div class="val">$ ${mo(9)}</div></td></tr>
    <tr><td><div class="lbl">5k&ensp;November</div><div class="val">$ ${mo(10)}</div></td><td><div class="lbl">5l&ensp;December</div><div class="val">$ ${mo(11)}</div></td></tr>
    <tr>
      <td><div class="lbl">PSE'S name and telephone number</div><div class="val">Kimco LLC d/b/a DonutDash&ensp;support@donutdash.app</div></td>
      <td><div class="lbl">6&ensp;State</div><div class="val">${data.shop.state || 'TX'}</div></td>
      <td><div class="lbl">7&ensp;State identification no.</div><div class="val">&nbsp;</div></td>
      <td><div class="lbl">8&ensp;State income tax withheld</div><div class="val">$</div></td>
    </tr>
    <tr>
      <td><div class="lbl">Account number (see instructions)</div><div class="val">&nbsp;</div></td>
      <td colspan="3">&nbsp;</td>
    </tr>
  </tbody>
</table>
<div class="footer">
  <span>Form 1099-K (Rev. 3-2024)</span>
  <span>(Keep for your records)</span>
  <span>www.irs.gov/Form1099K</span>
  <span>Department of the Treasury - Internal Revenue Service</span>
</div>
<div style="font-size:6.5px;color:#666;text-align:center;margin-top:12px;border-top:1px solid #ccc;padding-top:5px">
  This is an informational summary generated by DonutDash for tax year ${year}. This document is provided for your records and may differ from the official IRS Form 1099-K.<br>
  Consult your tax professional for filing requirements. Generated on ${new Date().toLocaleDateString()}.
</div>
</div>
</body></html>`
}

export default function TaxForms() {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [data, setData] = useState<TaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailAddr, setEmailAddr] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/shop/tax-forms?year=${year}`)
      .then(r => r.json())
      .then(d => { if (d.grossAmount !== undefined) setData(d) })
      .finally(() => setLoading(false))
  }, [year])

  const handlePrint = () => {
    if (!data) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(build1099K(data, year))
    w.document.close()
    w.print()
  }

  const handleEmail = async () => {
    if (!data || !emailAddr) return
    setEmailing(true)
    setEmailSent(false)
    const html = build1099K(data, year)
    const res = await fetch('/api/shop/email-form', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, subject: `1099-K Tax Form — ${data.shop.name} — Tax Year ${year}`, email: emailAddr }),
    })
    setEmailing(false)
    if (res.ok) { setEmailSent(true); setTimeout(() => { setEmailSent(false); setShowEmailModal(false) }, 2000) }
    else alert('Failed to send email. Please try again.')
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
                        <td style={{ padding: '10px 16px', fontWeight: 600, border: 'none' }}>{MONTHS[i]}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: amt > 0 ? '#FF1493' : '#ccc', border: 'none' }}>{amt > 0 ? fmt(amt) : '—'}</td>
                        <td style={{ padding: '10px 16px', border: 'none' }}>
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
                    <td style={{ padding: '12px 16px', border: 'none' }}>Total</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#FF1493', border: 'none' }}>{fmt(data.grossAmount)}</td>
                    <td style={{ border: 'none' }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Download / Print / Email */}
          <div style={{ ...card, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>1099-K Form — Tax Year {year}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Print, save as PDF, or email to yourself</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handlePrint} style={{ padding: '10px 20px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  🖨️ Print / Save PDF
                </button>
                <button onClick={() => setShowEmailModal(true)} style={{ padding: '10px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  📧 Email
                </button>
              </div>
            </div>
          </div>

          {/* Email modal */}
          {showEmailModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={() => setShowEmailModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Email 1099-K Form</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>Send the {year} 1099-K form to your email or your CPA</p>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Email Address</label>
                <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} placeholder="you@example.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleEmail} disabled={emailing || !emailAddr}
                    style={{ flex: 1, padding: '12px 20px', borderRadius: 8, background: emailSent ? '#10B981' : '#6366F1', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14, opacity: emailing || !emailAddr ? 0.5 : 1 }}>
                    {emailSent ? '✓ Sent!' : emailing ? 'Sending...' : '📧 Send Email'}
                  </button>
                  <button onClick={() => setShowEmailModal(false)}
                    style={{ padding: '12px 20px', borderRadius: 8, background: '#f5f5f5', color: '#666', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
