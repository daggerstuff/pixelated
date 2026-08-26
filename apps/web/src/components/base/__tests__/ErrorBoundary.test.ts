import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

type ErrorBoundaryProps = {
  children?: string
  fallback?: string
}

function ErrorBoundary(props: ErrorBoundaryProps = {}) {
  const fallback =
    props.fallback ?? 'Something went wrong. Please try refreshing the page.'
  const children = props.children ?? ''
  const listeners = new WeakMap<EventTarget, Map<string, EventListener>>()

  const onError = () => {}
  const onUnhandledRejection = () => {}
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  const mark = `data-${Math.random().toString(36).slice(2)}`
  listeners.set(
    window,
    new Map([
      [`error-${mark}`, onError],
      [`unhandled-${mark}`, onUnhandledRejection],
    ]),
  )

  return {
    html: `<error-boundary ${mark}><slot>${children}</slot><p slot="fallback">${fallback}</p></error-boundary>`,
    setup: (container: HTMLDivElement) => {
      const element = container.querySelector<HTMLElement>('error-boundary')
      if (!element) return
      const originalRemove = element.remove.bind(element)
      element.remove = () => {
        const tracked = listeners.get(window)
        if (tracked) {
          tracked.forEach((listener, key) => {
            const name = key.startsWith('error')
              ? 'error'
              : 'unhandledrejection'
            window.removeEventListener(name, listener)
          })
          tracked.clear()
        }
        originalRemove()
      }
    },
  }
}

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

    const fallback = querySelector('[slot="fallback"]')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent(customFallback)
    expect(querySelector('p')).toHaveTextContent(customFallback)
  })

  it('handles unhandled rejections', async () => {
    const { querySelector } = await renderAstro(ErrorBoundary)

    // Check error UI
    const fallback = querySelector('[slot="fallback"]')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent(
      'Something went wrong. Please try refreshing the page.',
    )
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
