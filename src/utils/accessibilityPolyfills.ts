/**
 * Polyfills for accessibility features in older browsers
 */

/**
 * Adds focus-visible polyfill for browsers that don't support i
 */
export function addFocusVisiblePolyfill(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Check if browser supports :focus-visible
  const supportsFocusVisible =
    'CSS' in window && CSS.supports('selector(:focus-visible)')

  if (!supportsFocusVisible) {
    // Add a class to the html elemen
    document.documentElement.classList.add('no-focus-visible')

    // Add event listeners to track keyboard vs mouse focus
    let hadKeyboardEvent = false
    const keyboardThrottleTimeoutId = { current: null as number | null }

    // Track the element that had focus before for debugging/logging purposes
    const focusTracker = {
      previousActiveElement: null as Element | null,
      trackFocusChange() {
        this.previousActiveElement = document.activeElemen
      },
      reset() {
        this.previousActiveElement = null
      },
    }

    // Event handlers
    const handlers = {
      // Handle keydown events
      handleKeyDown(e: KeyboardEvent): void {
        // Only keyboard events that might trigger focus change
        if (
          e.key === 'Tab' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight'
        ) {
          hadKeyboardEvent = true

          // Throttle setting the className to avoid layout thrashing
          if (keyboardThrottleTimeoutId.current !== null) {
            clearTimeout(keyboardThrottleTimeoutId.current)
          }

          keyboardThrottleTimeoutId.current = setTimeout(() => {
            keyboardThrottleTimeoutId.current = null
          }, 100) as unknown as number
        }
      },

      // Handle pointer down events
      handlePointerDown(): void {
        hadKeyboardEvent = false
      },

      // Handle focus events
      handleFocus(): void {
        if (hadKeyboardEvent) {
          document.documentElement.classList.add('focus-visible')
          focusTracker.trackFocusChange()
        }
      },

      // Handle blur events
      handleBlur(): void {
        document.documentElement.classList.remove('focus-visible')
        focusTracker.reset()
      },
    }

    // Register event listeners
    document.addEventListener('keydown', handlers.handleKeyDown, true)
    document.addEventListener('pointerdown', handlers.handlePointerDown, true)
    document.addEventListener('focus', handlers.handleFocus, true)
    document.addEventListener('blur', handlers.handleBlur, true)
  }
}

/**
 * Utility function to check for common accessibility issues
 * This runs only in development mode and provides console warnings
 * to guide developers in improving accessibility
 */
export function checkAccessibility() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return
  }

  // Wait for DOM to be fully loaded
  window.addEventListener('DOMContentLoaded', () => {
    // Check for buttons with icon-only content
    document.querySelectorAll('button').forEach((button) => {
      const buttonText = button.textContent?.trim()
      const hasImage = button.querySelector('img, svg')
      const hasAriaLabel =
        button.hasAttribute('aria-label') ||
        button.hasAttribute('aria-labelledby')

      if ((!buttonText || buttonText === '') && hasImage && !hasAriaLabel) {
        console.warn(
          'Accessibility issue: Button with icon only should have aria-label or aria-labelledby attribute',
          button,
        )
      }
    })

    // Check for images without alt text
    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('alt')) {
        console.warn('Accessibility issue: Image missing alt attribute', img)
      }
    })

    // Check for form inputs without labels
    document.querySelectorAll('input, select, textarea').forEach((input) => {
      const id = input.getAttribute('id')
      if (id) {
        const hasLabel = document.querySelector(`label[for="${id}"]`)
        const hasAriaLabel =
          input.hasAttribute('aria-label') ||
          input.hasAttribute('aria-labelledby')

        if (!hasLabel && !hasAriaLabel) {
          console.warn(
            'Accessibility issue: Form input missing associated label',
            input,
          )
        }
      } else {
        console.warn(
          'Accessibility issue: Form input should have an ID to associate with a label',
          input,
        )
      }
    })

    // Check for proper heading structure
    const headings = Array.from(
      document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    )
    let previousLevel = 0

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1))

      // Check for skipped heading levels (e.g., h1 to h3)
      if (previousLevel > 0 && level > previousLevel + 1) {
        console.warn(
          `Accessibility issue: Heading level skipped from h${previousLevel} to h${level}`,
          heading,
        )
      }

      previousLevel = level
    })
  })
}

// Auto-initialize in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  document.addEventListener('astro:page-load', checkAccessibility)
}
