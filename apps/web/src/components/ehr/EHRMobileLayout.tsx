import { CloudOff, RefreshCw } from 'lucide-react'
import { type FC, type ReactNode, useEffect, useState } from 'react'

import {
  offlineSyncService,
  type OfflineSyncStatus,
} from '@/lib/ehr-native/services/offline-sync.service'

import type { EHRRNavItem } from './EHRResponsiveShell'

/**
 * Mobile-first layout for EHR views (notes, scheduling, messaging).
 *
 * Features:
 * - Fixed bottom navigation bar (56px height, z-index sticky)
 * - Stacked single-column content
 * - Full-width cards with `--np-surface` background
 * - Touch-optimized controls (44px minimum touch targets)
 * - No horizontal overflow at 360px
 * - Offline sync status banner & manual sync trigger
 *
 * @see DESIGN.md §4 Mobile-First Layout
 */
interface EHRMobileLayoutProps {
  activeView: string
  navItems: EHRRNavItem[]
  children: ReactNode
}

export const EHRMobileLayout: FC<EHRMobileLayoutProps> = ({
  activeView,
  navItems,
  children,
}) => {
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>(() =>
    offlineSyncService.getStatus(),
  )
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const update = () => setSyncStatus(offlineSyncService.getStatus())
    const unsubOnline = offlineSyncService.on('online', update)
    const unsubOffline = offlineSyncService.on('offline', update)
    const unsubQueued = offlineSyncService.on('itemQueued', update)
    const unsubComplete = offlineSyncService.on('syncComplete', () => {
      update()
      setIsSyncing(false)
    })

    return () => {
      unsubOnline()
      unsubOffline()
      unsubQueued()
      unsubComplete()
    }
  }, [])

  const handleManualSync = async () => {
    setIsSyncing(true)
    await offlineSyncService.syncAll({ force: true })
    setIsSyncing(false)
    setSyncStatus(offlineSyncService.getStatus())
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col overflow-x-hidden"
      style={{ background: 'var(--np-bg)', color: 'var(--np-text)' }}
    >
      {/* Offline Banner if disconnected or items are pending */}
      {(!syncStatus.isOnline || syncStatus.totalPendingCount > 0) && (
        <aside
          aria-label="Offline synchronization status"
          className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 text-xs font-medium"
          style={{
            background: !syncStatus.isOnline ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            borderBottom: '1px solid var(--np-line)',
            color: 'var(--np-text)',
          }}
        >
          <div className="flex items-center gap-2">
            {!syncStatus.isOnline ? (
              <>
                <CloudOff className="h-4 w-4 text-amber-400" />
                <span>Offline Mode (Edits saved locally)</span>
              </>
            ) : (
              <span>{syncStatus.totalPendingCount} pending changes</span>
            )}
          </div>
          {syncStatus.isOnline && (
            <button
              type="button"
              onClick={() => void handleManualSync()}
              disabled={isSyncing}
              className="flex min-h-[44px] items-center gap-1.5 rounded px-2 text-xs font-semibold text-sky-400 hover:underline"
              aria-label="Sync pending changes now"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </aside>
      )}

      {/* Mobile content area — scrolls above the fixed bottom nav */}
      <main
        id="main-content"
        className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden"
        style={{ paddingBottom: '56px' }}
      >
        <div
          className="w-full min-w-0 max-w-full p-4"
          style={{
            background: 'var(--np-bg)',
            fontFamily: 'var(--np-font-body)',
          }}
        >
          {children}
        </div>
      </main>

      {/* Fixed bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
        style={{
          background: 'var(--np-surface)',
          borderTop: '1px solid var(--np-hover)',
          height: '56px',
        }}
        aria-label="EHR navigation"
      >
        {navItems.map((item) => {
          const isActive = item.id === activeView
          return (
            <a
              key={item.id}
              href={item.href ?? '#'}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault()
                  item.onClick()
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center transition-colors"
              style={{
                color: isActive ? 'var(--np-text)' : 'var(--np-muted)',
                background: isActive ? 'var(--np-elevated)' : 'transparent',
                transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
              }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {item.icon}
              </span>
              <span
                className="mt-0.5 max-w-full truncate text-xs"
                style={{ fontFamily: 'var(--np-font-body)' }}
              >
                {item.label}
              </span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
