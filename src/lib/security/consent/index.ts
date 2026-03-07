/**
 * Consent Management System
 *
 * A comprehensive HIPAA-compliant consent management system that supports
 * granular consent options, consent version tracking, and complete withdrawal workflow.
 * The system includes integrated audit logging for all consent-related activities.
 *
 * Features:
 * - Granular consent options with required/optional flags
 * - Complete version tracking for consent documents
 * - Audit-compliant consent withdrawal workflow
 * - Admin dashboard for consent monitoring
 * - Patient-facing consent management interface
 */

// Export the ConsentService
export { ConsentService, consentService } from './ConsentService'

// Export all types
export * from './types'

// Export React components
export { ResearchConsentForm } from '../../../components/consent/ResearchConsentForm'

// Export default consentService instance for easier imports
import { consentService } from './ConsentService'
export default consentService
