/**
 * Vite plugin to fix circular dependency issues with Astro middleware
 * This resolves the warning about sequence export causing circular dependencies
 */
export default function middlewarePatchPlugin() {
  return {
    name: 'vite-plugin-middleware-patch',
    enforce: 'pre',
    resolveId(id) {
      // Intercept imports to astro:middleware and astro-internal:middleware
      if (id === 'astro:middleware' || id === 'astro-internal:middleware') {
        return 'virtual:patched-middleware'
      }
      return null
    },
    load(id) {
      if (id === 'virtual:patched-middleware') {
        // Provide a direct export of sequence to avoid circular dependencies
        return `
          // Direct import from sequence module to avoid circular dependencies
          import { sequence as _sequence } from 'astro/dist/core/middleware/sequence.js';
          
          // Re-export the sequence function
          export const sequence = _sequence;
          
          // Export other middleware-related functions if needed
          export * from 'astro/dist/core/middleware/app.js';
          export * from 'astro/dist/core/middleware/createContext.js';
          export * from 'astro/dist/core/middleware/createMiddleware.js';
        `
      }
      return null
    },
  }
}
