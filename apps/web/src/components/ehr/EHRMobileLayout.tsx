import type { FC, ReactNode } from 'react'

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
  return (
    <div
      className="flex min-h-screen w-full flex-col overflow-x-hidden"
      style={{ background: 'var(--np-bg)', color: 'var(--np-text)' }}
    >
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
