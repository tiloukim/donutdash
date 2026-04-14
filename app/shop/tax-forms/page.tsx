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
            <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', width: 720, margin: '0 auto', color: '#000', fontSize: 10, lineHeight: 1.3 }}>

              {/* === PAGE 1: Cover letter === */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
                  <div style={{ fontSize: 10, lineHeight: 1.5 }}>DonutDash Inc.<br/>donutdash.app<br/>Tyler, TX</div>
                  <div style={{ fontSize: 9, textAlign: 'right' }}>If you have questions contact:<br/>support@donutdash.app</div>
                </div>
                <div style={{ margin: '50px 0 50px 60px', fontSize: 12, lineHeight: 1.6 }}>
                  <b>{data.shop.name}</b><br/>{data.shop.address || ''}<br/>{[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Instructions for Payee</div>
                    <div style={{ fontSize: 8, lineHeight: 1.5 }}>
                      <p>You have received this form because you have either (a) accepted payment cards for payments, or (b) received payments through a third party network in the calendar year reported on this form.</p>
                      <p style={{ marginTop: 5 }}>Merchant acquirers and third party settlement organizations, as payment settlement entities (PSEs), must report the proceeds of payment card and third party network transactions made to you on Form 1099-K under Internal Revenue Code section 6050W.</p>
                      <p style={{ marginTop: 5 }}><b>Payee&apos;s taxpayer identification number (TIN).</b> For your protection, this form may show only the last four digits of your TIN.</p>
                      <p style={{ marginTop: 5 }}><b>Account number.</b> May show an account number or other unique number the PSE assigned to distinguish your account.</p>
                      <p style={{ marginTop: 5 }}><b>Box 1a.</b> Shows the aggregate gross amount of payment card/third party network transactions made to you through the PSE during the calendar year.</p>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, lineHeight: 1.5 }}>
                      <p><b>Note:</b> The gross amount is the total dollar amount of total reportable payment transactions without regard to any adjustments for credits, cash equivalents, discount amounts, fees, refunded amounts, shipping amounts, or any other amounts. The dollar amount of each transaction is determined on the date of the transaction.</p>
                      <p style={{ marginTop: 5 }}><b>Box 1b.</b> Shows the aggregate gross amount of all reportable payment transactions where the card was not present at the time of the transaction or the card number was keyed into the terminal. Typically, this refers to online sales, phone sales, or catalogue sales.</p>
                      <p style={{ marginTop: 5 }}><b>Box 2.</b> Shows the merchant category code used for payment card/third party network transactions (if available) reported on this form.</p>
                      <p style={{ marginTop: 5 }}><b>Box 3.</b> Shows the number of payment transactions (not including refund transactions) processed through the payment card/third party network.</p>
                      <p style={{ marginTop: 5 }}><b>Box 4.</b> Shows backup withholding.</p>
                      <p style={{ marginTop: 5 }}><b>Boxes 5a-5l.</b> Show the gross amount of payment card/third party network transactions made to you for each month of the calendar year.</p>
                      <p style={{ marginTop: 5 }}><b>Boxes 6-8.</b> Show state and local income tax withheld from the payments.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ pageBreakBefore: 'always' }}></div>

              {/* === PAGE 2: The 1099-K form — clean grid layout === */}
              {(() => {
                const b = '1px solid #000'
                const cell = (extra?: React.CSSProperties): React.CSSProperties => ({ border: b, padding: '3px 5px', ...extra })
                const lbl: React.CSSProperties = { fontSize: 7, color: '#000', lineHeight: 1.2 }
                const val: React.CSSProperties = { fontSize: 10, marginTop: 1 }
                const valBig: React.CSSProperties = { fontSize: 13, fontWeight: 700, marginTop: 2 }
                const chk = (checked: boolean) => `[${checked ? 'X' : ' '}]`
                const mo = (i: number) => data.monthly[i] > 0 ? fmt(data.monthly[i]).slice(1) : '0.00'

                return (
                  <div style={{ border: '2px solid #000', width: 720 }}>
                    {/* Row 1 */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ ...cell({ width: 270, borderRight: b }) }}>
                        <div style={lbl}>FILER&apos;S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
                        <div style={{ ...val, lineHeight: 1.4, marginTop: 3 }}>DonutDash Inc.<br/>Tyler, TX<br/>donutdash.app</div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex' }}>
                          <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                            <div style={lbl}>FILER&apos;S TIN</div>
                            <div style={val}>XX-XXXXXXX</div>
                          </div>
                          <div style={{ ...cell({ width: 90, borderRight: b }) }}>
                            <div style={{ fontSize: 7 }}>OMB No. 1545-2205</div>
                          </div>
                          <div style={{ ...cell({ width: 180 }), textAlign: 'center', padding: '8px 5px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>Payment Card<br/>and Third Party<br/>Network<br/>Transactions</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <div style={{ ...cell({ flex: 1, borderRight: b, borderTop: b }) }}>
                            <div style={lbl}>PAYEE&apos;S TIN</div>
                            <div style={val}>XX-XXX****</div>
                          </div>
                          <div style={{ ...cell({ width: 90, borderRight: b, borderTop: b }), textAlign: 'center', padding: '4px' }}>
                            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{year}</div>
                          </div>
                          <div style={{ width: 180, borderTop: b, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ ...cell({ borderBottom: 'none' }), textAlign: 'center' }}>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>Form 1099-K</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <div style={{ ...cell({ flex: 1, borderRight: b, borderTop: b }) }}>
                            <div style={lbl}>1a Gross amount of payment card/third party network transactions</div>
                            <div style={valBig}>$ {fmt(data.grossAmount).slice(1)}</div>
                          </div>
                          <div style={{ width: 270, borderTop: b, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ ...cell({}), textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 700 }}>Copy B</div>
                              <div style={{ fontSize: 8, fontWeight: 700 }}>For Payee</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Checkboxes + 1b + 2 */}
                    <div style={{ display: 'flex', borderTop: b }}>
                      <div style={{ ...cell({ width: 270, borderRight: b }) }}>
                        <div style={lbl}>Check to indicate if FILER is a (an):</div>
                        <div style={{ fontSize: 8, lineHeight: 1.7, marginTop: 2 }}>
                          {chk(true)} Payment settlement entity (PSE)<br/>
                          {chk(false)} Electronic Payment Facilitator (EPF)/Other third party
                        </div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex' }}>
                          <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                            <div style={lbl}>1b Card Not Present transactions</div>
                            <div style={{ ...val, fontWeight: 700 }}>$ {fmt(data.grossAmount).slice(1)}</div>
                          </div>
                          <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                            <div style={lbl}>2 Merchant category code</div>
                            <div style={val}>5462</div>
                          </div>
                          <div style={{ width: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderLeft: 'none' }}>
                            <div style={{ fontSize: 7, lineHeight: 1.4, textAlign: 'left' }}>
                              This is important tax information and is being furnished to the IRS.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Report type checkboxes + 3 + 4 */}
                    <div style={{ display: 'flex', borderTop: b }}>
                      <div style={{ ...cell({ width: 270, borderRight: b }) }}>
                        <div style={lbl}>Check to indicate transactions reported are:</div>
                        <div style={{ fontSize: 8, marginTop: 2 }}>
                          {chk(false)} Payment card&nbsp;&nbsp;&nbsp;{chk(true)} Third party network
                        </div>
                      </div>
                      <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                        <div style={lbl}>3 Number of payment transactions</div>
                        <div style={val}>{data.transactionCount.toLocaleString()}</div>
                      </div>
                      <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                        <div style={lbl}>4 Federal income tax withheld</div>
                        <div style={val}>$</div>
                      </div>
                      <div style={{ width: 180 }}></div>
                    </div>

                    {/* Months 5a-5l: left side = PAYEE info, right = month pairs */}
                    {[
                      [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]
                    ].map(([a, b2], rowIdx) => (
                      <div key={rowIdx} style={{ display: 'flex', borderTop: b }}>
                        {rowIdx === 0 ? (
                          <div style={{ ...cell({ width: 270, borderRight: b }), minHeight: 24 * 6 }}>
                            <div style={lbl}>PAYEE&apos;S name, street address (including apt. no.), city or town, state or province, country, and ZIP or foreign postal code</div>
                            <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5, fontWeight: 700 }}>
                              {data.shop.name}
                            </div>
                            <div style={{ fontSize: 10, lineHeight: 1.5 }}>
                              {data.shop.address || ''}<br/>
                              {[data.shop.city, data.shop.state, data.shop.zip].filter(Boolean).join(', ')}
                            </div>
                          </div>
                        ) : rowIdx === 1 ? null : rowIdx === 2 ? null : rowIdx === 3 ? null : rowIdx === 4 ? null : null}
                        {rowIdx > 0 && <div style={{ width: 270, borderRight: b }}></div>}
                        <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                          <div style={lbl}>{'5' + String.fromCharCode(97 + a)} {MONTHS[a]}</div>
                          <div style={val}>$ {mo(a)}</div>
                        </div>
                        <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                          <div style={lbl}>{'5' + String.fromCharCode(97 + b2)} {MONTHS[b2]}</div>
                          <div style={val}>$ {mo(b2)}</div>
                        </div>
                        <div style={{ width: 180 }}></div>
                      </div>
                    ))}

                    {/* PSE + State */}
                    <div style={{ display: 'flex', borderTop: b }}>
                      <div style={{ ...cell({ width: 270, borderRight: b }) }}>
                        <div style={lbl}>PSE&apos;S name and telephone number</div>
                        <div style={val}>DonutDash Inc. support@donutdash.app</div>
                      </div>
                      <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                        <div style={lbl}>6 State</div>
                        <div style={val}>{data.shop.state || 'TX'}</div>
                      </div>
                      <div style={{ ...cell({ flex: 1, borderRight: b }) }}>
                        <div style={lbl}>7 State identification no.</div>
                        <div style={val}>&nbsp;</div>
                      </div>
                      <div style={{ ...cell({ width: 180 }) }}>
                        <div style={lbl}>8 State income tax withheld</div>
                        <div style={val}>$</div>
                      </div>
                    </div>

                    {/* Account number */}
                    <div style={{ display: 'flex', borderTop: b }}>
                      <div style={{ ...cell({ width: 270, borderRight: b }) }}>
                        <div style={lbl}>Account number (see instructions)</div>
                        <div style={val}>&nbsp;</div>
                      </div>
                      <div style={{ ...cell({ flex: 1 }) }}>&nbsp;</div>
                    </div>
                  </div>
                )
              })()}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8 }}>
                <span>Form 1099-K (Rev. 3-2024)</span>
                <span>(Keep for your records)</span>
                <span>www.irs.gov/Form1099K</span>
                <span>Department of the Treasury - Internal Revenue Service</span>
              </div>

              <div style={{ fontSize: 7, color: '#666', textAlign: 'center', marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 6 }}>
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
