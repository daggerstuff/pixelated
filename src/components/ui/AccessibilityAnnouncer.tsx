import React, { useEffect, useState } from 'react'

interface Message {
  /** The message to be announced */
  message: string
  /** Whether to use assertive or polite announcement */
  assertive?: boolean
  /** Delay in milliseconds before clearing the message */
  clearDelay?: number
}

/**
 * A component that announces messages to screen readers
 *
 * @param props - The component props
 * @param props.message - The message to announce
 * @param props.assertive - Whether to use assertive (true) or polite (false) announcements
 * @param props.clearDelay - How long to wait before clearing the message (ms)
 */
export function AccessibilityAnnouncer({
  message,
  assertive = false,
  clearDelay = 1000,
}: Message) {
  const [currentMessage, setCurrentMessage] = useState('')

  useEffect(() => {
    if (message) {
      setCurrentMessage(message)
      if (clearDelay > 0) {
        const timer = setTimeout(() => {
          setCurrentMessage('')
        }, clearDelay)
        return () => clearTimeout(timer)
      }
      // If clearDelay is 0 or less, immediately clear the message for accessibility.
      // This ensures screen readers do not announce stale or empty messages.
      // See: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19 for best practices.
    } else {
      setCurrentMessage('') // Immediately clear message for accessibility when clearDelay <= 0
    }
    // Implicitly returns undefined if no timer was set, which is valid for useEffect cleanup.
  }, [message, clearDelay])

  return (
    <div
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  )
}

/**
 * Utility function to announce a message to screen readers
 * without needing to render a component
 */
export function announceToScreenReader(
  message: string,
  options: { assertive?: boolean; clearDelay?: number } = {},
): void {
  const { assertive = false, clearDelay = 1000 } = options

  // Create a temporary element for the announcemen
  const announcer = document.createElement('div')
  announcer.className = 'sr-only'
  announcer.setAttribute('aria-live', assertive ? 'assertive' : 'polite')
  announcer.setAttribute('aria-atomic', 'true')

  // Add to DOM
  document.body.appendChild(announcer)

  // Set the message (slight delay to ensure screen readers pick it up)
  setTimeout(() => {
    announcer.textContent = message
  }, 50)

  // Remove after the specified delay
  setTimeout(() => {
    if (document.body.contains(announcer)) {
      document.body.removeChild(announcer)
    }
  }, clearDelay + 100)
}

/**
 * Announces messages to screen readers
 * @param {object} message - The message configuration
 * @param {string} message.message - The text to be announced
 * @param {boolean} [message.assertive] - Whether to use assertive announcemen
 * @param {number} [message.clearDelay] - Delay before clearing in milliseconds
 */
export function announce(message: Message): void {
  const { assertive = false, clearDelay = 1000 } = message
  const element = document.getElementById(
    assertive ? 'assertive-announce' : 'polite-announce',
  )

  if (element) {
    element.textContent = message.message
    if (clearDelay > 0) {
      setTimeout(() => {
        element.textContent = ''
      }, clearDelay)
    }
  }
}
