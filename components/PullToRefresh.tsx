'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pull down to refresh.
 *
 * The shop dashboard's manifest sets `display: standalone`, so once it is on
 * a home screen iOS runs it without Safari's chrome — and without Safari's
 * pull-to-refresh. There is no reload button either. The only way to get
 * fresh figures was to close the app and reopen it, which is why this is
 * worth hand-rolling rather than leaving to the browser.
 *
 * `router.refresh()` rather than `location.reload()`: these pages are server
 * components reading live figures, so refresh re-runs them and swaps the
 * result in without tearing the app down and paying the whole startup cost
 * again. The spinner runs until React has actually finished applying it, so
 * the gesture ends when the numbers are new — not when the request was sent.
 */

/** How far the finger travels before a release counts as a refresh. */
const THRESHOLD = 70
/** Cap on how far the indicator moves, however hard the pull. */
const MAX_PULL = 110
/** Pull moves at half finger speed — the resistance that makes the gesture
 *  feel attached to something rather than free-running. */
const FRICTION = 0.5

export default function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [pending, startTransition] = useTransition()

  const startY = useRef<number | null>(null)
  const active = useRef(false)

  useEffect(() => {
    // Listeners are attached manually because touchmove must be non-passive
    // to call preventDefault — React attaches touch handlers passively, and a
    // passive listener cannot stop the page scrolling under the gesture.
    function onStart(e: TouchEvent) {
      // Only from a genuine top-of-page. iOS reports small negative values
      // during its own rubber-banding, which still counts as the top.
      if (window.scrollY > 0) { startY.current = null; return }
      if (e.touches.length !== 1) { startY.current = null; return }
      startY.current = e.touches[0].clientY
      active.current = false
    }

    function onMove(e: TouchEvent) {
      if (startY.current == null || pending) return
      const dy = e.touches[0].clientY - startY.current

      // Upward, or the page has scrolled away from the top mid-gesture:
      // this is a scroll, not a pull. Let go of it entirely.
      if (dy <= 0 || window.scrollY > 0) {
        if (active.current) { active.current = false; setPull(0) }
        startY.current = null
        return
      }

      // A few pixels of slack before claiming the gesture, so a fast flick
      // down the page is never mistaken for a pull.
      if (!active.current && dy < 8) return
      active.current = true

      // Now that it is a pull, stop the page moving underneath it.
      if (e.cancelable) e.preventDefault()
      setPull(Math.min(dy * FRICTION, MAX_PULL))
    }

    function onEnd() {
      const wasActive = active.current
      const distance = pull
      startY.current = null
      active.current = false

      if (!wasActive) return
      if (distance >= THRESHOLD) {
        // Hold the indicator at the threshold while the refresh runs, so it
        // reads as "working" rather than snapping back as if nothing happened.
        setPull(THRESHOLD)
        startTransition(() => {
          router.refresh()
        })
      } else {
        setPull(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [pull, pending, router])

  // Collapse once the refresh has actually landed.
  useEffect(() => {
    if (!pending && pull === THRESHOLD) setPull(0)
  }, [pending, pull])

  const showing = pull > 0 || pending
  const ready = pull >= THRESHOLD

  return (
    <>
      <div
        aria-hidden={!showing}
        style={{
          position: 'fixed',
          top: 'max(8px, env(safe-area-inset-top))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 80,
          opacity: showing ? 1 : 0,
          transform: `translateY(${showing ? Math.min(pull, MAX_PULL) * 0.4 : 0}px)`,
          transition: pull === 0 ? 'opacity .2s ease, transform .2s ease' : 'none',
        }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #FFD1E6',
              borderTopColor: '#FF1493',
              // Spins while refreshing; before release it just rotates with
              // the pull, so the gesture shows its own progress.
              transform: pending ? undefined : `rotate(${(pull / THRESHOLD) * 270}deg)`,
              opacity: ready || pending ? 1 : 0.55,
              animation: pending ? 'ddspin .7s linear infinite' : undefined,
            }}
          />
        </div>
      </div>
      <style>{`@keyframes ddspin { to { transform: rotate(360deg) } }`}</style>
      {children}
    </>
  )
}
