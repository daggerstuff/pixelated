import ErrorBoundary from '../ErrorBoundary.astro'
import { renderAstro } from '@/test/utils/astro'

describe('ErrorBoundary', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders children when no error occurs', async () => {
    const { querySelector } = await renderAstro(ErrorBoundary, {
      children: '<div data-testid="test-content">Test Content</div>',
    })

    const content = querySelector('[data-testid="test-content"]')
    expect(content).toBeInTheDocument()
    expect(content).toHaveTextContent('Test Content')
  })

  it('renders with custom fallback message', async () => {
    const customFallback = 'Custom error message'
    const { querySelector } = await renderAstro(ErrorBoundary, {
      fallback: customFallback,
    })

    // Simulate error
    const errorBoundary = querySelector('error-boundary')
    const instance = customElements.get('error-boundary')
    const error = new Error('Test error')

    // Verify instance exists and then trigger error handler
    expect(instance).toBeDefined()
    instance!.prototype.handleError.call(
      errorBoundary,
      new ErrorEvent('error', { error }),
    )

    // Check fallback content
    expect(querySelector('h2')).toHaveTextContent('Oops!')
    expect(querySelector('p')).toHaveTextContent(customFallback)
    expect(querySelector('button')).toHaveTextContent('Refresh Page')
  })

  it('handles unhandled rejections', async () => {
    const { querySelector } = await renderAstro(ErrorBoundary)

    // Simulate unhandled rejection
    const errorBoundary = querySelector('error-boundary')!
    const instance = customElements.get('error-boundary')
    const error = new Error('Test rejection')

    // Verify instance exists and then trigger error handler
    expect(instance).toBeDefined()
    instance!.prototype.handleError.call(
      errorBoundary,
      new PromiseRejectionEvent('unhandledrejection', {
        reason: error,
        promise: Promise.reject(error),
      }),
    )

    // Check error UI
    expect(querySelector('h2')).toHaveTextContent('Oops!')
    expect(querySelector('button')).toBeInTheDocument()
  })

  it('cleans up event listeners on disconnect', async () => {
    const { querySelector } = await renderAstro(ErrorBoundary)

    const errorBoundary = querySelector('error-boundary')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    // Simulate disconnection
    errorBoundary?.remove()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function),
    )
  })
})
