// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock useResponsive before importing components that depend on it
vi.mock('@/components/layout/ResponsiveUtils', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLarge: false,
    width: 1024,
    height: 768,
  })),
  BREAKPOINTS: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
}))

import { useResponsive } from '@/components/layout/ResponsiveUtils'
import { EHRResponsiveShell } from '../EHRResponsiveShell'
import type { EHRRNavItem } from '../EHRResponsiveShell'

const mockUseResponsive = vi.mocked(useResponsive)

const navItems: EHRRNavItem[] = [
  { id: 'notes', label: 'Notes', icon: <span data-testid="icon-notes" /> },
  { id: 'scheduling', label: 'Scheduling', icon: <span data-testid="icon-scheduling" /> },
  { id: 'messaging', label: 'Messaging', icon: <span data-testid="icon-messaging" /> },
]

function setViewport(isDesktop: boolean) {
  mockUseResponsive.mockReturnValue({
    isMobile: !isDesktop && false,
    isTablet: !isDesktop,
    isDesktop,
    isLarge: isDesktop,
    width: isDesktop ? 1024 : 360,
    height: 768,
  })
}

describe('EHRResponsiveShell', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLarge: false,
      width: 1024,
      height: 768,
    })
  })

  it('renders desktop layout for desktop-optimized category regardless of viewport', () => {
    // Even on a mobile-sized viewport
    setViewport(false)

    render(
      <EHRResponsiveShell category="desktop-optimized" activeView="chart" navItems={navItems}>
        <div data-testid="content">Chart content</div>
      </EHRResponsiveShell>,
    )

    // Desktop layout has sidebar with "EHR" heading
    expect(screen.getByText('EHR')).toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders desktop layout for mobile-first category when viewport >= 1024px', () => {
    setViewport(true)

    render(
      <EHRResponsiveShell category="mobile-first" activeView="notes" navItems={navItems}>
        <div data-testid="content">Notes content</div>
      </EHRResponsiveShell>,
    )

    // Desktop sidebar present
    expect(screen.getByText('EHR')).toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders mobile layout for mobile-first category when viewport < 1024px', () => {
    setViewport(false)

    render(
      <EHRResponsiveShell category="mobile-first" activeView="notes" navItems={navItems}>
        <div data-testid="content">Notes content</div>
      </EHRResponsiveShell>,
    )

    // Mobile layout has bottom nav, no sidebar "EHR" heading
    expect(screen.queryByText('EHR')).not.toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'EHR navigation' })).toBeInTheDocument()
  })

  it('mobile layout nav items have 44px minimum touch targets', () => {
    setViewport(false)

    render(
      <EHRResponsiveShell category="mobile-first" activeView="notes" navItems={navItems}>
        <div>Content</div>
      </EHRResponsiveShell>,
    )

    const navLinks = screen.getAllByRole('link')
    // Nav items should have min-h-[44px] class
    for (const link of navLinks) {
      expect(link.className).toContain('min-h-[44px]')
    }
  })

  it('marks the active nav item with aria-current="page"', () => {
    setViewport(false)

    render(
      <EHRResponsiveShell category="mobile-first" activeView="scheduling" navItems={navItems}>
        <div>Content</div>
      </EHRResponsiveShell>,
    )

    const activeLink = screen.getByLabelText('Scheduling')
    expect(activeLink).toHaveAttribute('aria-current', 'page')

    const inactiveLink = screen.getByLabelText('Notes')
    expect(inactiveLink).not.toHaveAttribute('aria-current')
  })

  it('desktop layout has a 256px sidebar', () => {
    setViewport(true)

    render(
      <EHRResponsiveShell category="desktop-optimized" activeView="chart" navItems={navItems}>
        <div>Chart</div>
      </EHRResponsiveShell>,
    )

    // aside has aria-label="EHR navigation" and renders as complementary role
    const aside = screen.getByRole('complementary', { name: 'EHR navigation' })
    expect(aside.style.width).toBe('256px')
  })

  it('renders all nav item labels', () => {
    setViewport(false)

    render(
      <EHRResponsiveShell category="mobile-first" activeView="notes" navItems={navItems}>
        <div>Content</div>
      </EHRResponsiveShell>,
    )

    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    expect(screen.getByLabelText('Scheduling')).toBeInTheDocument()
    expect(screen.getByLabelText('Messaging')).toBeInTheDocument()
  })

  it('calls onClick handler when nav item is clicked', () => {
    setViewport(false)

    const onClick = vi.fn()
    const itemsWithClick: EHRRNavItem[] = [
      { id: 'notes', label: 'Notes', icon: <span />, onClick },
    ]

    render(
      <EHRResponsiveShell category="mobile-first" activeView="notes" navItems={itemsWithClick}>
        <div>Content</div>
      </EHRResponsiveShell>,
    )

    const link = screen.getByLabelText('Notes')
    link.click()

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
