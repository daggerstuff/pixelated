import type { FC, ReactNode } from 'react'
import type { EHRRNavItem } from './EHRResponsiveShell'

/**
 * Desktop-optimized layout for EHR views (chart, billing).
 *
 * Features:
 * - Left sidebar navigation (256px fixed width)
 * - Dense multi-column content area
 * - Tables with full column visibility
 * - Compact spacing (`--np-space-2` / `--np-space-4`)
 * - Mouse-precision density (no touch target enforcement)
 *
 * @see DESIGN.md §4 Desktop-Optimized Layout
 */
interface EHRDesktopLayoutProps {
  activeView: string
  navItems: EHRRNavItem[]
  children: ReactNode
}

export const EHRDesktopLayout: FC<EHRDesktopLayoutProps> = ({
  activeView,
  navItems,
  children,
}) => {
  return (
    <div
      className="min-h-screen w-full overflow-x-hidden flex"
      style={{ background: 'var(--np-bg)', color: 'var(--np-text)' }}
    >
      {/* Left sidebar navigation — 256px fixed */}
      <aside
        className="flex flex-col shrink-0"
        style={{
          width: '256px',
          background: 'var(--np-surface)',
          borderRight: '1px solid var(--np-hover)',
          minHeight: '100vh',
        }}
        aria-label="EHR navigation"
      >
        <div
          className="px-4 py-6"
          style={{
            borderBottom: '1px solid var(--np-hover)',
            fontFamily: 'var(--np-font-display)',
          }}
        >
          <span
            className="text-lg font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            EHR
          </span>
        </div>

        <nav className="flex-1 py-2">
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
                className="flex items-center gap-3 px-4 py-2 mx-2 rounded transition-colors"
                style={{
                  color: isActive ? 'var(--np-text)' : 'var(--np-muted)',
                  background: isActive ? 'var(--np-elevated)' : 'transparent',
                  transition: 'background 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  outline: 'none',
                }}
              >
                <span className="flex items-center justify-center w-5 h-5 shrink-0">
                  {item.icon}
                </span>
                <span
                  className="text-sm"
                  style={{ fontFamily: 'var(--np-font-body)' }}
                >
                  {item.label}
                </span>
              </a>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main
        id="main-content"
        className="flex-1 min-w-0 overflow-x-hidden"
        style={{ background: 'var(--np-bg)' }}
      >
        <div
          className="max-w-7xl mx-auto p-6"
          style={{
            fontFamily: 'var(--np-font-body)',
            color: 'var(--np-text)',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
