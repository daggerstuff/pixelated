/**
 * FHIR R4 Telehealth Types (F1.12)
 *
 * Zod schemas and inferred TypeScript types for native telehealth
 * sessions, WebRTC configuration, recording consent, and provider
 * abstraction (WebRTC primary, Zoom fallback).
 *
 * @see docs/plans/ehr-module-build-plan.md
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 */

import { z } from 'zod'

import {
  fhirIdSchema,
  fhirUuidSchema,
  fhirInstantSchema,
  fhirBooleanSchema,
} from './base.js'

// ---------------------------------------------------------------------------
// Telehealth Provider Type
// ---------------------------------------------------------------------------

export const telehealthProviderSchema = z.enum(['webrtc', 'zoom'])

export type TelehealthProvider = z.infer<typeof telehealthProviderSchema>

// ---------------------------------------------------------------------------
// Session Status
// ---------------------------------------------------------------------------

export const telehealthSessionStatusSchema = z.enum([
  'pending',
  'connecting',
  'active',
  'ended',
  'failed',
])

export type TelehealthSessionStatus = z.infer<typeof telehealthSessionStatusSchema>

// ---------------------------------------------------------------------------
// WebRTC Configuration
// ---------------------------------------------------------------------------

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
})

export type IceServer = z.infer<typeof iceServerSchema>

export const webRtcConfigSchema = z.object({
  iceServers: z.array(iceServerSchema),
  stunUrl: z.string().optional(),
  turnUrl: z.string().optional(),
  turnUsername: z.string().optional(),
  turnCredential: z.string().optional(),
})

export type WebRTCConfig = z.infer<typeof webRtcConfigSchema>

// ---------------------------------------------------------------------------
// Recording Consent
// ---------------------------------------------------------------------------

export const recordingConsentSchema = z.object({
  sessionId: fhirUuidSchema,
  consentGiven: fhirBooleanSchema,
  consentAt: fhirInstantSchema,
  patientId: fhirIdSchema,
  practitionerId: fhirIdSchema,
})

export type RecordingConsent = z.infer<typeof recordingConsentSchema>

// ---------------------------------------------------------------------------
// Session Participant
// ---------------------------------------------------------------------------

export const sessionParticipantSchema = z.object({
  participantId: fhirIdSchema,
  role: z.enum(['practitioner', 'patient']),
  joinedAt: fhirInstantSchema,
  leftAt: fhirInstantSchema.optional(),
})

export type SessionParticipant = z.infer<typeof sessionParticipantSchema>

// ---------------------------------------------------------------------------
// Telehealth Session
// ---------------------------------------------------------------------------

export const telehealthSessionSchema = z.object({
  id: fhirUuidSchema,
  appointmentId: fhirIdSchema.optional(),
  encounterId: fhirIdSchema.optional(),
  patientId: fhirIdSchema,
  practitionerId: fhirIdSchema,
  providerType: telehealthProviderSchema,
  status: telehealthSessionStatusSchema,
  startedAt: fhirInstantSchema.optional(),
  endedAt: fhirInstantSchema.optional(),
  recordingEnabled: fhirBooleanSchema.default(false),
  recordingConsent: fhirBooleanSchema.default(false),
  recordingConsentAt: fhirInstantSchema.optional(),
  webRtcConfig: webRtcConfigSchema.optional(),
  zoomMeetingId: z.string().optional(),
  zoomJoinUrl: z.url().optional(),
  participants: z.array(sessionParticipantSchema).default([]),
  failureReason: z.string().optional(),
})

export type TelehealthSession = z.infer<typeof telehealthSessionSchema>

// ---------------------------------------------------------------------------
// Device Check Result
// ---------------------------------------------------------------------------

export const deviceCheckResultSchema = z.object({
  cameraAvailable: fhirBooleanSchema,
  microphoneAvailable: fhirBooleanSchema,
  cameraError: z.string().optional(),
  microphoneError: z.string().optional(),
  canProceed: fhirBooleanSchema,
})

export type DeviceCheckResult = z.infer<typeof deviceCheckResultSchema>

// ---------------------------------------------------------------------------
// Start Session Input
// ---------------------------------------------------------------------------

export const startSessionInputSchema = z.object({
  appointmentId: fhirIdSchema.optional(),
  encounterId: fhirIdSchema.optional(),
  patientId: fhirIdSchema,
  practitionerId: fhirIdSchema,
  preferredProvider: telehealthProviderSchema.default('webrtc'),
  webRtcConfig: webRtcConfigSchema.optional(),
  zoomMeetingId: z.string().optional(),
  zoomJoinUrl: z.url().optional(),
})

export type StartSessionInput = z.infer<typeof startSessionInputSchema>

// ---------------------------------------------------------------------------
// Join Session Input
// ---------------------------------------------------------------------------

export const joinSessionInputSchema = z.object({
  sessionId: fhirUuidSchema,
  participantId: fhirIdSchema,
  role: z.enum(['practitioner', 'patient']),
})

export type JoinSessionInput = z.infer<typeof joinSessionInputSchema>
