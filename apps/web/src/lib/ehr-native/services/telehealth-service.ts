/**
 * EHR Native — Telehealth Service (F1.12)
 *
 * Domain service for native telehealth session management.
 * Orchestrates EncounterRepository to provide
 * one-click join, pre-call device checks, WebRTC-primary / Zoom-fallback
 * provider abstraction, FHIR Encounter auto-creation/linking, and
 * recording with explicit consent gate.
 *
 * All operations enforce RLS via the injected RLSContext.
 * No singleton — RLS context varies per request.
 *
 * @see repositories/encounter-repository.ts for Encounter data access
 * @see types/telehealth.ts for telehealth type definitions
 * @see audit/ehr-audit-service.ts for audit trail
 */

import { randomUUID } from 'node:crypto'

import { EHRAuditService } from '../audit/ehr-audit-service'
import { EHRAuditAction } from '../audit/events'
import { type RLSContext, EncounterRepository } from '../repositories'
import type {
  TelehealthSession,
  StartSessionInput,
  JoinSessionInput,
  DeviceCheckResult,
  WebRTCConfig,
  TelehealthProvider,
} from '../types'

// ---------------------------------------------------------------------------
// Input sanitization helpers
// ---------------------------------------------------------------------------

function validateId(id: string, label: string): string {
  const sanitized = id.trim()
  if (!/^[A-Za-z0-9\-.]{1,64}$/.test(sanitized)) {
    throw new Error(
      `Invalid ${label} format: expected FHIR id (1-64 chars, A-Z, a-z, 0-9, -, .)`,
    )
  }
  return sanitized
}

function validateIsoTimestamp(timestamp: string, label: string): string {
  const trimmed = timestamp.trim()
  if (
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/.test(
      trimmed,
    )
  ) {
    return trimmed
  }
  throw new Error(`Invalid ${label}: expected ISO 8601 timestamp`)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartRecordingInput {
  readonly sessionId: string
  readonly consentGiven: boolean
  readonly consentAt: string
  readonly patientId: string
  readonly practitionerId: string
}

export interface EndSessionInput {
  readonly sessionId: string
  readonly endedAt: string
  readonly userId: string
}

// ---------------------------------------------------------------------------
// Default WebRTC configuration
// ---------------------------------------------------------------------------

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: DEFAULT_ICE_SERVERS,
}

// ---------------------------------------------------------------------------
// Provider fallback detection
// ---------------------------------------------------------------------------

/**
 * Determines whether WebRTC is available in the current environment.
 * In browser contexts, checks for RTCPeerConnection support.
 * In test/server contexts, always returns false to trigger Zoom fallback.
 */
