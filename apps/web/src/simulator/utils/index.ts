/**
 * Exports all utility functions from the simulator module
 * This file simplifies importing utilities from this module
 */

// Export privacy utilities
export {
  createEphemeralSessionId,
  createPrivacyHash,
  sanitizeText,
  cleanupTemporaryData,
  verifyPrivacySettings,
  generateConsentForm,
} from './privacy'

// Export scenario utilities
export {
  getScenarios,
  getScenarioById,
  filterScenarios,
  getRecommendedScenario,
} from './scenarios'
