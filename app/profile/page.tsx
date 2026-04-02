'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Address {
  id: string
  label: string
  address: string
  city: string
  state: string
  zip: string
  is_default: boolean
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // New address form
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [newLabel, setNewLabel] = useState('Home')
  const [newAddress, setNewAddress] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newState, setNewState] = useState('TX')
  const [newZip, setNewZip] = useState('')
  const [editingAddr, setEditingAddr] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setName(data.profile.name || '')
          setPhone(data.profile.phone || '')
          setEmail(data.profile.email || '')
        }
        setAddresses(data.addresses || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading, router])

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_profile', name, phone }),
    })
    if (res.ok) setSuccess('Profile updated!')
    else setError('Failed to save')
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleAddAddress = async () => {
    if (!newAddress.trim() || !newCity.trim() || !newZip.trim()) {
      setError('Please fill in address, city, and ZIP')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: editingAddr ? 'update_address' : 'add_address',
        addressId: editingAddr,
        label: newLabel, address: newAddress, city: newCity, state: newState, zip: newZip,
        is_default: addresses.length === 0,
      }),
    })
    if (res.ok) {
      // Refresh addresses
      const data = await fetch('/api/profile').then(r => r.json())
      setAddresses(data.addresses || [])
      setShowAddAddress(false)
      setEditingAddr(null)
      setNewLabel('Home'); setNewAddress(''); setNewCity(''); setNewState('TX'); setNewZip('')
    } else {
      setError('Failed to save address')
    }
    setSaving(false)
  }

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Delete this address?')) return
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_address', addressId: id }),
    })
    setAddresses(prev => prev.filter(a => a.id !== id))
  }

  const startEditAddress = (addr: Address) => {
    setEditingAddr(addr.id)
    setNewLabel(addr.label)
    setNewAddress(addr.address)
    setNewCity(addr.city)
    setNewState(addr.state)
    setNewZip(addr.zip)
    setShowAddAddress(true)
  }

  if (loading || authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>Loading...</div>
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #ddd',
    fontSize: '0.95rem', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="DonutDash" style={{ height: 40 }} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>My Profile</h1>
        <Link href="/" style={{ color: '#FF1493', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>Back</Link>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
        {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#DC2626', fontSize: 14 }}>{error}</div>}
        {success && <div style={{ background: '#D1FAE5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#065F46', fontSize: 14 }}>{success}</div>}

        {/* Profile Info */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Personal Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 4 }}>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 4 }}>Email</label>
              <input type="email" value={email} disabled style={{ ...inputStyle, background: '#f5f5f5', color: '#888' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 4 }}>Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
              <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Used for delivery updates via SMS</p>
            </div>
            <button onClick={handleSaveProfile} disabled={saving}
              style={{
                padding: '12px', borderRadius: 10, border: 'none', background: '#FF1493', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
              }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Saved Addresses */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Saved Addresses</h2>
            <button onClick={() => { setShowAddAddress(true); setEditingAddr(null); setNewLabel('Home'); setNewAddress(''); setNewCity(''); setNewState('TX'); setNewZip('') }}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#FF1493', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Add
            </button>
          </div>

          {addresses.length === 0 && !showAddAddress && (
            <p style={{ color: '#888', textAlign: 'center', padding: 16, fontSize: 14 }}>No saved addresses yet</p>
          )}

          {addresses.map(addr => (
            <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>{addr.label}</span>
                  {addr.is_default && <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Default</span>}
                </div>
                <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{addr.address}, {addr.city}, {addr.state} {addr.zip}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startEditAddress(addr)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleDeleteAddress(addr.id)} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}

          {/* Add/Edit Address Form */}
          {showAddAddress && (
            <div style={{ marginTop: 16, padding: 16, background: '#FAFAFA', borderRadius: 10, border: '1px solid #f0f0f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1A1A2E' }}>
                {editingAddr ? 'Edit Address' : 'New Address'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  style={{ ...inputStyle, background: '#fff' }}>
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
                <input type="text" placeholder="Street address" value={newAddress} onChange={e => setNewAddress(e.target.value)} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 10 }}>
                  <input type="text" placeholder="City" value={newCity} onChange={e => setNewCity(e.target.value)} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                  <input type="text" placeholder="State" value={newState} onChange={e => setNewState(e.target.value)} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                  <input type="text" placeholder="ZIP" value={newZip} onChange={e => setNewZip(e.target.value)} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={handleAddAddress} disabled={saving}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#FF1493', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? 'Saving...' : editingAddr ? 'Update' : 'Save Address'}
                  </button>
                  <button onClick={() => { setShowAddAddress(false); setEditingAddr(null) }}
                    style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
