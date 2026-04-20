'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Verifying...')

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const code = searchParams.get('code')
      const next = searchParams.get('next') ?? '/'
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      // Check hash fragment for tokens (non-PKCE flow, e.g. password reset)
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')

      try {
        if (accessToken && refreshToken) {
          // Hash fragment flow (password reset, magic link)
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error

          if (hashType === 'recovery') {
            router.replace('/reset-password')
            return
          }

          // For other hash flows, redirect based on role
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const role = user.user_metadata?.role || 'customer'
            if (role === 'shop_owner') { router.replace('/partner-setup'); return }
            if (role === 'driver') { router.replace('/driver'); return }
            if (role === 'admin') { router.replace('/admin'); return }
          }
          router.replace(next)
          return
        }

        if (code) {
          // PKCE flow (OAuth, email confirmation)
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const role = user.user_metadata?.role || 'customer'
            if (role === 'shop_owner') { router.replace('/partner-setup'); return }
            if (role === 'driver') { router.replace('/driver'); return }
            if (role === 'admin') { router.replace('/admin'); return }
          }
          router.replace(next)
          return
        }

        if (tokenHash && type) {
          // Token hash flow (email verification)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          })
          if (error) throw error

          if (type === 'recovery') {
            router.replace('/reset-password')
            return
          }

          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const role = user.user_metadata?.role || 'customer'
            if (type === 'signup' || type === 'email') {
              if (role === 'shop_owner') { router.replace('/partner-setup'); return }
              if (role === 'driver') { router.replace('/driver'); return }
              if (role === 'admin') { router.replace('/admin'); return }
            }
          }
          router.replace(next)
          return
        }

        // No recognizable params — go to login
        router.replace('/login?error=Could+not+verify+email')
      } catch (err: any) {
        setStatus('Verification failed')
        router.replace(`/login?error=${encodeURIComponent(err.message || 'Verification failed')}`)
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFF5EE 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍩</div>
        <p style={{ color: '#888', fontSize: '1rem' }}>{status}</p>
      </div>
    </div>
  )
}