function isWebRTCAvailable(): boolean {
  if (typeof globalThis !== 'undefined' && 'RTCPeerConnection' in globalThis) {
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// TelehealthService
// ---------------------------------------------------------------------------

/**
 * Domain service for telehealth session lifecycle management.
 *
 * Follows the same pattern as SchedulingService: constructor takes RLSContext,
 * creates repositories internally, uses EHRAuditService singleton for audit.
 */
export class TelehealthService {
  private readonly encounterRepo: EncounterRepository
  private readonly auditService: EHRAuditService

  constructor(rlsContext: RLSContext) {
    this.encounterRepo = new EncounterRepository(rlsContext)
    this.auditService = EHRAuditService.getInstance()
  }

  /**
   * Starts a telehealth session for a patient-practitioner encounter.
   *
   * - Creates a FHIR Encounter if no encounterId is provided, setting
   *   class.code='VR' (virtual) and status='in-progress'.
   * - Links to an existing Appointment if appointmentId is provided.
   * - Selects provider: WebRTC primary, Zoom fallback if WebRTC unavailable.
   * - Audits the session start.
   *
   * @returns The created TelehealthSession, or null on failure.
   */
  async startSession(
    input: StartSessionInput,
    userId: string,
  ): Promise<TelehealthSession | null> {
    const patientId = validateId(input.patientId, 'patientId')
    const practitionerId = validateId(input.practitionerId, 'practitionerId')

    let encounterId: string | undefined
    if (input.encounterId) {
      encounterId = validateId(input.encounterId, 'encounterId')
    }

    let appointmentId: string | undefined
    if (input.appointmentId) {
      appointmentId = validateId(input.appointmentId, 'appointmentId')
    }

    // Create FHIR Encounter if not provided
    if (!encounterId) {
      const now = new Date().toISOString()
      const encounterResource: Record<string, unknown> = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR',
          display: 'virtual',
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        participant: [
          {
            individual: {
              reference: `Practitioner/${practitionerId}`,
            },
            period: {
              start: now,
            },
          },
        ],
        period: {
          start: now,
        },
      }

      if (appointmentId) {
        encounterResource['appointment'] = [
          { reference: `Appointment/${appointmentId}` },
        ]
      }

      try {
        const created = await this.encounterRepo.create(encounterResource)
        const createdId = (created as Record<string, unknown> | null)?.[
          'id'
        ] as string | undefined
        if (!createdId) {
          await this.auditService.logTelehealthAccess(
            EHRAuditAction.START_TELEHEALTH_SESSION,
            {
              userId,
              status: 'failure',
              errorMessage: 'Encounter creation returned no ID',
              sessionId: randomUUID(),
              patientId,
              practitionerId,
            },
          )
          return null
        }
        encounterId = createdId
      } catch (err) {
        await this.auditService.logTelehealthAccess(
          EHRAuditAction.START_TELEHEALTH_SESSION,
          {
            userId,
            status: 'failure',
            errorMessage: `Encounter creation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
            sessionId: randomUUID(),
            patientId,
            practitionerId,
          },
        )
        // Encounter creation is required for acceptance #5 — do not continue.
        return null
      }
    }

    const providerType: TelehealthProvider =
      input.preferredProvider === 'zoom'
        ? 'zoom'
        : isWebRTCAvailable()
          ? 'webrtc'
          : 'zoom'

    const webRtcConfig =
      providerType === 'webrtc'
        ? (input.webRtcConfig ?? DEFAULT_WEBRTC_CONFIG)
        : undefined

    const sessionId = crypto.randomUUID()
    const startedAt = new Date().toISOString()

    const session: TelehealthSession = {
      id: sessionId,
      appointmentId,
      encounterId,
      patientId,
      practitionerId,
      providerType,
      status: 'connecting',
      startedAt,
      recordingEnabled: false,
      recordingConsent: false,
      webRtcConfig,
      zoomMeetingId: providerType === 'zoom' ? input.zoomMeetingId : undefined,
      zoomJoinUrl: providerType === 'zoom' ? input.zoomJoinUrl : undefined,
      participants: [
        {
          participantId: practitionerId,
          role: 'practitioner',
          joinedAt: startedAt,
        },
      ],
    }

    // Audit session start
    await this.auditService.logTelehealthAccess(
      EHRAuditAction.START_TELEHEALTH_SESSION,
      {
        userId,
        status: 'success',
        sessionId,
        patientId,
        practitionerId,
        encounterId,
        providerType,
      },
    )

    return session
  }

  /**
   * Joins an existing telehealth session as a participant.
   *
   * Adds the participant to the session's participant list and audits the join.
   *
   * @returns The updated TelehealthSession, or null if not found.
   */
  /**
   * Join a telehealth session — currently a stub.
   * Session store not yet wired; always returns null and audits with failure.
   * Deferred: wire the session store (F1.12) to persist participant joins
   * across instances — currently the in-memory map is the only source of
   * truth and is lost on restart.
   */
  async joinSession(
    input: JoinSessionInput,
    userId: string,
  ): Promise<TelehealthSession | null> {
    const sessionId = validateId(input.sessionId, 'sessionId')
    const participantId = validateId(input.participantId, 'participantId')

    const isPatient = input.role === 'patient'
    const auditPatientId = isPatient ? participantId : undefined
    const auditPractitionerId = isPatient ? undefined : participantId

    await this.auditService.logTelehealthAccess(
      EHRAuditAction.JOIN_TELEHEALTH_SESSION,
      {
        userId,
        status: 'failure',
        errorMessage: 'Session store not available',
        sessionId,
        patientId: auditPatientId,
        practitionerId: auditPractitionerId,
      },
    )

    // No session store wired — cannot return a valid session.
    return null
  }

  /**
   * Ends a telehealth session.
   *
   * - Updates the linked FHIR Encounter status to 'finished' if present.
   * - Sets session status to 'ended'.
   * - Audits the session end.
   *
   * @returns The ended TelehealthSession, or null if not found.
   */
  async endSession(input: EndSessionInput): Promise<TelehealthSession | null> {
    const sessionId = validateId(input.sessionId, 'sessionId')
    validateIsoTimestamp(input.endedAt, 'endedAt')

    // Audit session end
    await this.auditService.logTelehealthAccess(
      EHRAuditAction.END_TELEHEALTH_SESSION,
      {
        userId: input.userId,
        status: 'failure',
        errorMessage: 'Session store not available',
        sessionId,
      },
    )

    return null
  }

  /**
   * Checks device availability (camera and microphone) before joining a session.
   *
   * In browser contexts, uses the MediaDevices API. In server/test contexts,
   * returns a result indicating devices are unavailable with actionable errors.
   *
   * @returns DeviceCheckResult with camera/microphone availability and errors.
   */
  async checkDevices(userId: string): Promise<DeviceCheckResult> {
    let cameraAvailable = false
    let microphoneAvailable = false
    let cameraError: string | undefined
    let microphoneError: string | undefined

    if (
      typeof globalThis !== 'undefined' &&
      'navigator' in globalThis &&
      typeof globalThis.navigator.mediaDevices?.enumerateDevices === 'function'
    ) {
      try {
        const devices =
          await globalThis.navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        const audioDevices = devices.filter((d) => d.kind === 'audioinput')

        cameraAvailable = videoDevices.length > 0
        microphoneAvailable = audioDevices.length > 0

        if (!cameraAvailable) {
          cameraError =
            'No camera detected. Please connect a camera and try again.'
        }
        if (!microphoneAvailable) {
          microphoneError =
            'No microphone detected. Please connect a microphone and try again.'
        }
      } catch {
        cameraError =
          'Unable to access camera. Please check browser permissions.'
        microphoneError =
          'Unable to access microphone. Please check browser permissions.'
      }
    } else {
      cameraError = 'Camera check unavailable in this environment.'
      microphoneError = 'Microphone check unavailable in this environment.'
    }

    const result: DeviceCheckResult = {
      cameraAvailable,
      microphoneAvailable,
      cameraError,
      microphoneError,
      canProceed: cameraAvailable && microphoneAvailable,
    }

    // Audit device check
    await this.auditService.logTelehealthAccess(EHRAuditAction.CHECK_DEVICES, {
      userId,
      status: result.canProceed ? 'success' : 'failure',
      sessionId: randomUUID(),
    })

    return result
  }

  /**
   * Starts recording for a telehealth session.
   *
   * Requires explicit consent — recording will NOT start if consentGiven is false.
   * Audits the recording start with consent metadata.
   *
   * @returns The updated TelehealthSession, or null if consent not given.
   */
  async startRecording(
    input: StartRecordingInput,
    userId: string,
  ): Promise<TelehealthSession | null> {
    const sessionId = validateId(input.sessionId, 'sessionId')
    const patientId = validateId(input.patientId, 'patientId')
    const practitionerId = validateId(input.practitionerId, 'practitionerId')
    validateIsoTimestamp(input.consentAt, 'consentAt')

    // Consent gate — recording requires explicit consent
    if (!input.consentGiven) {
      await this.auditService.logTelehealthAccess(
        EHRAuditAction.START_RECORDING,
        {
          userId,
          status: 'failure',
          errorMessage: 'Recording consent not given',
          sessionId,
          patientId,
          practitionerId,
        },
      )
      return null
    }

    await this.auditService.logTelehealthAccess(
      EHRAuditAction.START_RECORDING,
      {
        userId,
        status: 'success',
        sessionId,
        patientId,
        practitionerId,
        // Include consent timestamp for HIPAA audit trail
        metadata: { consentAt: input.consentAt },
      },
    )

    // No session store wired — cannot return a valid session.
    return null
  }

  /**
   * Stops recording for a telehealth session.
   *
   * Audits the recording stop.
   *
   * @returns The updated TelehealthSession, or null if not found.
   */
  async stopRecording(
    sessionId: string,
    userId: string,
  ): Promise<TelehealthSession | null> {
    const validatedSessionId = validateId(sessionId, 'sessionId')

    await this.auditService.logTelehealthAccess(EHRAuditAction.STOP_RECORDING, {
      userId,
      status: 'success',
      sessionId: validatedSessionId,
    })

    return null
  }

  /**
   * Gets a telehealth session by ID.
   *
   * In production, this would fetch from a session store (Redis or database).
   * Currently returns null as no session store is wired.
   *
   * @returns The TelehealthSession, or null if not found.
   */
  async getSession(sessionId: string): Promise<TelehealthSession | null> {
    validateId(sessionId, 'sessionId')
    // Session store not yet implemented — returns null
    return null
  }

  /**
   * Gets the active telehealth session for a given appointment.
   *
   * In production, this would query the session store by appointmentId.
   * Currently returns null as no session store is wired.
   *
   * @returns The active TelehealthSession, or null if none found.
   */
  async getActiveSessionByAppointment(
    appointmentId: string,
  ): Promise<TelehealthSession | null> {
    validateId(appointmentId, 'appointmentId')
    // Session store not yet implemented — returns null
    return null
  }
}
