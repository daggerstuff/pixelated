/**
 * Mobile Viewport Utilities
 *
 * Handles common mobile browser viewport issues
 */

// Fix for iOS Safari dynamic viewport height (address bar appearance/disappearance)
function setupViewportHeight() {
  const updateViewportHeight = () => {
    // Set CSS variable to current viewport height
    document.documentElement.style.setProperty(
      '--viewport-height',
      `${window.innerHeight}px`,
    )
  }

  // Update on resize
  window.addEventListener('resize', updateViewportHeight)

  // Update on orientation change
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure accurate height after orientation change completes
    setTimeout(updateViewportHeight, 100)
  })

  // Initial update
  updateViewportHeight()
}

// Fix for input fields being covered by keyboard
function setupFormFieldVisibility() {
  // Improved version with better iOS support
  const formFields = document.querySelectorAll('input, textarea, select')

  formFields.forEach((field) => {
    // Focus event handler
    field.addEventListener('focus', () => {
      // Check if it's iOS
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

      if (isIOS) {
        // iOS-specific handling with additional delay and position adjustment
        setTimeout(() => {
          // Calculate position to ensure field is visible
          const rect = field.getBoundingClientRect()
          const fieldTop = rect.top
          const fieldBottom = rect.bottom
          const viewportHeight = window.innerHeight

          // Check if field is obscured by keyboard (estimated keyboard height 40% of screen)
          const estimatedKeyboardHeight = viewportHeight * 0.4
          const isObscured =
            fieldBottom > viewportHeight - estimatedKeyboardHeight

          if (isObscured) {
            // Add extra offset for iOS to ensure field is well above keyboard
            const scrollOffset = fieldTop - 100
            window.scrollTo({
              top: window.scrollY + scrollOffset,
              behavior: 'smooth',
            })
          }
        }, 400) // Longer delay for iOS keyboard to fully appear
      } else {
        // Standard behavior for other platforms
        setTimeout(() => {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    })

    // Handle orientation changes which can cause issues with keyboard and input visibility
    window.addEventListener('orientationchange', () => {
      if (document.activeElement === field) {
        setTimeout(() => {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 500) // Extra delay after orientation change
      }
    })
  })

  // Additional handler for form submissions to ensure the form isn't jumping around
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      // Blur any focused element to hide the keyboard before submission
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    })
  })
}

// Fix for double-tap zoom on iOS
function disableDoubleTapZoom() {
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        event.preventDefault()
      }
      lastTouchEnd = now
    },
    { passive: false },
  )
}

// Check if device is iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

// Check if device is Android
function isAndroid() {
  return /Android/.test(navigator.userAgent)
}

// Enhanced form validation for mobile devices
function setupMobileFormValidation() {
  // Find all validation error elements
  const errorElements = document.querySelectorAll('[id$="-error"]')

  // Add shake animation when error elements are displayed
  const observeErrorVisibility = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        const errorElement = mutation.target
        if (
          errorElement instanceof HTMLElement &&
          errorElement.style.display !== 'none' &&
          errorElement.offsetParent !== null
        ) {
          // Get the associated input field
          const inputId = errorElement.id.replace('-error', '')
          const inputField = document.getElementById(inputId)

          if (inputField) {
            // Add shake class to trigger animation
            inputField.classList.add('shake')

            // Vibrate for haptic feedback if available
            if ('vibrate' in navigator) {
              navigator.vibrate([10, 30, 10])
            }

            // Remove class after animation completes
            setTimeout(() => {
              inputField.classList.remove('shake')
            }, 500)
          }
        }
      }
    })
  })

  // Observe all error elements for visibility changes
  errorElements.forEach((element) => {
    observeErrorVisibility.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
    })
  })

  // Handle inline validation on blur for inputs without dedicated validation
  const formInputs = document.querySelectorAll('input, textarea, select')
  formInputs.forEach((input) => {
    // Skip if managed by React component
    if (input.hasAttribute('data-managed-validation')) {
      return
    }

    input.addEventListener('blur', () => {
      let hasError = false

      // Basic validation based on type
      if (input.hasAttribute('required') && !input.value.trim()) {
        hasError = true
        input.setAttribute('aria-invalid', 'true')
      } else if (input.type === 'email' && input.value) {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        hasError = !emailRegex.test(input.value)
        input.setAttribute('aria-invalid', hasError ? 'true' : 'false')
      } else if (input.hasAttribute('minlength') && input.value) {
        // Minlength validation
        const minLength = parseInt(input.getAttribute('minlength') || '0', 10)
        hasError = input.value.length < minLength
        input.setAttribute('aria-invalid', hasError ? 'true' : 'false')
      } else if (input.value) {
        // Valid value
        input.setAttribute('aria-invalid', 'false')
      }

      // Add visual indication for feedback
      if (hasError && !input.classList.contains('shake')) {
        input.classList.add('shake')

        // Vibrate for haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50)
        }

        setTimeout(() => {
          input.classList.remove('shake')
        }, 500)
      }
    })
  })

  // Enhanced feedback for form submission errors
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener(
      'invalid',
      (e) => {
        // Prevent default browser validation popups
        e.preventDefault()

        // Get the invalid field
        const invalidField = e.target

        if (invalidField instanceof HTMLElement) {
          // Scroll to the invalid field
          setTimeout(() => {
            invalidField.scrollIntoView({ behavior: 'smooth', block: 'center' })
            invalidField.focus()

            // Add visual feedback
            invalidField.classList.add('shake')

            // Haptic feedback
            if ('vibrate' in navigator) {
              navigator.vibrate([50, 100, 50])
            }

            setTimeout(() => {
              invalidField.classList.remove('shake')
            }, 500)
          }, 100)
        }
      },
      true,
    ) // Use capture to intercept before bubbling
  })
}

// Apply platform-specific fixes
function applyPlatformSpecificFixes() {
  if (isIOS()) {
    // Add iOS-specific class to HTML element
    document.documentElement.classList.add('ios-device')

    // Apply iOS-specific fixes
    setupViewportHeight()
    disableDoubleTapZoom()
  }

  if (isAndroid()) {
    // Add Android-specific class to HTML element
    document.documentElement.classList.add('android-device')

    // Android-specific fixes can be added here if needed
  }

  // Apply fixes for all mobile devices
  setupFormFieldVisibility()
  setupMobileFormValidation()
}

// Initialize all fixes
function initMobileViewportFixes() {
  // Only apply on mobile devices
  if (window.innerWidth < 1024 || isIOS() || isAndroid()) {
    applyPlatformSpecificFixes()
  }
}

// Export functions for use in other modules
export {
  initMobileViewportFixes,
  setupViewportHeight,
  setupFormFieldVisibility,
  setupMobileFormValidation,
  isIOS,
  isAndroid,
}

// Auto-initialize when included directly in a script tag
if (typeof document !== 'undefined') {
  // Run when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileViewportFixes)
  } else {
    initMobileViewportFixes()
  }
}
