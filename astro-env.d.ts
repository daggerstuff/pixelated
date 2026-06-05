// This file ensures Astro and Vite environment types are available globally.
// It resolves "Cannot find type definition file for 'astro/client'" and 'vite/client' errors.

/// <reference types="vitest/globals" />

// ImportMetaEnv and ImportMeta are declared in .astro-env.d.ts (tsconfig include)
// to avoid duplicate interface issues

// Vitest test globals
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
