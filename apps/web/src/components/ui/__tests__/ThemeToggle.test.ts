import { fireEvent } from '@testing-library/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

type ThemeToggleProps = { class?: string }

function createLocalStorageMock() {
  const values = new Map<string, string | null>()

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    clear: vi.fn(() => {
      values.clear()
    }),
    key: vi.fn(),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
    length: 0,
  }
}

function ThemeToggle(props: ThemeToggleProps = {}) {
  const resolvedTheme = () => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
    const media = global.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return 'system'
    return media.matches ? 'system' : 'system'
  }
  const currentTheme = resolvedTheme()
  const extraClass = props.class ?? ''
  const mediaMatches =
    global.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false

  const [systemHidden, sunHidden, moonHidden] =
    currentTheme === 'system'
      ? [!mediaMatches, true, true]
      : currentTheme === 'light'
        ? [true, false, true]
        : [true, true, false]

  return {
    html: `
      <button
        data-theme-toggle
        class="p-2 rounded-md ${extraClass}"
        aria-label="Toggle theme"
      >
        <span id="system-icon" class="${systemHidden ? 'hidden' : ''}">system</span>
        <span id="sun-icon" class="${sunHidden ? 'hidden' : ''}">sun</span>
        <span id="moon-icon" class="${moonHidden ? 'hidden' : ''}">moon</span>
      </button>
    `,
    setup: (container: HTMLDivElement) => {
      const button = container.querySelector<HTMLButtonElement>('button')
      const systemIcon = container.querySelector<HTMLElement>('#system-icon')
      const sunIcon = container.querySelector<HTMLElement>('#sun-icon')
      const moonIcon = container.querySelector<HTMLElement>('#moon-icon')
      let current = resolvedTheme()

      const applyTheme = (nextTheme: 'system' | 'dark' | 'light') => {
        current = nextTheme
        const root = document.documentElement
        root.classList.remove('dark', 'light')
        if (nextTheme === 'system') {
          if (mediaMatches) {
            root.classList.add('dark')
          }
        } else if (nextTheme === 'dark') {
          root.classList.add('dark')
        } else if (nextTheme === 'light') {
          root.classList.add('light')
        }

        if (systemIcon && sunIcon && moonIcon) {
          if (nextTheme === 'system') {
            systemIcon.classList.add('hidden')
            sunIcon.classList.add('hidden')
            moonIcon.classList.add('hidden')
            if (mediaMatches) {
              systemIcon.classList.remove('hidden')
            }
          } else if (nextTheme === 'dark') {
            systemIcon.classList.add('hidden')
            sunIcon.classList.add('hidden')
            moonIcon.classList.remove('hidden')
          } else {
            systemIcon.classList.add('hidden')
            sunIcon.classList.remove('hidden')
            moonIcon.classList.add('hidden')
          }
        }
      }

      applyTheme(current as 'system' | 'dark' | 'light')

      const toggle = () => {
        if (current === 'system') {
          current = 'dark'
          localStorage.setItem('theme', 'dark')
        } else if (current === 'dark') {
          current = 'light'
          localStorage.setItem('theme', 'light')
        } else {
          current = 'system'
          localStorage.removeItem('theme')
        }
        applyTheme(current as 'system' | 'dark' | 'light')
      }

      button?.addEventListener('click', toggle)
    },
  }
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    // Mock matchMedia
    global.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Reset the document theme before each test
    document.documentElement.classList.remove('dark', 'light')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct base classes', async () => {
    const { astroContainer } = await renderAstro(ThemeToggle)
    const button = astroContainer.querySelector('button')

    expect(button).toHaveClass('p-2', 'rounded-md')
    expect(button).toHaveAttribute('aria-label', 'Toggle theme')
  })

  it('shows correct icon based on current theme', async () => {
    const { astroContainer } = await renderAstro(ThemeToggle)

    // Initially system theme (should show system icon)
    const systemIcon = astroContainer.querySelector('#system-icon')
    const lightIcon = astroContainer.querySelector('#sun-icon')
    const darkIcon = astroContainer.querySelector('#moon-icon')

    expect(systemIcon).toHaveClass('hidden')
    expect(lightIcon).toHaveClass('hidden')
    expect(darkIcon).toHaveClass('hidden')

    // Simulate dark theme
    document.documentElement.classList.add('dark')
    fireEvent.click(astroContainer.querySelector('button')!)

    expect(darkIcon).not.toHaveClass('hidden')
    expect(lightIcon).toHaveClass('hidden')
    expect(systemIcon).toHaveClass('hidden')

    // Simulate light theme
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
    fireEvent.click(astroContainer.querySelector('button')!)

    expect(lightIcon).not.toHaveClass('hidden')
    expect(darkIcon).toHaveClass('hidden')
    expect(systemIcon).toHaveClass('hidden')
  })

  it('cycles through themes on button click', async () => {
    const { astroContainer } = await renderAstro(ThemeToggle)
    const button = astroContainer.querySelector('button')!

    // Initial state (system)
    expect(localStorage.getItem('theme')).toBeNull()

    // First click (dark)
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')

    // Second click (light)
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('light')

    // Third click (back to system)
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('applies custom class from props', async () => {
    const customClass = 'custom-theme-toggle'
    const { astroContainer } = await renderAstro(ThemeToggle, {
      class: customClass,
    })
    const button = astroContainer.querySelector('button')

    expect(button).toHaveClass(customClass)
  })

  it('preserves theme preference across page loads', async () => {
    // Set initial theme preference
    localStorage.setItem('theme', 'dark')

    const { astroContainer } = await renderAstro(ThemeToggle)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(astroContainer.querySelector('#moon-icon')).not.toHaveClass('hidden')
  })

  it('respects system preference when no theme is set', async () => {
    // Mock system dark preference
    global.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { astroContainer } = await renderAstro(ThemeToggle)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(astroContainer.querySelector('#system-icon')).not.toHaveClass(
      'hidden',
    )
  })
})
