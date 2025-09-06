/**
 * Dynamic imports for FHE (Fully Homomorphic Encryption) modules
 *
 * This file provides dynamic import functions for FHE modules to reduce initial bundle size
 * and address chunk size warnings.
 */

import React, { useState, useEffect } from 'react'

// Dynamic import for the main FHE module
export const loadFHEModule = async () => {
  return import('./index')
}

// Dynamic import for FHE encryption functionality
export const loadFHEEncryption = async () => {
  return import('./encryption')
}

// Dynamic import for FHE key management
export const loadFHEKeyManager = async () => {
  return import('./key-manager')
}

// Dynamic import for FHE operations
export const loadFHEOperations = async () => {
  return import('./operations')
}

// Utility function to load all FHE modules when needed
export const loadAllFHEModules = async () => {
  const [main, encryption, keyManager, operations] = await Promise.all([
    loadFHEModule(),
    loadFHEEncryption(),
    loadFHEKeyManager(),
    loadFHEOperations(),
  ])

  return {
    main,
    encryption,
    keyManager,
    operations,
  }
}

/**
 * React hook for using FHE functionality with dynamic loading
 *
 * Usage:
 * ```tsx
 * const MyComponent = () => {
 *   const { fhe, loading, error } = useFHE();
 *
 *   if (loading) return <div>Loading FHE module...</div>;
 *   if (error) return <div>Error loading FHE: {String(error)}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={() => fhe.encrypt("secret data")}>Encrypt</button>
 *     </div>
 *   );
 * };
 * ```
 */
export const useFHE = () => {
  const [fhe, setFHE] = useState<null | typeof import('./index')>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadFHE = async () => {
      try {
        const module = await loadFHEModule()
        if (isMounted) {
          setFHE(module)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load FHE module'),
          )
          setLoading(false)
        }
      }
    }

    loadFHE()

    return () => {
      isMounted = false
    }
  }, [])

  return { fhe, loading, error }
}
