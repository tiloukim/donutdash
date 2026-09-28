'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pull down to refresh.
 *
 * The shop dashboard's manifest sets `display: standalone`, so once it is on a
 * home screen iOS runs it without Safari's chrome — and without Safari's
 * pull-to-refresh. There is no reload button either, so the only way to get
 * fresh figures was to close the app and reopen it.
 *
 * `router.refresh()` rather than `location.reload()`: these pages are server
 * components reading live figures, so refresh re-runs them and swaps the
 * result in without tearing the app down. The spinner holds until React has
 * finished applying it, so the gesture ends when the numbers are new.
 *
 * ── Why the gesture state lives in refs ──
 * The first version kept the pull distance in state and listed it in the
 * effect's dependencies. That re-ran the effect on every touchmove, which
 * removed and re-added the touch listeners dozens of times per drag — and a
 * touchmove listener removed mid-gesture takes the rest of the gesture with
 * it on iOS. The gesture never completed, which is exactly how it was
 * reported.
 *
 * So the handlers read and write refs, the effect registers once with no
 * dependencies, and state exists only to drive the indicator. Anything the
 * handlers need from React — the pending flag, the router — is mirrored into
 * a ref each render rather than captured in a closure that goes stale.
 */

const THRESHOLD = 70
const MAX_PULL = 110
/** Pull moves at half finger speed — resistance that makes the gesture feel
 *  attached to something rather than free-running. */
const FRICTION = 0.5

export default function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [pending, startTransition] = useTransition()

  const startY = useRef<number | null>(null)
  const active = useRef(false)
  const pullRef = useRef(0)
  const pendingRef = useRef(false)
  const routerRef = useRef(router)
  const frame = useRef<number | null>(null)

  // Mirrored every render so the handlers never read a stale closure.
  pendingRef.current = pending
  routerRef.current = router

  useEffect(() => {
    // Coalesce indicator updates to one per frame. touchmove fires far faster
    // than the screen redraws, and setting state on every event is how a
    // smooth drag turns into a stuttering one.
    function paint(next: number) {
      pullRef.current = next
      if (frame.current != null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        setPull(pullRef.current)
      })
    }

    function onStart(e: TouchEvent) {
      if (pendingRef.current) return
      // Only from a genuine top-of-page. iOS reports small negative values
      // during its own rubber-banding, which still counts as the top.
      if (window.scrollY > 0 || e.touches.length !== 1) {
        startY.current = null
        return
      }
      startY.current = e.touches[0].clientY
      active.current = false
    }

    function onMove(e: TouchEvent) {
      if (startY.current == null || pendingRef.current) return
      const dy = e.touches[0].clientY - startY.current

      // Upward, or the page scrolled away from the top mid-gesture: this is a
      // scroll, not a pull. Let go of it entirely.
      if (dy <= 0 || window.scrollY > 0) {
        if (active.current) { active.current = false; paint(0) }
        startY.current = null
        return
      }

      // A few pixels of slack before claiming the gesture, so a fast flick
      // down a long page is never mistaken for a pull.
      if (!active.current && dy < 8) return
      active.current = true

      // Now that it is a pull, stop the page moving underneath it. Requires
      // the non-passive registration below — React's own touch handlers are
      // passive and cannot do this.
      if (e.cancelable) e.preventDefault()
      paint(Math.min(dy * FRICTION, MAX_PULL))
    }

    function onEnd() {
      const wasActive = active.current
      const distance = pullRef.current
      startY.current = null
      active.current = false
      if (!wasActive) return

      if (distance >= THRESHOLD) {
        // Hold at the threshold while the refresh runs, so it reads as
        // "working" rather than snapping back as if nothing happened.
        paint(THRESHOLD)
        startTransition(() => { routerRef.current.refresh() })
      } else {
        paint(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
    // Registers ONCE. Everything variable is read through a ref — see the
    // note at the top; re-registering mid-gesture is what broke this before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Collapse once the refresh has actually landed.
  useEffect(() => {
    if (!pending && pullRef.current === THRESHOLD) {
      pullRef.current = 0
      setPull(0)
    }
  }, [pending])

  const showing = pull > 0 || pending
  const ready = pull >= THRESHOLD

  return (
    <>
      <div
        aria-hidden={!showing}
        style={{
          position: 'fixed',
          top: 'max(8px, env(safe-area-inset-top))',
          left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 80,
          opacity: showing ? 1 : 0,
          transform: `translateY(${showing ? Math.min(pull, MAX_PULL) * 0.4 : 0}px)`,
          transition: pull === 0 ? 'opacity .2s ease, transform .2s ease' : 'none',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid #FFD1E6', borderTopColor: '#FF1493',
            transform: pending ? undefined : `rotate(${(pull / THRESHOLD) * 270}deg)`,
            opacity: ready || pending ? 1 : 0.55,
            animation: pending ? 'ddspin .7s linear infinite' : undefined,
          }} />
        </div>
      </div>
      <style>{`@keyframes ddspin { to { transform: rotate(360deg) } }`}</style>
      {children}
    </>
  )
}
