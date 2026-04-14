'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const EXPENSE_CATEGORIES = [
  'Supplies - Flour/Mix', 'Supplies - Sugar/Glaze', 'Supplies - Oil/Shortening',
  'Supplies - Boxes/Packaging', 'Supplies - Other Ingredients', 'Supplies - General',
  'Rent/Lease', 'Electricity', 'Gas', 'Water', 'Internet/Phone',
  'Insurance', 'Payroll', 'Payroll Taxes',
  'Equipment', 'Maintenance/Repairs', 'Cleaning Supplies',
  'Credit Card Fees', 'Bank Fees', 'Loan Payment',
  'Vehicle/Fuel', 'Advertising', 'Professional Services', 'Other',
]
const INCOME_CATEGORIES = ['DonutDash Sales', 'Walk-in Sales', 'Catering', 'Wholesale', 'Other Income']

type Entry = {
  id: string; type: 'income' | 'expense'; date: string; description: string;
  amount: number; category: string; source: string; notes: string | null
}

type OrdersByMonth = Record<number, { count: number; total: number }>

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, width: '100%' }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }

export default function ShopBookkeeping() {
  const [tab, setTab] = useState<'dashboard' | 'income' | 'expenses'>('dashboard')
  const [year, setYear] = useState(new Date().getFullYear())
  const [entries, setEntries] = useState<Entry[]>([])
  const [ordersByMonth, setOrdersByMonth] = useState<OrdersByMonth>({})
  const [loading, setLoading] = useState(true)

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))
  const [fDesc, setFDesc] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fCat, setFCat] = useState(EXPENSE_CATEGORIES[0])
  const [fSource, setFSource] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterMonth, setFilterMonth] = useState<number | null>(null)

  // Receipt scanner
  const receiptRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ date: string; desc: string; amount: string; category: string } | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Store name → category mapping for auto-categorization
  const storeCatMap: [string[], string, string][] = [
    [['WALMART', 'WAL-MART', 'WAL MART', 'WM SUPERCENTER'], 'Walmart', 'Supplies - General'],
    [['SAM\'S CLUB', 'SAMS CLUB', 'SAM\'S'], 'Sam\'s Club', 'Supplies - General'],
    [['COSTCO'], 'Costco', 'Supplies - General'],
    [['DAWN FOOD', 'DAWN FOODS'], 'Dawn Food Products', 'Supplies - Flour/Mix'],
    [['SYSCO'], 'Sysco', 'Supplies - Other Ingredients'],
    [['US FOODS', 'USFOODS'], 'US Foods', 'Supplies - Other Ingredients'],
    [['HOME DEPOT'], 'Home Depot', 'Maintenance/Repairs'],
    [['LOWE\'S', 'LOWES'], 'Lowe\'s', 'Maintenance/Repairs'],
    [['DOLLAR TREE', 'DOLLAR GENERAL'], 'Dollar Store', 'Cleaning Supplies'],
    [['BROOKSHIRE'], 'Brookshire\'s', 'Supplies - General'],
    [['ULINE'], 'Uline', 'Supplies - Boxes/Packaging'],
  ]

  const scanReceipt = async (file: File) => {
    setScanning(true)
    setScanResult(null)
    setReceiptPreview(URL.createObjectURL(file))
    setShowReceiptModal(true)
    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data: { text } } = await Tesseract.recognize(file, 'eng')
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)
      const fullText = lines.join(' ').toUpperCase()

      // 1. Extract store name + auto-category
      let desc = '', cat = 'Other'
      for (const [keywords, storeName, category] of storeCatMap) {
        if (keywords.some(k => fullText.includes(k))) { desc = storeName; cat = category; break }
      }
      if (!desc && lines.length > 0) desc = lines[0].replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim().slice(0, 40)

      // 2. Extract date
      let date = new Date().toISOString().slice(0, 10)
      const monthNames: Record<string, string> = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' }
      let dateFound = false
      for (const line of lines) {
        if (dateFound) break
        const mName = line.match(/(\w{3})\s+(\d{1,2}),?\s*(20\d{2})/i)
        if (mName) { const mo = monthNames[mName[1].toUpperCase()]; if (mo) { date = `${mName[3]}-${mo}-${mName[2].padStart(2, '0')}`; dateFound = true; continue } }
        const mISO = line.match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
        if (mISO) { date = `${mISO[1]}-${mISO[2].padStart(2, '0')}-${mISO[3].padStart(2, '0')}`; dateFound = true; continue }
        const datePatterns = [/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/, /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/]
        for (const pat of datePatterns) {
          const m = line.match(pat)
          if (m) { const yr = m[3].length === 2 ? '20' + m[3] : m[3]; const mo = m[1].padStart(2, '0'); const dy = m[2].padStart(2, '0'); if (parseInt(mo) <= 12 && parseInt(dy) <= 31) { date = `${yr}-${mo}-${dy}`; dateFound = true; break } }
        }
      }

      // 3. Extract total amount
      const AMT = '(\\d{1,3}(?:[,\\s.]\\d{3})*\\.\\d{2}|\\d+\\.\\d{2})'
      const totalKeywords = ['GRAND\\s*TOTAL', 'TOTAL\\s*DUE', 'TOTAL\\s*SALE', 'TOTAL\\s*AMOUNT', 'AMOUNT\\s*DUE', 'BALANCE\\s*DUE', 'SUBTOTAL', '(?:VISA|MASTERCARD|DEBIT|CREDIT)', 'TOTAL']
      const totalPatterns = totalKeywords.map(kw => new RegExp(kw + '[:\\s]*\\$?\\s*' + AMT, 'i'))
      const parseAmt = (raw: string) => parseFloat(raw.replace(/[\s]/g, '').replace(/\.(?=\d{3}\.)/g, '').replace(/,/g, ''))
      let amount = ''
      const reversedLines = [...lines].reverse()
      for (const line of reversedLines) {
        for (const pat of totalPatterns) { const m = line.match(pat); if (m) { const v = parseAmt(m[1]); amount = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); break } }
        if (amount) break
      }
      if (!amount) {
        let maxVal = 0
        for (const line of lines) { const matches = line.match(/\$?\s*(\d{1,3}(?:[,\s.]\d{3})*\.\d{2})/g); if (matches) for (const match of matches) { const v = parseAmt(match.replace(/^\$?\s*/, '')); if (v > maxVal && v < 50000) { maxVal = v; amount = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } } }
      }

      setScanResult({ date, desc, amount, category: cat })
    } catch (err) {
      console.error('OCR error:', err)
      setScanResult({ date: new Date().toISOString().slice(0, 10), desc: '', amount: '', category: 'Other' })
    }
    setScanning(false)
  }

  const applyReceipt = async () => {
    if (!scanResult) return
    const amt = parseFloat(scanResult.amount.replace(/,/g, ''))
    if (!scanResult.desc || !amt) {
      // Fill form for manual completion
      setFormType('expense')
      setFDate(scanResult.date); setFDesc(scanResult.desc); setFAmount(scanResult.amount); setFCat(scanResult.category); setFSource('Receipt Scan')
      setShowForm(true)
    } else {
      // Save directly
      setSaving(true)
      await fetch('/api/shop/bookkeeping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expense', date: scanResult.date, description: scanResult.desc, amount: amt.toString(), category: scanResult.category, source: 'Receipt Scan' }),
      })
      setSaving(false)
      fetchData()
    }
    setShowReceiptModal(false); setReceiptPreview(null); setScanResult(null)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ year: year.toString() })
    if (filterMonth !== null) params.set('month', filterMonth.toString())
    const res = await fetch(`/api/shop/bookkeeping?${params}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries || [])
      setOrdersByMonth(data.ordersByMonth || {})
    }
    setLoading(false)
  }, [year, filterMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setFDate(new Date().toISOString().slice(0, 10)); setFDesc(''); setFAmount('')
    setFCat(formType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0])
    setFSource(''); setFNotes(''); setEditingId(null); setShowForm(false)
  }

  const handleSubmit = async () => {
    if (!fDesc || !fAmount) return
    setSaving(true)

    if (editingId) {
      await fetch('/api/shop/bookkeeping', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, type: formType, date: fDate, description: fDesc, amount: fAmount, category: fCat, source: fSource, notes: fNotes || null }),
      })
    } else {
      await fetch('/api/shop/bookkeeping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formType, date: fDate, description: fDesc, amount: fAmount, category: fCat, source: fSource, notes: fNotes || null }),
      })
    }

    setSaving(false)
    resetForm()
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/shop/bookkeeping?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const startEdit = (entry: Entry) => {
    setFormType(entry.type)
    setFDate(entry.date)
    setFDesc(entry.description)
    setFAmount(entry.amount.toString())
    setFCat(entry.category)
    setFSource(entry.source || '')
    setFNotes(entry.notes || '')
    setEditingId(entry.id)
    setShowForm(true)
  }

  // Calculations
  const manualIncome = entries.filter(e => e.type === 'income')
  const expenses = entries.filter(e => e.type === 'expense')
  const totalManualIncome = manualIncome.reduce((s, e) => s + e.amount, 0)
  const totalDonutDashIncome = Object.values(ordersByMonth).reduce((s, m) => s + m.total, 0)
  const totalIncome = totalManualIncome + totalDonutDashIncome
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalIncome - totalExpenses

  // Monthly breakdown for dashboard
  const monthlyData = MONTHS.map((_, i) => {
    const ddIncome = ordersByMonth[i]?.total || 0
    const manIncome = entries.filter(e => e.type === 'income' && new Date(e.date).getMonth() === i).reduce((s, e) => s + e.amount, 0)
    const exp = entries.filter(e => e.type === 'expense' && new Date(e.date).getMonth() === i).reduce((s, e) => s + e.amount, 0)
    return { month: MONTHS[i], income: ddIncome + manIncome, ddIncome, manIncome, expenses: exp, profit: ddIncome + manIncome - exp }
  })

  // Expense by category
  const expByCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(e => e.total > 0).sort((a, b) => b.total - a.total)

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'income', label: 'Income', icon: '💰' },
    { key: 'expenses', label: 'Expenses', icon: '💸' },
  ] as const

  return (
    <div>
      {/* Year selector & tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false) }} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === t.key ? '#FF1493' : '#fff', color: tab === t.key ? '#fff' : '#666',
              boxShadow: tab === t.key ? '0 2px 8px rgba(255,20,147,0.3)' : 'none',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>&lt;</button>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>&gt;</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading bookkeeping data...</div>
      ) : tab === 'dashboard' ? (
        <DashboardTab
          totalIncome={totalIncome} totalDonutDashIncome={totalDonutDashIncome}
          totalManualIncome={totalManualIncome} totalExpenses={totalExpenses}
          netProfit={netProfit} monthlyData={monthlyData} expByCategory={expByCategory}
        />
      ) : (
        <div>
          {/* Month filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMonth(null)} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filterMonth === null ? '#FF1493' : '#f5f5f5', color: filterMonth === null ? '#fff' : '#666',
            }}>All</button>
            {MONTHS.map((m, i) => (
              <button key={i} onClick={() => setFilterMonth(i)} style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterMonth === i ? '#FF1493' : '#f5f5f5', color: filterMonth === i ? '#fff' : '#666',
              }}>{m}</button>
            ))}
          </div>

          {/* Add button + Scan Receipt */}
          {!showForm && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => { setFormType(tab === 'income' ? 'income' : 'expense'); setFCat(tab === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]); setShowForm(true); setEditingId(null) }} style={btnPrimary}>
                + Add {tab === 'income' ? 'Income' : 'Expense'}
              </button>
              {tab === 'expenses' && (
                <>
                  <button onClick={() => receiptRef.current?.click()} style={{ ...btnPrimary, background: '#FF8C00' }}>
                    📸 Scan Receipt
                  </button>
                  <input ref={receiptRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) scanReceipt(f); e.target.value = '' }} />
                </>
              )}
            </div>
          )}

          {/* Entry form */}
          {showForm && (
            <div style={{ ...card, padding: 20, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{editingId ? 'Edit' : 'Add'} {formType === 'income' ? 'Income' : 'Expense'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Date</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Description</label>
                  <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="e.g. Dawn Foods delivery" style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Amount ($)</label>
                  <input type="number" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Category</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value)} style={input}>
                    {(formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Source (optional)</label>
                  <input value={fSource} onChange={e => setFSource(e.target.value)} placeholder="e.g. Bank, Cash" style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>Notes (optional)</label>
                  <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Any notes..." style={input} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={handleSubmit} disabled={saving || !fDesc || !fAmount} style={{ ...btnPrimary, opacity: saving || !fDesc || !fAmount ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetForm} style={{ ...btnPrimary, background: '#f5f5f5', color: '#666' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* DonutDash auto-income (only on income tab) */}
          {tab === 'income' && (
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #FFE4EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FF1493' }}>DonutDash Orders (Auto-tracked)</h3>
                <span style={{ fontWeight: 800, color: '#10B981' }}>{fmt(totalDonutDashIncome)}</span>
              </div>
              <div style={{ padding: '0 20px' }}>
                {MONTHS.map((m, i) => {
                  const data = ordersByMonth[i]
                  if (!data || data.count === 0) return null
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8f8f8', fontSize: 14 }}>
                      <span>{m} — {data.count} orders</span>
                      <span style={{ fontWeight: 700 }}>{fmt(data.total)}</span>
                    </div>
                  )
                })}
                {Object.keys(ordersByMonth).length === 0 && (
                  <div style={{ padding: '20px 0', color: '#888', fontSize: 14, textAlign: 'center' }}>No DonutDash orders this year</div>
                )}
              </div>
            </div>
          )}

          {/* Entries list */}
          <div style={card}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #FFE4EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {tab === 'income' ? 'Manual Income' : 'Expenses'} ({(tab === 'income' ? manualIncome : expenses).length})
              </h3>
              <span style={{ fontWeight: 800, color: tab === 'income' ? '#10B981' : '#DC2626' }}>
                {fmt(tab === 'income' ? totalManualIncome : totalExpenses)}
              </span>
            </div>
            {(tab === 'income' ? manualIncome : expenses).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                No {tab === 'income' ? 'manual income' : 'expense'} entries yet
              </div>
            ) : (
              <div>
                {(tab === 'income' ? manualIncome : expenses).map((entry, i) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                    borderBottom: '1px solid #f8f8f8', background: i % 2 === 0 ? '#fff' : '#FFFAFC',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.description}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {entry.date} &middot; {entry.category}
                        {entry.source && ` · ${entry.source}`}
                      </div>
                      {entry.notes && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{entry.notes}</div>}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 15, color: entry.type === 'income' ? '#10B981' : '#DC2626', flexShrink: 0 }}>
                      {fmt(entry.amount)}
                    </span>
                    <button onClick={() => startEdit(entry)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>✏️</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Scanner Modal */}
      {showReceiptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setShowReceiptModal(false); setReceiptPreview(null); setScanResult(null) }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>📸 Receipt Scanner</div>
              <button onClick={() => { setShowReceiptModal(false); setReceiptPreview(null); setScanResult(null) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            {receiptPreview && <img src={receiptPreview} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee', marginBottom: 16 }} alt="Receipt" />}
            {scanning && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>Scanning receipt...</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Reading text with OCR</div>
              </div>
            )}
            {scanResult && !scanning && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#10B981', marginBottom: 12, background: '#ECFDF5', padding: '8px 12px', borderRadius: 8 }}>
                  ✓ Scan complete — review & edit below
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 2, display: 'block' }}>DATE</label>
                    <input type="date" value={scanResult.date} onChange={e => setScanResult({ ...scanResult, date: e.target.value })} style={input} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 2, display: 'block' }}>STORE / DESCRIPTION</label>
                    <input value={scanResult.desc} onChange={e => setScanResult({ ...scanResult, desc: e.target.value })} placeholder="Store name" style={input} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 2, display: 'block' }}>AMOUNT ($)</label>
                    <input type="text" inputMode="decimal" value={scanResult.amount} onChange={e => setScanResult({ ...scanResult, amount: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="0.00" style={input} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 2, display: 'block' }}>CATEGORY</label>
                    <select value={scanResult.category} onChange={e => setScanResult({ ...scanResult, category: e.target.value })} style={input}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={applyReceipt} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Saving...' : '✓ Add to Expenses'}
                  </button>
                  <button onClick={() => receiptRef.current?.click()} style={{ ...btnPrimary, background: '#f5f5f5', color: '#666' }}>Retake</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardTab({ totalIncome, totalDonutDashIncome, totalManualIncome, totalExpenses, netProfit, monthlyData, expByCategory }: {
  totalIncome: number; totalDonutDashIncome: number; totalManualIncome: number
  totalExpenses: number; netProfit: number
  monthlyData: { month: string; income: number; ddIncome: number; manIncome: number; expenses: number; profit: number }[]
  expByCategory: { cat: string; total: number }[]
}) {
  const maxIncome = Math.max(...monthlyData.map(d => d.income), 1)

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Income', value: fmt(totalIncome), icon: '💰', color: '#10B981', sub: `DD: ${fmt(totalDonutDashIncome)} + Other: ${fmt(totalManualIncome)}` },
          { label: 'Total Expenses', value: fmt(totalExpenses), icon: '💸', color: '#DC2626' },
          { label: 'Net Profit', value: fmt(netProfit), icon: netProfit >= 0 ? '📈' : '📉', color: netProfit >= 0 ? '#10B981' : '#DC2626' },
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{m.label}</div>
            {m.sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Monthly breakdown */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Monthly Breakdown</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#FFF5F8' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700 }}>Month</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>Income</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>Expenses</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>Profit</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, width: '30%' }}></th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{d.month}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{d.income > 0 ? fmt(d.income) : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#DC2626', fontWeight: 600 }}>{d.expenses > 0 ? fmt(d.expenses) : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: d.profit >= 0 ? '#10B981' : '#DC2626' }}>{d.income > 0 || d.expenses > 0 ? fmt(d.profit) : '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {d.income > 0 && (
                      <div style={{ height: 8, borderRadius: 4, background: '#FFE4EF', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(d.income / maxIncome) * 100}%`, background: '#FF1493', borderRadius: 4 }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#FFF5F8', fontWeight: 800 }}>
                <td style={{ padding: '12px 16px' }}>Total</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10B981' }}>{fmt(totalIncome)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#DC2626' }}>{fmt(totalExpenses)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: netProfit >= 0 ? '#10B981' : '#DC2626' }}>{fmt(netProfit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense by category */}
      {expByCategory.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Expenses by Category</h3>
          </div>
          <div style={{ padding: '0 20px 16px' }}>
            {expByCategory.map((e, i) => (
              <div key={e.cat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < expByCategory.length - 1 ? '1px solid #f8f8f8' : 'none' }}>
                <span style={{ flex: 1, fontSize: 14 }}>{e.cat}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#DC2626' }}>{fmt(e.total)}</span>
                <div style={{ width: 100, height: 6, borderRadius: 3, background: '#FFE4EF', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(e.total / expByCategory[0].total) * 100}%`, background: '#FF1493', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
