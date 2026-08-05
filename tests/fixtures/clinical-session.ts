export const CLINICAL_SESSION_TEST_USER_EMAIL = 'test@example.com'
export const CLINICAL_SESSION_TEST_USER_PASSWORD = 'password123'

export const CLINICAL_SESSION_PATIENT_NAME = 'Mock Patient'
export const CLINICAL_SESSION_TITLE = 'Initial Assessment'

export const THERAPIST_SESSION_WRITE_MESSAGE =
  'I notice you mentioned anxiety about work. Can you tell me more about what triggers that feeling?'

export function generateClinicalSessionId(
  prefix = 'e2e-clinical-session',
): string {
  return `${prefix}-${Date.now()}`
}
