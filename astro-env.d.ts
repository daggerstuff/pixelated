// This file ensures Astro and Vite environment types are available globally.
// It resolves "Cannot find type definition file for 'astro/client'" and 'vite/client' errors.

/// <reference types="astro/client" />
/// <reference types="vite/client" />

declare module 'global' {
  namespace NodeJS {
    interface Global {
      showDLPAlert: (
        type: 'success' | 'error' | 'warning',
        message: string,
      ) => void
    }
  }
}
