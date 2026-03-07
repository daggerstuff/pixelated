import { fireEvent, render, screen } from '@testing-library/react'
import { useErrorBoundary } from '../ErrorBoundary'
import { useSecurity } from '../SecurityProvider'
import { SharedProviders } from '../SharedProviders'
import { useTheme } from '../ThemeProvider'

// Mock components for testing providers
function ThemeConsumer() {
  const { colorScheme, setColorScheme } = useTheme()
  return (
    <div>
      <div data-testid="color-scheme">{colorScheme}</div>
      <button onClick={() => setColorScheme('dark')}>Set Dark</button>
    </div>
  )
}

function SecurityConsumer() {
  const { securityLevel, setSecurityLevel } = useSecurity()
  return (
    <div>
      <div data-testid="security-level">{securityLevel}</div>
      <button onClick={() => setSecurityLevel('hipaa')}>Set HIPAA</button>
    </div>
  )
}

function ErrorThrower() {
  const { throwError } = useErrorBoundary()
  return (
    <button onClick={() => throwError(new Error('Test error'))}>
      Throw Error
    </button>
  )
}

describe('providers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear()
  })

  it('provides theme context and allows theme changes', () => {
    render(
      <SharedProviders>
        <ThemeConsumer />
      </SharedProviders>,
    )

    // Check initial theme
    expect(screen.getByTestId('color-scheme')).toHaveTextContent('system')

    // Change theme
    fireEvent.click(screen.getByText('Set Dark'))
    expect(screen.getByTestId('color-scheme')).toHaveTextContent('dark')
  })

  it('provides security context and allows security level changes', () => {
    render(
      <SharedProviders>
        <SecurityConsumer />
      </SharedProviders>,
    )

    // Check initial security level
    expect(screen.getByTestId('security-level')).toHaveTextContent('standard')

    // Change security level
    fireEvent.click(screen.getByText('Set HIPAA'))
    expect(screen.getByTestId('security-level')).toHaveTextContent('hipaa')
  })

  it('catches and handles errors with error boundary', () => {
    const onError = vi.fn()

    render(
      <SharedProviders onError={onError}>
        <ErrorThrower />
      </SharedProviders>,
    )

    // Trigger error
    fireEvent.click(screen.getByText('Throw Error'))

    // Check if error UI is shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()

    // Check if error handler was called
    expect(onError).toHaveBeenCalled()
  })

  it('persists theme preference in localStorage', () => {
    const { unmount } = render(
      <SharedProviders>
        <ThemeConsumer />
      </SharedProviders>,
    )

    // Change theme
    fireEvent.click(screen.getByText('Set Dark'))

    // Unmount and remount to test persistence
    unmount()

    render(
      <SharedProviders>
        <ThemeConsumer />
      </SharedProviders>,
    )

    // Check if theme preference was restored
    expect(screen.getByTestId('color-scheme')).toHaveTextContent('dark')
  })

  it('handles nested providers correctly', () => {
    render(
      <SharedProviders>
        <div>
          <ThemeConsumer />
          <SecurityConsumer />
        </div>
      </SharedProviders>,
    )

    // Test theme changes
    fireEvent.click(screen.getByText('Set Dark'))
    expect(screen.getByTestId('color-scheme')).toHaveTextContent('dark')

    // Test security level changes
    fireEvent.click(screen.getByText('Set HIPAA'))
    expect(screen.getByTestId('security-level')).toHaveTextContent('hipaa')
  })
})
