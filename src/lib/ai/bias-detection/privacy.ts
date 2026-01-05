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
  const anonymizedSession = JSON.parse(JSON.stringify(session) as unknown)

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
  anonymizedSession.content = {
    patientPresentation: 'ANONYMIZED',
    therapeuticInterventions: ['ANONYMIZED'],
    patientResponses: ['ANONYMIZED'],
    sessionNotes: 'ANONYMIZED',
    assessmentResults: 'ANONYMIZED',
  }

  // Anonymize metadata
  anonymizedSession.metadata.traineeId = 'ANONYMIZED'
  anonymizedSession.metadata.supervisorId = 'ANONYMIZED'

  return anonymizedSession
}
