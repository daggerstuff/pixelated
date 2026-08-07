'use client'

import { useCallback, useEffect, useState } from 'react'

import { isPremium, setPremium } from '../lib/premium'
import styles from './page.module.css'

type UnlockState = 'idle' | 'loading' | 'error'

export default function Page() {
  const [premium, setPremiumState] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [unlockState, setUnlockState] = useState<UnlockState>('idle')
  const [unlockError, setUnlockError] = useState<string | null>(null)

  useEffect(() => {
    setPremiumState(isPremium())
    setHydrated(true)
  }, [])

  const handleUnlock = useCallback(async () => {
    setUnlockState('loading')
    setUnlockError(null)

    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Payment create failed (${response.status})`)
      }

      const data: unknown = await response.json()

      if (
        data &&
        typeof data === 'object' &&
        'checkoutUrl' in data &&
        typeof data.checkoutUrl === 'string' &&
        data.checkoutUrl.length > 0
      ) {
        window.location.href = data.checkoutUrl
        return
      }

      throw new Error('Payment create response missing checkoutUrl')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start checkout'

      setUnlockError(message)
      setUnlockState('error')
    }
  }, [])

  const handleDevUnlock = useCallback(() => {
    setPremium(true)
    setPremiumState(true)
    setUnlockState('idle')
    setUnlockError(null)
  }, [])

  if (!hydrated) {
    return (
      <main className={styles.page}>
        <section className={styles.shell} aria-busy="true">
          <p className={styles.muted}>Loading…</p>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Premium access</p>
          <h1 className={styles.title}>Premium Game</h1>
          <p className={`${styles.subtitle} ${styles.muted}`}>
            {premium
              ? 'Premium features are unlocked on this device.'
              : 'Unlock premium content to continue.'}
          </p>
        </header>

        <div
          className={`${styles.content} ${premium ? '' : styles.contentLocked}`}
        >
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Premium content</h2>
            <p className={styles.panelCopy}>
              This area is gated until payment is verified and stored in
              localStorage.
            </p>
          </div>

          {!premium ? (
            <div className={styles.overlay} role="region" aria-label="Premium unlock">
              <div className={styles.lockCard}>
                <p className={styles.lockTitle}>Premium locked</p>
                <p className={`${styles.lockCopy} ${styles.muted}`}>
                  Pay once to unlock premium features on this browser.
                </p>
                <button
                  type="button"
                  className={styles.button}
                  onClick={handleUnlock}
                  disabled={unlockState === 'loading'}
                >
                  {unlockState === 'loading' ? 'Starting checkout…' : 'Unlock Premium'}
                </button>
                {unlockState === 'error' && unlockError ? (
                  <p className={styles.error} role="alert">
                    {unlockError}
                  </p>
                ) : null}
                {process.env.NODE_ENV === 'development' ? (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    onClick={handleDevUnlock}
                  >
                    Dev unlock (localStorage)
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
