/**
 * Data Privacy and Anonymization Utilities
 *
 * This module provides functions for anonymizing and de-identifying
 * sensitive data to ensure HIPAA compliance.
 */

import type { TherapeuticSession } from './types'

/**
 * Anonymize a therapeutic session to remove ePHI.
 *
 * @param session - The therapeutic session to anonymize.
 * @returns Anonymized therapeutic session.
 */
export function anonymizeSession(
  session: TherapeuticSession,
): TherapeuticSession {
  const anonymizedSession = JSON.parse(JSON.stringify(session)) as TherapeuticSession

  // Anonymize participant demographics
  anonymizedSession.participantDemographics = {
    age: 'ANONYMIZED',
    gender: 'ANONYMIZED',
    ethnicity: 'ANONYMIZED',
    primaryLanguage: 'ANONYMIZED',
    socioeconomicStatus: 'ANONYMIZED',
    education: 'ANONYMIZED',
    region: 'ANONYMIZED',
    culturalBackground: ['ANONYMIZED'],
    disabilityStatus: 'ANONYMIZED',
  }

  // Anonymize content
  // Anonymize content
  anonymizedSession.content = {
    transcript: 'ANONYMIZED',
    aiResponses: ['ANONYMIZED'],
    userInputs: ['ANONYMIZED'],
    metadata: {
      anonymized: true,
    },
  }

  // Anonymize metadata
  if (anonymizedSession.metadata) {
    if (anonymizedSession.metadata.location) {
      anonymizedSession.metadata.location = 'ANONYMIZED'
    }
    if (anonymizedSession.metadata.device) {
      anonymizedSession.metadata.device = 'ANONYMIZED'
    }
  }

  return anonymizedSession
}
