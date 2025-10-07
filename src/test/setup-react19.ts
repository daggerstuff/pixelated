/**
 * React 19 compatibility setup for testing environment
 * This provides minimal compatibility fixes without breaking actual component rendering
 */

// Export a simplified act function that works with both React 18 and 19
export const act = async (callback: () => void | Promise<void>) => {
  if (typeof callback === 'function') {
    const result = callback()
    if (result && typeof result.then === 'function') {
      return result
    }
  }
  return Promise.resolve()
}

// Ensure React Testing Library can work with React 19
// This is a minimal setup that doesn't interfere with actual rendering
if (typeof window !== 'undefined') {
  // Add any React 19 specific polyfills or compatibility fixes here if needed
  // For now, we'll keep this minimal to avoid breaking existing functionality
}
