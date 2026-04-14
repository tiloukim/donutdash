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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 30px 40px; color: #000; background: #fff; font-size: 11px; line-height: 1.3; }
        @media print { body { padding: 20px 30px; } @page { margin: 0.5in; } }
        .form-box { border: 2px solid #000; }
        .cell { border: 1px solid #000; padding: 4px 6px; }
        .label { font-size: 8px; color: #000; }
        .value { font-size: 12px; margin-top: 2px; }
        .value-lg { font-size: 14px; font-weight: bold; margin-top: 2px; }
        .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; font-size: 10px; line-height: 12px; margin-right: 3px; vertical-align: middle; }
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

          {/* Printable 1099-K form — matches official IRS layout */}
          <div ref={formRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: 750, margin: '0 auto', color: '#000', fontSize: 11 }}>

              {/* === PAGE 1: Cover letter with payee address === */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 11, lineHeight: 1.4, marginBottom: 30 }}>
                  DonutDash Inc.<br/>
                  donutdash.app<br/>
                  Tyler, TX<br/>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, marginBottom: 30 }}>
                  If you have questions contact:<br/>
                  support@donutdash.app
                </div>
                <div style={{ marginTop: 40, marginBottom: 60, paddingLeft: 60, fontSize: 12, lineHeight: 1.6 }}>
                  {data.shop.name}<br/>
                  {data.shop.address || ''}<br/>
                  {[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
                </div>
                <div style={{ marginTop: 30 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Instructions for Payee</div>
                  <div style={{ fontSize: 9, lineHeight: 1.5, columnCount: 2, columnGap: 24 }}>
                    <p>You have received this form because you have either (a) accepted payment cards for payments, or (b) received payments through a third party network in the calendar year reported on this form.</p>
                    <p style={{ marginTop: 6 }}><b>Note:</b> The gross amount is the total dollar amount of total reportable payment transactions without regard to any adjustments for credits, cash equivalents, discount amounts, fees, refunded amounts, shipping amounts, or any other amounts.</p>
                    <p style={{ marginTop: 6 }}><b>Box 1a.</b> Shows the aggregate gross amount of payment card/third party network transactions made to you through the PSE during the calendar year.</p>
                    <p style={{ marginTop: 6 }}><b>Box 1b.</b> Shows the aggregate gross amount of all reportable payment transactions where the card was not present at the time of the transaction or the card number was keyed into the terminal.</p>
                    <p style={{ marginTop: 6 }}><b>Box 2.</b> Shows the merchant category code used for payment card/third party network transactions.</p>
                    <p style={{ marginTop: 6 }}><b>Box 3.</b> Shows the number of payment transactions (not including refund transactions) processed through the payment card/third party network.</p>
                    <p style={{ marginTop: 6 }}><b>Box 4.</b> Shows backup withholding.</p>
                    <p style={{ marginTop: 6 }}><b>Boxes 5a-5l.</b> Show the gross amount of payment card/third party network transactions made to you for each month of the calendar year.</p>
                    <p style={{ marginTop: 6 }}><b>Boxes 6-8.</b> Show state and local income tax withheld from the payments.</p>
                  </div>
                </div>
              </div>

              <div style={{ pageBreakBefore: 'always' }}></div>

              {/* === PAGE 2: The actual 1099-K form === */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', tableLayout: 'fixed' }} cellPadding={0} cellSpacing={0}>
                {/* Row 1: FILER info + FILER TIN + OMB + Title */}
                <tbody>
                <tr>
                  <td colSpan={4} rowSpan={3} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top', width: '38%' }}>
                    <div style={{ fontSize: 8 }}>FILER&apos;S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
                    <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                      DonutDash Inc.<br/>
                      Tyler, TX<br/>
                      donutdash.app
                    </div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top', width: '20%' }}>
                    <div style={{ fontSize: 8 }}>FILER&apos;S TIN</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>XX-XXXXXXX</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top', fontSize: 8, width: '14%' }}>
                    OMB No. 1545-2205
                  </td>
                  <td colSpan={4} rowSpan={4} style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top', textAlign: 'center', width: '28%' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>Payment Card<br/>and Third Party<br/>Network<br/>Transactions</div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>PAYEE&apos;S TIN</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>XX-XXX{data.owner.name ? data.owner.name.slice(-4) : 'XXXX'}</div>
                  </td>
                  <td colSpan={2} rowSpan={2} style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{year}</div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>1a&nbsp; Gross amount of payment card/third party network transactions</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>$ {fmt(data.grossAmount).slice(1)}</div>
                  </td>
                </tr>
                {/* Row: 1b + 2 Merchant code */}
                <tr>
                  <td colSpan={4} rowSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8, marginBottom: 4 }}>Check to indicate if FILER is a (an):</div>
                    <div style={{ fontSize: 9, lineHeight: 1.8 }}>
                      <span className="checkbox">X</span> Payment settlement entity (PSE)<br/>
                      <span className="checkbox">&nbsp;</span> Electronic Payment Facilitator (EPF)/Other third party
                    </div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>1b&nbsp; Card Not Present transactions</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>$ {fmt(data.grossAmount).slice(1)}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>2&nbsp; Merchant category code</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>5462</div>
                  </td>
                  <td colSpan={4} rowSpan={2} style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Form 1099-K</div>
                    <div style={{ fontSize: 10, marginTop: 6, fontWeight: 700 }}>Copy B<br/>For Payee</div>
                    <div style={{ fontSize: 8, marginTop: 6, lineHeight: 1.4, textAlign: 'left' }}>
                      This is important tax information and is being furnished to the IRS. If you are required to file a return, a negligence penalty or other sanction may be imposed on you if taxable income results from this transaction and the IRS determines that it has not been reported.
                    </div>
                  </td>
                </tr>
                {/* Row: Check reported + 3 + 4 */}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>3&nbsp; Number of payment transactions</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{data.transactionCount.toLocaleString()}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>4&nbsp; Federal income tax withheld</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$</div>
                  </td>
                </tr>
                {/* Row: Check reported type + PAYEE address + 5a Jan + 5b Feb */}
                <tr>
                  <td colSpan={4} rowSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8, marginBottom: 2 }}>Check to indicate transactions reported are:</div>
                    <div style={{ fontSize: 9, lineHeight: 1.8 }}>
                      <span className="checkbox">&nbsp;</span> Payment card&nbsp;&nbsp;&nbsp;&nbsp;
                      <span className="checkbox">X</span> Third party network
                    </div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5a&nbsp; January</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[0] > 0 ? fmt(data.monthly[0]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5b&nbsp; February</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[1] > 0 ? fmt(data.monthly[1]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={4} rowSpan={8} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>&nbsp;</td>
                </tr>
                {/* PAYEE name/address + 5c Mar + 5d Apr */}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5c&nbsp; March</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[2] > 0 ? fmt(data.monthly[2]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5d&nbsp; April</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[3] > 0 ? fmt(data.monthly[3]).slice(1) : '0.00'}</div>
                  </td>
                </tr>
                {/* PAYEE address continued + 5e May + 5f Jun */}
                <tr>
                  <td colSpan={4} rowSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>PAYEE&apos;S name, street address (including apt. no.), city or town, state or province, country, and ZIP or foreign postal code</div>
                    <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                      <b>{data.shop.name}</b><br/>
                      {data.shop.address || ''}<br/>
                      {[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
                    </div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5e&nbsp; May</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[4] > 0 ? fmt(data.monthly[4]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5f&nbsp; June</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[5] > 0 ? fmt(data.monthly[5]).slice(1) : '0.00'}</div>
                  </td>
                </tr>
                {/* 5g Jul + 5h Aug */}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5g&nbsp; July</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[6] > 0 ? fmt(data.monthly[6]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5h&nbsp; August</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[7] > 0 ? fmt(data.monthly[7]).slice(1) : '0.00'}</div>
                  </td>
                </tr>
                {/* 5i Sep + 5j Oct */}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5i&nbsp; September</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[8] > 0 ? fmt(data.monthly[8]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5j&nbsp; October</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[9] > 0 ? fmt(data.monthly[9]).slice(1) : '0.00'}</div>
                  </td>
                </tr>
                {/* 5k Nov + 5l Dec */}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5k&nbsp; November</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[10] > 0 ? fmt(data.monthly[10]).slice(1) : '0.00'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>5l&nbsp; December</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$ {data.monthly[11] > 0 ? fmt(data.monthly[11]).slice(1) : '0.00'}</div>
                  </td>
                </tr>
                {/* PSE name + 6 State + 7 State ID */}
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>PSE&apos;S name and telephone number</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>DonutDash Inc. support@donutdash.app</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>6&nbsp; State</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{data.shop.state || 'TX'}</div>
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>7&nbsp; State identification no.</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>&nbsp;</div>
                  </td>
                </tr>
                {/* Account number + 8 State income tax */}
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>Account number (see instructions)</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>&nbsp;</div>
                  </td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 8 }}>8&nbsp; State income tax withheld</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>$</div>
                  </td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top' }}>&nbsp;</td>
                </tr>
                </tbody>
              </table>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9 }}>
                <span>Form 1099-K (Rev. 3-2024)</span>
                <span>(Keep for your records)</span>
                <span>www.irs.gov/Form1099K</span>
                <span>Department of the Treasury - Internal Revenue Service</span>
              </div>

              <div style={{ fontSize: 8, color: '#666', textAlign: 'center', marginTop: 20, borderTop: '1px solid #ccc', paddingTop: 8 }}>
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
