import { fireEvent } from '@testing-library/dom'
import { renderAstro } from '@/test/utils/astro'
import ThemeToggle from '../ThemeToggle.astro'

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
      removeItem: vi.fn(),
    }
    global.localStorage = localStorageMock as Storage

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
    const { astroContainer } = await renderAstro(ThemeToggle as any)
    const button = astroContainer.querySelector('button')

    expect(button).toHaveClass('p-2', 'rounded-md')
    expect(button).toHaveAttribute('aria-label', 'Toggle theme')
  })

  it('shows correct icon based on current theme', async () => {
    const { astroContainer } = await renderAstro(ThemeToggle as any)

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
    const { astroContainer } = await renderAstro(ThemeToggle as any)
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
    const { astroContainer } = await renderAstro(ThemeToggle as any, { class: customClass })
    const button = astroContainer.querySelector('button')

    expect(button).toHaveClass(customClass)
  })

  it('preserves theme preference across page loads', async () => {
    // Set initial theme preference
    localStorage.setItem('theme', 'dark')

    const { astroContainer } = await renderAstro(ThemeToggle as any)

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

    const { astroContainer } = await renderAstro(ThemeToggle as any)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(astroContainer.querySelector('#system-icon')).not.toHaveClass('hidden')
  })
})
