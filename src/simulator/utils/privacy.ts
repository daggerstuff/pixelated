/**
 * Utility functions for ensuring privacy in the simulator
 * These functions help maintain zero data retention and HIPAA compliance
 */

import { detectAndRedactPHI } from '../../lib/security/phiDetection'

/**
 * Creates an ephemeral session ID that isn't stored or tracked
 */
export const createEphemeralSessionId = (): string => {
  const randomComponent = Math.random().toString(36).substring(2, 15)
  const timestampComponent = Date.now().toString(36)
  return `sim_${timestampComponent}_${randomComponent}`
}

/**
 * One-way hash function for data that needs to be referenced but not stored
 * This is used for creating anonymous identifiers that cannot be tracked back to users
 */
export const createPrivacyHash = (input: string): string => {
  // In a real implementation, this would use a cryptographically secure hash function
  // For this example, we'll use a simple hash function
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}`
}

/**
 * Sanitizes text to remove any potentially identifiable information
 * This would be used for content that might be processed by AI models
 */
export const sanitizeText = (text: string): string => {
  return detectAndRedactPHI(text)
}

/**
 * Cleans up any temporary data from memory
 * Called when a session ends to ensure no data is retained
 */
export const cleanupTemporaryData = () => {
  // In a real implementation, this would explicitly free memory
  // For this example, it's a placeholder for garbage collection

  // Force garbage collection if possible (not directly possible in standard JavaScript)
  // This is just illustrative
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc()
    } catch (e) {
      console.error(
        'Unable to force garbage collection',
        e instanceof Error ? e.message : String(e),
      )
    }
  }
}

/**
 * Verifies that all privacy settings are enabled
 * Returns issues that need to be addressed
 */
export const verifyPrivacySettings = (): string[] => {
  const issues: string[] = []

  // Check for localStorage usage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Set a test item
      localStorage.setItem('privacy_test', 'test')
      // If it was set successfully, we have localStorage enabled
      if (localStorage.getItem('privacy_test') === 'test') {
        issues.push('Browser localStorage is enabled')
      }
      // Clean up
      localStorage.removeItem('privacy_test')
    } catch (e) {
      // Error is expected and intentional when localStorage is disabled
      console.debug(
        'localStorage is disabled:',
        e instanceof Error ? e.message : String(e),
      )
    }
  }

  // Check for indexedDB usage
  if (typeof window !== 'undefined' && window.indexedDB) {
    issues.push('Browser indexedDB is enabled')
  }

  // Add other privacy checks as needed

  return issues
}

/**
 * Generates a consent form for data processing
 * All data processing should be opt-in with clear explanation of what is processed
 * @param forHealthcare Whether to generate healthcare-specific consent form
 */
export const generateConsentForm = (
  forHealthcare: boolean = false,
): {
  consentText: string
  privacyPoints: string[]
} => {
  if (forHealthcare) {
    return {
      consentText:
        'I understand that anonymous metrics about my practice sessions may be stored locally in my browser. These metrics contain no personal information, session content, or identifiable data. They are used solely to show my progress over time.',
      privacyPoints: [
        'Anonymous skill metrics stored only in your browser (technique recognition, response timing)',
        "Aggregated statistics on therapeutic domains you've practiced",
        'Progress tracking across practice sessions (skill improvement over time)',
        'Frequency of different feedback types received',
      ],
    }
  }

  return {
    consentText:
      'I understand that this simulation does not record or store any audio, video, or conversation data. I consent to anonymous, aggregated metrics being collected to improve the system.',
    privacyPoints: [
      'No audio or video is recorded or stored at any time',
      'All processing happens in real-time with no data retention',
      'No personally identifiable information is collected',
      'Metrics are anonymous and cannot be linked back to you',
      'You can withdraw consent at any time by ending the session',
      'Aggregated metrics are only stored locally in your browser during the session',
    ],
  }
}

/**
 * Privacy utilities for the therapeutic simulator
 * Handles consent management and anonymized metrics
 */

/**
 * @deprecated Use generateConsentForm(true) instead
 */
export function generateHealthcareConsentForm() {
  return generateConsentForm(true)
}

/**
 * Retrieves the user's consent preference from local storage
 */
export function getUserConsentPreference(): boolean {
  const preference = localStorage.getItem('simulator_metrics_consent')
  return preference === 'true'
}

/**
 * Saves the user's consent preference to local storage
 */
export function setUserConsentPreference(consent: boolean): void {
  localStorage.setItem('simulator_metrics_consent', consent.toString())
}

/**
 * Anonymizes feedback by removing any potentially identifying information
 * This is an extra safety measure even though we don't store feedback long-term
 */
export function anonymizeFeedback(feedback: string): string {
  return detectAndRedactPHI(feedback)
}

/**
 * Checks if the current browser supports the required features
 * for private, client-side processing
 */
export function checkBrowserCompatibility(): {
  compatible: boolean
  missingFeatures: string[]
} {
  const missingFeatures: string[] = []

  // Check for WebRTC support (for real-time processing)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    missingFeatures.push('WebRTC/getUserMedia')
  }

  // Check for Web Audio API (for audio processing)
  if (
    !window.AudioContext &&
    !(window as { webkitAudioContext?: AudioContext })['webkitAudioContext']
  ) {
    missingFeatures.push('Web Audio API')
  }

  // Check for localStorage (for storing consent preferences)
  try {
    localStorage.setItem('test', 'test')
    localStorage.removeItem('test')
  } catch (e) {
    missingFeatures.push('localStorage')
    console.debug(
      'localStorage access error:',
      e instanceof Error ? e.message : String(e),
    )
  }

  return {
    compatible: missingFeatures.length === 0,
    missingFeatures,
  }
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
