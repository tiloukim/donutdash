'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { CartItem } from '@/lib/types'

const STORAGE_KEY = 'dd_cart'

interface CartState {
  items: CartItem[]
  shopId: string | null
  shopName: string | null
}

interface CartContextValue {
  items: CartItem[]
  shopId: string | null
  shopName: string | null
  addItem: (
    item: CartItem,
    shopId: string,
    shopName: string
  ) => boolean
  removeItem: (itemId: string) => void
  updateQty: (itemId: string, quantity: number) => void
  clearCart: () => void
  total: number
  count: number
  needsShopSwitch: (shopId: string) => boolean
  switchShopAndAdd: (
    item: CartItem,
    shopId: string,
    shopName: string
  ) => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function loadCart(): CartState {
  if (typeof window === 'undefined') {
    return { items: [], shopId: null, shopName: null }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    /* ignore corrupted data */
  }
  return { items: [], shopId: null, shopName: null }
}

function saveCart(state: CartState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore storage errors */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    shopId: null,
    shopName: null,
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCart(loadCart())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) {
      saveCart(cart)
    }
  }, [cart, hydrated])

  const needsShopSwitch = useCallback(
    (shopId: string) => {
      return cart.shopId !== null && cart.shopId !== shopId && cart.items.length > 0
    },
    [cart.shopId, cart.items.length]
  )

  const addItem = useCallback(
    (item: CartItem, shopId: string, shopName: string): boolean => {
      if (cart.shopId !== null && cart.shopId !== shopId && cart.items.length > 0) {
        return false
      }

      setCart((prev) => {
        const existing = prev.items.find((i) => i.id === item.id)
        let newItems: CartItem[]

        if (existing) {
          newItems = prev.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
          )
        } else {
          newItems = [...prev.items, item]
        }

        return { items: newItems, shopId, shopName }
      })

      return true
    },
    [cart.shopId, cart.items.length]
  )

  const switchShopAndAdd = useCallback(
    (item: CartItem, shopId: string, shopName: string) => {
      setCart({
        items: [item],
        shopId,
        shopName,
      })
    },
    []
  )

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      const newItems = prev.items.filter((i) => i.id !== itemId)
      if (newItems.length === 0) {
        return { items: [], shopId: null, shopName: null }
      }
      return { ...prev, items: newItems }
    })
  }, [])

  const updateQty = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => {
        const newItems = prev.items.filter((i) => i.id !== itemId)
        if (newItems.length === 0) {
          return { items: [], shopId: null, shopName: null }
        }
        return { ...prev, items: newItems }
      })
      return
    }

    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    }))
  }, [])

  const clearCart = useCallback(() => {
    setCart({ items: [], shopId: null, shopName: null })
  }, [])

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  )

  const count = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items]
  )

  return (
    <CartContext.Provider
      value={{
        items: cart.items,
        shopId: cart.shopId,
        shopName: cart.shopName,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        total,
        count,
        needsShopSwitch,
        switchShopAndAdd,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
