import React, { useEffect, useRef } from 'react'

interface FocusTrapProps {
  /**
   * Whether the focus trap is active
   */
  active: boolean

  /**
   * The content to trap focus within
   */
  children: React.ReactNode

  /**
   * Element to return focus to when the trap is deactivated
   */
  returnFocusTo?: HTMLElement | null

  /**
   * Whether to initially focus the first focusable element
   * @default true
   */
  autoFocus?: boolean

  /**
   * Called when user tries to escape focus trap with Tab or Shift+Tab
   */
  onEscape?: () => void

  /**
   * Additional classNames for the container
   */
  className?: string
}

/**
 * A component that traps focus within a container, making it accessible for keyboard and screen reader users.
 *
 * When a modal or overlay is displayed, focus should be trapped within that element to prevent
 * users from accidentally interacting with content behind it.
 */
export function FocusTrap({
  active,
  children,
  returnFocusTo,
  autoFocus = true,
  onEscape,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(returnFocusTo || null)

  // Find all focusable elements within the container
  const getFocusableElements = () => {
    if (!containerRef.current) {
      return []
    }

    // Selector for all focusable elements
    const selector = [
      'a[href]:not([tabindex="-1"])',
      'area[href]:not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]:not([tabindex="-1"])',
    ].join(',')

    // Get elements matching selector that are visible (not hidden by CSS)
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector),
    ).filter(
      (el) =>
        // Check if element is visible
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        window.getComputedStyle(el).visibility !== 'hidden',
    )
  }

  // Save previous active element and set focus when trap is activated
  useEffect(() => {
    if (active) {
      // Save the element that had focus before the trap was activated
      if (
        !previousFocusRef.current &&
        document.activeElement instanceof HTMLElement
      ) {
        previousFocusRef.current = document.activeElement
      }

      // Auto-focus the first focusable element when activated
      if (autoFocus) {
        setTimeout(() => {
          const focusableElements = getFocusableElements()
          if (focusableElements.length > 0 && focusableElements[0]) {
            focusableElements[0].focus()
          } else if (containerRef.current) {
            // If no focusable elements, focus the container itself
            containerRef.current.setAttribute('tabindex', '-1')
            containerRef.current?.focus()
          }
        }, 50) // Small delay to ensure the DOM is ready
      }
    }
  }, [active, autoFocus])

  // Return focus when trap is deactivated
  useEffect(() => {
    return () => {
      if (previousFocusRef.current) {
        setTimeout(() => {
          previousFocusRef.current?.focus()
        }, 0)
      }
    }
  }, [])

  // Handle tab key to trap focus within the container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!active || e.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) {
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const { activeElement } = document

    // If Shift+Tab and on first element, wrap to last element
    if (e.shiftKey && activeElement === firstElement) {
      e.preventDefault()
      if (lastElement) {
        lastElement.focus()
      }
    }
    // If Tab and on last element, wrap to first element
    else if (!e.shiftKey && activeElement === lastElement) {
      e.preventDefault()
      if (firstElement) {
        firstElement.focus()
      }
      if (onEscape) {
        onEscape()
      }
    }
  }

  // Don't render anything if not active
  if (!active) {
    return <>{children}</>
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={className}
      // These help screen readers understand this is a modal/dialog
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

export default FocusTrap
