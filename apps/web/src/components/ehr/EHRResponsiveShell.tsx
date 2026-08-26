import { type FC, type ReactNode } from 'react'

import { useResponsive } from '@/components/layout/ResponsiveUtils'

import { EHRDesktopLayout } from './EHRDesktopLayout'
import { EHRMobileLayout } from './EHRMobileLayout'

/**
 * EHR view category — determines layout mode.
 *
 * `mobile-first` views (notes, scheduling, messaging) use the mobile layout
 * with bottom nav, stacked content, and touch-optimized controls.
 *
 * `desktop-optimized` views (chart, billing) use the desktop layout with
 * a left sidebar and dense multi-column content.
 */
export type EHRViewCategory = 'mobile-first' | 'desktop-optimized'

export interface EHRResponsiveShellProps {
  /** Category that determines which layout is used on mobile vs desktop */
  category: EHRViewCategory
  /** Active view identifier for nav highlighting */
  activeView: string
  /** Content rendered inside the layout */
  children: ReactNode
  /** Optional nav items for the layout's navigation */
  navItems?: EHRRNavItem[]
}

export interface EHRRNavItem {
  id: string
  label: string
  icon: ReactNode
  href?: string
  onClick?: () => void
}

/**
 * Responsive shell for EHR module.
 *
 * Switches between mobile-first and desktop-optimized layouts at the
 * `lg` breakpoint (1024px). SSR-safe: defaults to desktop layout on
 * server to prevent layout flash, hydrates to correct layout on client.
 *
 * @see DESIGN.md §4 EHR Layout Architecture
 */
export const EHRResponsiveShell: FC<EHRResponsiveShellProps> = ({
  category,
  activeView,
  children,
  navItems = [],
}) => {
  const { isDesktop } = useResponsive()

  const useDesktopLayout = category === 'desktop-optimized' || isDesktop

  if (useDesktopLayout) {
    return (
      <EHRDesktopLayout activeView={activeView} navItems={navItems}>
        {children}
      </EHRDesktopLayout>
    )
  }

  return (
    <EHRMobileLayout activeView={activeView} navItems={navItems}>
      {children}
    </EHRMobileLayout>
  )
}
