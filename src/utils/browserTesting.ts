/**
 * Browser compatibility testing utilities
 */

export interface BrowserInfo {
  name: string
  version: string
  os: string
  supportsAriaLive: boolean
  supportsReducedMotion: boolean
  supportsHighContrast: boolean
  supportsFocusVisible: boolean
}

/**
 * Detects current browser information
 * @returns Browser information object
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === 'undefined') {
    return {
      name: 'Server',
      version: 'N/A',
      os: 'Server',
      supportsAriaLive: true,
      supportsReducedMotion: true,
      supportsHighContrast: true,
      supportsFocusVisible: true,
    }
  }

  const { userAgent } = navigator
  let browserName = 'Unknown'
  let browserVersion = 'Unknown'
  let os = 'Unknown'

  // Detect browser
  if (userAgent.includes('Firefox')) {
    browserName = 'Firefox'
    browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge'
    browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (userAgent.includes('Chrome')) {
    browserName = 'Chrome'
    browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (userAgent.includes('Safari')) {
    browserName = 'Safari'
    browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
    browserName = 'Internet Explorer'
    browserVersion = userAgent.match(/(?:MSIE |rv:)([0-9.]+)/)?.[1] || 'Unknown'
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows'
  } else if (userAgent.includes('Mac')) {
    os = 'macOS'
  } else if (userAgent.includes('Linux')) {
    os = 'Linux'
  } else if (userAgent.includes('Android')) {
    os = 'Android'
  } else if (
    userAgent.includes('iOS') ||
    userAgent.includes('iPhone') ||
    userAgent.includes('iPad')
  ) {
    os = 'iOS'
  }

  // Feature detection
  const supportsAriaLive = 'role' in document.createElement('div')
  const supportsReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)') !== null
  const supportsHighContrast =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(forced-colors: active)') !== null
  const supportsFocusVisible =
    'CSS' in window && CSS.supports('selector(:focus-visible)')

  return {
    name: browserName,
    version: browserVersion,
    os,
    supportsAriaLive,
    supportsReducedMotion,
    supportsHighContrast,
    supportsFocusVisible,
  }
}

/**
 * Tests if ARIA live regions are working correctly
 * @returns Promise that resolves with test results
 */
export async function testAriaLiveAnnouncements(): Promise<{
  success: boolean
  message: string
}> {
  return new Promise((resolve) => {
    // Create test elements
    const testContainer = document.createElement('div')
    testContainer.style.position = 'absolute'
    testContainer.style.left = '-9999px'
    testContainer.setAttribute('aria-live', 'polite')
    document.body.appendChild(testContainer)

    // Set a timeout to update the content
    setTimeout(() => {
      testContainer.textContent = 'Test announcement'

      // Give time for screen readers to process
      setTimeout(() => {
        document.body.removeChild(testContainer)
        resolve({
          success: true,
          message:
            'ARIA live region test completed. Please verify the test announcement was spoken by your screen reader.',
        })
      }, 1000)
    }, 500)
  })
}

/**
 * Tests if focus management is working correctly
 * @returns Test results
 */
export function testFocusManagement(): { success: boolean; message: string } {
  // Create test elements
  const button1 = document.createElement('button')
  button1.textContent = 'Button 1'
  button1.id = 'test-button-1'

  const button2 = document.createElement('button')
  button2.textContent = 'Button 2'
  button2.id = 'test-button-2'

  const testContainer = document.createElement('div')
  testContainer.style.position = 'absolute'
  testContainer.style.left = '-9999px'
  testContainer.appendChild(button1)
  testContainer.appendChild(button2)
  document.body.appendChild(testContainer)

  // Test focus
  button1.focus()
  const button1HasFocus = document.activeElement === button1

  button2.focus()
  const button2HasFocus = document.activeElement === button2

  // Clean up
  document.body.removeChild(testContainer)

  return {
    success: button1HasFocus && button2HasFocus,
    message:
      button1HasFocus && button2HasFocus
        ? 'Focus management is working correctly.'
        : 'Focus management test failed. Elements could not receive focus.',
  }
}

/**
 * Runs all browser compatibility tests
 * @returns Test results
 */
export async function runBrowserCompatibilityTests(): Promise<{
  browserInfo: BrowserInfo
  ariaLiveTest: { success: boolean; message: string }
  focusTest: { success: boolean; message: string }
}> {
  const browserInfo = detectBrowser()
  const ariaLiveTest = await testAriaLiveAnnouncements()
  const focusTest = testFocusManagement()

  return {
    browserInfo,
    ariaLiveTest,
    focusTest,
  }
}
