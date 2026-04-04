'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type ShopLang, type TranslationKey, t as translate, SHOP_LANG_KEY } from './shop-i18n'

interface ShopLangContextValue {
  lang: ShopLang
  setLang: (lang: ShopLang) => void
  t: (key: TranslationKey) => string
}

const ShopLangContext = createContext<ShopLangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function ShopLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<ShopLang>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SHOP_LANG_KEY) as ShopLang | null
    if (saved === 'km' || saved === 'en') setLangState(saved)
    setMounted(true)
  }, [])

  const setLang = (newLang: ShopLang) => {
    setLangState(newLang)
    localStorage.setItem(SHOP_LANG_KEY, newLang)
  }

  const t = (key: TranslationKey) => translate(key, lang)

  if (!mounted) return null

  return (
    <ShopLangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </ShopLangContext.Provider>
  )
}

export function useShopLang() {
  return useContext(ShopLangContext)
}
