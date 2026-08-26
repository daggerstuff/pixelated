/**
 * Export Service for Therapy Chat System
 *
 * Provides secure conversation export capabilities with maintained encryption
 * for privacy and HIPAA compliance.
 *
 * This file conditionally exports the appropriate implementation.
 */

// In Astro/Vite environments, we can use import.meta.env to detect browser
// https://vitejs.dev/guide/env-and-mode.html#env-variables
const isBrowser = typeof window !== 'undefined'

// We need to use static imports for both files
import * as browserImpl from './index.browser'
import * as nodeImpl from './index.node'

// Export all the types and functions from the appropriate implementation
export const { ExportFormat, ExportService } = isBrowser
  ? browserImpl
  : nodeImpl

// Also export the types
export type { ExportOptions, ExportResult } from './index.browser'

// Default export
export default isBrowser ? browserImpl : nodeImpl
