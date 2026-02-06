// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { Header } from '../HeaderReact'
import '@testing-library/jest-dom/vitest'

// Mock dependencies
vi.mock('../../ui/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}))

vi.mock('../Navigation', () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>,
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: null, isPending: false })),
  },
}))

// Mock SearchBox since it renders in the portal/modal
vi.mock('../../ui/SearchBox', () => ({
  default: () => <div data-testid="search-box">SearchBox</div>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Header Component', () => {
  it('renders mobile menu button with correct aria-label', () => {
    render(<Header />)
    // It might be hidden on desktop, but it renders in DOM
    const mobileMenuBtn = screen.getByRole('button', {
      name: /toggle mobile menu/i,
    })
    expect(mobileMenuBtn).toBeInTheDocument()
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders notification button with correct aria-label', () => {
    render(<Header />)
    const notificationBtn = screen.getByRole('button', {
      name: /view notifications/i,
    })
    expect(notificationBtn).toBeInTheDocument()
  })

  it('renders search toggle button with correct aria-label and shortcut hint', () => {
    render(<Header />)
    const searchBtn = screen.getByRole('button', { name: /search/i })
    expect(searchBtn).toBeInTheDocument()
    expect(searchBtn).toHaveAttribute('title', expect.stringContaining('Cmd+K'))
  })

  it('opens search modal on click and closes on close button click', async () => {
    const user = userEvent.setup()
    render(<Header />)

    const searchBtn = screen.getByRole('button', { name: /search/i })
    await user.click(searchBtn)

    const closeBtn = await screen.findByRole('button', {
      name: /close search/i,
    })
    expect(closeBtn).toBeInTheDocument()

    await user.click(closeBtn)

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /close search/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('toggles search modal on Cmd+K', async () => {
    const user = userEvent.setup()
    render(<Header />)

    // Simulate Cmd+K
    await user.keyboard('{Meta>}k{/Meta}')

    const closeBtn = await screen.findByRole('button', {
      name: /close search/i,
    })
    expect(closeBtn).toBeInTheDocument()

    // Simulate Escape to close (handled by SearchBox usually, but here we just check toggle logic if implemented in Header)
    // Wait, the Header handles the modal visibility state.
    // Let's toggle it off with Cmd+K again if we implement that toggle behavior
    await user.keyboard('{Meta>}k{/Meta}')

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /close search/i }),
      ).not.toBeInTheDocument()
    })
  })
})
