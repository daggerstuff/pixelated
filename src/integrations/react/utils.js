/**
 * Utility functions for the React integration
 */

/**
 * Client-side version detection utility
 */
export async function hasReactV18() {
  try {
    // Check if we can access React 18 APIs using dynamic import
    const React = await import('react')
    return !!React.default.useId
  } catch {
    return false
  }
}

/**
 * Detect if we need compatibility patches
 */
export async function needsV17Patch() {
  try {
    // Try to access ReactDOM.createRoot - existence indicates React 18
    const ReactDOM = await import('react-dom')
    return !ReactDOM.default.createRoot
  } catch {
    return false
  }
}

/**
 * Safe way to import React in ESM environments
 */
export async function importReact() {
  try {
    // Use dynamic import for ESM compatibility
    const React = await import('react')
    return React.default || React
  } catch (e) {
    console.error('Failed to import React:', e)
    return null
  }
}

/**
 * Safe way to import ReactDOM in ESM environments
 */
export async function importReactDOM() {
  try {
    // Use dynamic import for ESM compatibility
    const ReactDOM = await import('react-dom')
    return ReactDOM.default || ReactDOM
  } catch (e) {
    console.error('Failed to import ReactDOM:', e)
    return null
  }
}
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = '44a74ecd-27a6-5286-b0ba-e74237a5e4e4'))
  } catch (e) {}
})()
//# debugId=44a74ecd-27a6-5286-b0ba-e74237a5e4e4
