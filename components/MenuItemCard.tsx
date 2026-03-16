'use client'

import { useState } from 'react'
import { useCart } from '@/lib/cart-context'
import type { MenuItem } from '@/lib/types'

interface MenuItemCardProps {
  item: MenuItem
  shopId: string
  shopName: string
}

export default function MenuItemCard({ item, shopId, shopName }: MenuItemCardProps) {
  const { addItem, needsShopSwitch, switchShopAndAdd } = useCart()
  const [showModal, setShowModal] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const [added, setAdded] = useState(false)

  const handleAddToCart = () => {
    if (needsShopSwitch(shopId)) {
      setShowSwitchConfirm(true)
      return
    }

    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity,
      image_url: item.image_url,
      special_instructions: null,
    }

    const success = addItem(cartItem, shopId, shopName)
    if (success) {
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
      setShowModal(false)
      setQuantity(1)
    }
  }

  const handleSwitchShop = () => {
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity,
      image_url: item.image_url,
      special_instructions: null,
    }
    switchShopAndAdd(cartItem, shopId, shopName)
    setShowSwitchConfirm(false)
    setShowModal(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
    setQuantity(1)
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #f0f0f0',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div style={{
          width: '100%',
          height: '160px',
          background: item.image_url
            ? `url(${item.image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {!item.image_url && <span style={{ fontSize: '2.5rem' }}>🍩</span>}
          {added && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 20, 147, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
            }}>
              Added!
            </div>
          )}
        </div>

        <div style={{ padding: '0.85rem 1rem' }}>
          <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', color: '#1A1A2E' }}>
            {item.name}
          </h4>
          {item.description && (
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {item.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#1A1A2E', fontSize: '1rem' }}>
              ${item.price.toFixed(2)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAddToCart()
              }}
              style={{
                background: '#FF8C00',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e67e00')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FF8C00')}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && (
        <div
          onClick={() => { setShowModal(false); setQuantity(1) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px', maxWidth: '440px',
              width: '100%', overflow: 'hidden',
            }}
          >
            <div style={{
              height: '220px',
              background: item.image_url
                ? `url(${item.image_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {!item.image_url && <span style={{ fontSize: '4rem' }}>🍩</span>}
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.5rem' }}>{item.name}</h3>
              {item.description && (
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {item.description}
                </p>
              )}
              <p style={{ fontWeight: 700, fontSize: '1.15rem', color: '#FF1493', marginBottom: '1.25rem' }}>
                ${item.price.toFixed(2)}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Quantity:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                style={{
                  width: '100%', padding: '0.85rem', background: '#FF8C00',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e67e00')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FF8C00')}
              >
                Add to Cart - ${(item.price * quantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Shop Confirm */}
      {showSwitchConfirm && (
        <div
          onClick={() => setShowSwitchConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px', padding: '2rem',
              maxWidth: '380px', width: '100%', textAlign: 'center',
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Switch shop?
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Your cart has items from another shop. Would you like to clear your cart and add items from this shop instead?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowSwitchConfirm(false)}
                style={{
                  flex: 1, padding: '0.7rem', border: '1px solid #ddd',
                  borderRadius: '10px', background: 'white', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchShop}
                style={{
                  flex: 1, padding: '0.7rem', border: 'none',
                  borderRadius: '10px', background: '#FF1493', color: 'white',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
