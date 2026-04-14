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
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>1099-K ${year} - ${data?.shop.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;padding:0.4in 0.5in;color:#000;background:#fff;font-size:9px;line-height:1.25}
@media print{body{padding:0.3in 0.4in}@page{margin:0.4in;size:letter}}
table{border-collapse:collapse;width:100%}
td{border:1px solid #000;padding:3px 5px;vertical-align:top;font-size:9px}
.lbl{font-size:6.5px;line-height:1.2;color:#000}
.val{font-size:9px;margin-top:1px}
.val-lg{font-size:12px;font-weight:bold;margin-top:2px}
.val-xl{font-size:26px;font-weight:bold;line-height:1}
.nb{border:none}
.bt{border-top:1px solid #000}
.br{border-right:1px solid #000}
.bl{border-left:1px solid #000}
.bb{border-bottom:1px solid #000}
.b0{border:none}
.chk{display:inline-block;width:10px;height:10px;border:1.5px solid #000;text-align:center;font-size:9px;font-weight:bold;line-height:9px;margin-right:2px;vertical-align:middle}
.right-col{font-size:6.5px;line-height:1.3}
.footer{font-size:7px;margin-top:4px;display:flex;justify-content:space-between}
h4{font-size:11px;margin-bottom:6px}
.instructions{font-size:7px;line-height:1.45}
.instructions p{margin-top:4px}
.page2{page-break-before:always}
</style></head><body>${formRef.current.innerHTML}</body></html>`)
    w.document.close()
    w.print()
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

          {/* Printable 1099-K — hidden, used by print */}
          <div ref={formRef} style={{ position: 'fixed', left: '-9999px', top: 0, width: 0, height: 0, overflow: 'hidden' }}>
            {/* ——— PAGE 1 : Cover Letter ——— */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, lineHeight: 1.5 }}>DonutDash Inc.<br/>donutdash.app<br/>Tyler, TX</div>
              <div style={{ fontSize: 8, textAlign: 'right' }}>If you have questions contact:<br/>support@donutdash.app</div>
            </div>
            <div style={{ margin: '50px 0 50px 60px', fontSize: 11, lineHeight: 1.6 }}>
              <b>{data.shop.name}</b><br/>{data.shop.address}<br/>{[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 30 }}>
              <div style={{ flex: 1 }}>
                <h4>Instructions for Payee</h4>
                <div className="instructions">
                  <p>You have received this form because you have either (a) accepted payment cards for payments, or (b) received payments through a third party network in the calendar year reported on this form.</p>
                  <p>Merchant acquirers and third party settlement organizations, as payment settlement entities (PSEs), must report the proceeds of payment card and third party network transactions made to you on Form 1099-K under Internal Revenue Code section 6050W.</p>
                  <p><b>Payee&apos;s taxpayer identification number (TIN).</b> For your protection, this form may show only the last four digits of your TIN.</p>
                  <p><b>Account number.</b> May show an account number or other unique number the PSE assigned to distinguish your account.</p>
                  <p><b>Box 1a.</b> Shows the aggregate gross amount of payment card/third party network transactions made to you through the PSE during the calendar year.</p>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="instructions">
                  <p><b>Note:</b> The gross amount is the total dollar amount of total reportable payment transactions without regard to any adjustments for credits, cash equivalents, discount amounts, fees, refunded amounts, shipping amounts, or any other amounts.</p>
                  <p><b>Box 1b.</b> Shows the aggregate gross amount of all reportable payment transactions where the card was not present at the time of the transaction.</p>
                  <p><b>Box 2.</b> Shows the merchant category code used for payment card/third party network transactions.</p>
                  <p><b>Box 3.</b> Shows the number of payment transactions (not including refund transactions) processed through the payment card/third party network.</p>
                  <p><b>Box 4.</b> Shows backup withholding.</p>
                  <p><b>Boxes 5a-5l.</b> Show the gross amount of payment card/third party network transactions made to you for each month of the calendar year.</p>
                  <p><b>Boxes 6-8.</b> Show state and local income tax withheld from the payments.</p>
                </div>
              </div>
            </div>

            {/* ——— PAGE 2 : 1099-K Form ——— */}
            <div className="page2">
            {(() => {
              const mo = (i: number) => data.monthly[i] > 0 ? fmt(data.monthly[i]).slice(1) : '0.00'
              const corrected = false
              return (
              <table style={{ border: '2px solid #000' }}>
                <colgroup>
                  <col style={{ width: '37%' }}/>
                  <col style={{ width: '18%' }}/>
                  <col style={{ width: '18%' }}/>
                  <col style={{ width: '27%' }}/>
                </colgroup>
                <tbody>
                  {/* R1 */}
                  <tr>
                    <td rowSpan={4} style={{ verticalAlign: 'top' }}>
                      <div className="lbl">FILER&apos;S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
                      <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
                        DonutDash Inc.<br/>donutdash.app<br/>Tyler, TX
                      </div>
                    </td>
                    <td>
                      <div className="lbl">FILER&apos;S TIN</div>
                      <div className="val">XX-XXXXXXX</div>
                    </td>
                    <td><div className="lbl">OMB No. 1545-2205</div></td>
                    <td rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>Payment Card<br/>and Third Party<br/>Network<br/>Transactions</div>
                    </td>
                  </tr>
                  {/* R2 */}
                  <tr>
                    <td>
                      <div className="lbl">PAYEE&apos;S TIN</div>
                      <div className="val">XX-XXX****</div>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '2px' }}>
                      <div className="val-xl">{year}</div>
                    </td>
                  </tr>
                  {/* R3 */}
                  <tr>
                    <td colSpan={2}>
                      <div className="lbl">1a&ensp;Gross amount of payment card/third party network transactions</div>
                      <div className="val-lg">$ {fmt(data.grossAmount).slice(1)}</div>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Form 1099-K</div>
                    </td>
                  </tr>
                  {/* R4 */}
                  <tr>
                    <td>
                      <div className="lbl">1b&ensp;Card Not Present transactions</div>
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 1 }}>$ {fmt(data.grossAmount).slice(1)}</div>
                    </td>
                    <td>
                      <div className="lbl">2&ensp;Merchant category code</div>
                      <div className="val">5462</div>
                    </td>
                    <td rowSpan={2} style={{ verticalAlign: 'top', padding: '6px 5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>Copy B</div>
                      <div style={{ fontSize: 9, fontWeight: 700 }}>For Payee</div>
                      <div className="right-col" style={{ marginTop: 4, textAlign: 'left' }}>
                        This is important tax information and is being furnished to the IRS. If you are required to file a return, a negligence penalty or other sanction may be imposed on you if taxable income results from this transaction and the IRS determines that it has not been reported.
                      </div>
                    </td>
                  </tr>
                  {/* R5 : checkboxes + 3 + 4 */}
                  <tr>
                    <td>
                      <div className="lbl">Check to indicate if FILER is a (an):</div>
                      <div style={{ fontSize: 8, lineHeight: 1.7, marginTop: 1 }}>
                        <span className="chk">X</span> Payment settlement entity (PSE)<br/>
                        <span className="chk">&nbsp;</span> Electronic Payment Facilitator (EPF)/Other third party
                      </div>
                    </td>
                    <td>
                      <div className="lbl">3&ensp;Number of payment transactions</div>
                      <div className="val">{data.transactionCount.toLocaleString()}</div>
                    </td>
                    <td>
                      <div className="lbl">4&ensp;Federal income tax withheld</div>
                      <div className="val">$</div>
                    </td>
                  </tr>
                  {/* R6 : report-type checkboxes + 5a + 5b */}
                  <tr>
                    <td>
                      <div className="lbl">Check to indicate transactions reported are:</div>
                      <div style={{ fontSize: 8, marginTop: 1 }}>
                        <span className="chk">&nbsp;</span> Payment card&ensp;&ensp;
                        <span className="chk">X</span> Third party network
                      </div>
                    </td>
                    <td><div className="lbl">5a&ensp;January</div><div className="val">$ {mo(0)}</div></td>
                    <td><div className="lbl">5b&ensp;February</div><div className="val">$ {mo(1)}</div></td>
                    <td rowSpan={7} className="b0" style={{ border: '1px solid #000', verticalAlign: 'top' }}>&nbsp;</td>
                  </tr>
                  {/* R7-R12 : PAYEE address + months */}
                  <tr>
                    <td rowSpan={5} style={{ verticalAlign: 'top' }}>
                      <div className="lbl">PAYEE&apos;S name, street address (including apt. no.), city or town, state or province, country, and ZIP or foreign postal code</div>
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>{data.shop.name}</div>
                      <div style={{ fontSize: 9, lineHeight: 1.5 }}>
                        {data.shop.address}<br/>
                        {[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td><div className="lbl">5c&ensp;March</div><div className="val">$ {mo(2)}</div></td>
                    <td><div className="lbl">5d&ensp;April</div><div className="val">$ {mo(3)}</div></td>
                  </tr>
                  <tr>
                    <td><div className="lbl">5e&ensp;May</div><div className="val">$ {mo(4)}</div></td>
                    <td><div className="lbl">5f&ensp;June</div><div className="val">$ {mo(5)}</div></td>
                  </tr>
                  <tr>
                    <td><div className="lbl">5g&ensp;July</div><div className="val">$ {mo(6)}</div></td>
                    <td><div className="lbl">5h&ensp;August</div><div className="val">$ {mo(7)}</div></td>
                  </tr>
                  <tr>
                    <td><div className="lbl">5i&ensp;September</div><div className="val">$ {mo(8)}</div></td>
                    <td><div className="lbl">5j&ensp;October</div><div className="val">$ {mo(9)}</div></td>
                  </tr>
                  <tr>
                    <td><div className="lbl">5k&ensp;November</div><div className="val">$ {mo(10)}</div></td>
                    <td><div className="lbl">5l&ensp;December</div><div className="val">$ {mo(11)}</div></td>
                  </tr>
                  {/* PSE row */}
                  <tr>
                    <td>
                      <div className="lbl">PSE&apos;S name and telephone number</div>
                      <div className="val">DonutDash Inc.&ensp;support@donutdash.app</div>
                    </td>
                    <td><div className="lbl">6&ensp;State</div><div className="val">{data.shop.state || 'TX'}</div></td>
                    <td><div className="lbl">7&ensp;State identification no.</div><div className="val">&nbsp;</div></td>
                    <td><div className="lbl">8&ensp;State income tax withheld</div><div className="val">$</div></td>
                  </tr>
                  {/* Account row */}
                  <tr>
                    <td>
                      <div className="lbl">Account number (see instructions)</div>
                      <div className="val">&nbsp;</div>
                    </td>
                    <td colSpan={3}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              )
            })()}

            <div className="footer">
              <span>Form 1099-K (Rev. 3-2024)</span>
              <span>(Keep for your records)</span>
              <span>www.irs.gov/Form1099K</span>
              <span>Department of the Treasury - Internal Revenue Service</span>
            </div>
            <div style={{ fontSize: 6.5, color: '#666', textAlign: 'center', marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 5 }}>
              This is an informational summary generated by DonutDash for tax year {year}. This document is provided for your records and may differ from the official IRS Form 1099-K.<br/>
              Consult your tax professional for filing requirements. Generated on {new Date().toLocaleDateString()}.
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
