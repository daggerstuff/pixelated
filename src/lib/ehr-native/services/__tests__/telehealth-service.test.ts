/**
 * Tests for EHR Native Telehealth Service (F1.12)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEncounterRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  findByStatus: vi.fn(),
  findByDateRange: vi.fn(),
  findByPractitioner: vi.fn(),
  findByPatient: vi.fn(),
};

const mockAppointmentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/ehr-native/repositories/encounter-repository', () => ({
  EncounterRepository: class MockEncounterRepository {
    create = mockEncounterRepo.create;
    findById = mockEncounterRepo.findById;
    update = mockEncounterRepo.update;
    findByStatus = mockEncounterRepo.findByStatus;
    findByDateRange = mockEncounterRepo.findByDateRange;
    findByPractitioner = mockEncounterRepo.findByPractitioner;
    findByPatient = mockEncounterRepo.findByPatient;
  },
}));

vi.mock('@/lib/ehr-native/repositories/appointment-repository', () => ({
  AppointmentRepository: class MockAppointmentRepository {
    create = mockAppointmentRepo.create;
    findById = mockAppointmentRepo.findById;
    update = mockAppointmentRepo.update;
  },
}));

const mockLogTelehealthAccess = vi.fn().mockResolvedValue('audit-log-id');

vi.mock('@/lib/ehr-native/audit/ehr-audit-service', () => ({
  EHRAuditService: class MockEHRAuditService {
    static getInstance() {
      return { logTelehealthAccess: mockLogTelehealthAccess };
    }
  },
}));

const { TelehealthService } = await import('../telehealth-service');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
};

const validPatientId = 'ffffffff-1111-2222-3333-444444444444';
const validPractitionerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const validAppointmentId = '11111111-2222-3333-4444-555555555555';
const validEncounterId = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const validSessionId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TelehealthService', () => {
  let service: InstanceType<typeof TelehealthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TelehealthService(rlsContext);
  });

  describe('startSession', () => {
    it('creates a telehealth session with FHIR Encounter when none provided', async () => {
      mockEncounterRepo.create.mockResolvedValue({ id: validEncounterId });

      const result = await service.startSession(
        {
          patientId: validPatientId,
          practitionerId: validPractitionerId,
          preferredProvider: 'webrtc',
          appointmentId: validAppointmentId,
        },
        'user-456',
      );

      expect(result).not.toBeNull();
      expect(result!.patientId).toBe(validPatientId);
      expect(result!.practitionerId).toBe(validPractitionerId);
      expect(result!.encounterId).toBe(validEncounterId);
      expect(result!.appointmentId).toBe(validAppointmentId);
      expect(result!.status).toBe('connecting');

      // Encounter should be created with class.code='VR' and status='in-progress'
      expect(mockEncounterRepo.create).toHaveBeenCalledTimes(1);
      const encounterArg = mockEncounterRepo.create.mock.calls[0][0];
      expect(encounterArg.resourceType).toBe('Encounter');
      expect(encounterArg.status).toBe('in-progress');
      expect(encounterArg.class.code).toBe('VR');
      expect(encounterArg.subject.reference).toBe(`Patient/${validPatientId}`);
      expect(encounterArg.appointment).toEqual([
        { reference: `Appointment/${validAppointmentId}` },
      ]);

      // Audit should be called
      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'start_telehealth_session',
        expect.objectContaining({
          sessionId: result!.id,
          patientId: validPatientId,
          practitionerId: validPractitionerId,
          encounterId: validEncounterId,
        }),
      );
    });

    it('uses provided encounterId without creating a new one', async () => {
      mockEncounterRepo.create.mockResolvedValue({ id: validEncounterId });

      const result = await service.startSession(
        {
          patientId: validPatientId,
          practitionerId: validPractitionerId,
          preferredProvider: 'webrtc',
          encounterId: validEncounterId,
        },
        'user-456',
      );

      expect(result).not.toBeNull();
      expect(result!.encounterId).toBe(validEncounterId);
      // Should NOT call encounterRepo.create since encounterId was provided
      expect(mockEncounterRepo.create).not.toHaveBeenCalled();
    });

    it('selects zoom provider when WebRTC is not available (server environment)', async () => {
      // In node test environment, RTCPeerConnection is not available
      mockEncounterRepo.create.mockResolvedValue({ id: validEncounterId });

      const result = await service.startSession(
        {
          patientId: validPatientId,
          practitionerId: validPractitionerId,
          preferredProvider: 'zoom',
          zoomMeetingId: 'zoom-123',
          zoomJoinUrl: 'https://zoom.us/j/123',
        },
        'user-456',
      );

      expect(result).not.toBeNull();
      // In node env, isWebRTCAvailable returns false → zoom
      expect(result!.providerType).toBe('zoom');
      expect(result!.webRtcConfig).toBeUndefined();
      expect(result!.zoomMeetingId).toBe('zoom-123');
      expect(result!.zoomJoinUrl).toBe('https://zoom.us/j/123');
    });

    it('throws on invalid patientId', async () => {
      await expect(
        service.startSession(
          {
            patientId: 'not-a-uuid',
            practitionerId: validPractitionerId,
            preferredProvider: 'webrtc',
          },
          'user-456',
        ),
      ).rejects.toThrow('Invalid patientId format: expected UUID');
    });

    it('throws on invalid practitionerId', async () => {
      await expect(
        service.startSession(
          {
            patientId: validPatientId,
            practitionerId: 'bad',
            preferredProvider: 'webrtc',
          },
          'user-456',
        ),
      ).rejects.toThrow('Invalid practitionerId format: expected UUID');
    });

    it('returns null when FHIR Encounter creation fails', async () => {
      mockEncounterRepo.create.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.startSession(
        {
          patientId: validPatientId,
          practitionerId: validPractitionerId,
          preferredProvider: 'webrtc',
          appointmentId: validAppointmentId,
        },
        'user-456',
      );

      expect(result).toBeNull();

      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'start_telehealth_session',
        expect.objectContaining({
          status: 'failure',
          errorMessage: 'Encounter creation failed: DB connection lost',
        }),
      );
    });
  });

  describe('joinSession', () => {
    it('audits the join and returns null (no session store wired)', async () => {
      const result = await service.joinSession(
        {
          sessionId: validSessionId,
          participantId: validPatientId,
          role: 'patient',
        },
        'user-456',
      );

      expect(result).toBeNull();

      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'join_telehealth_session',
        expect.objectContaining({
          sessionId: validSessionId,
          patientId: validPatientId,
        }),
      );
    });

    it('throws on invalid sessionId', async () => {
      await expect(
        service.joinSession(
          {
            sessionId: 'bad',
            participantId: validPatientId,
            role: 'patient',
          },
          'user-456',
        ),
      ).rejects.toThrow('Invalid sessionId format: expected UUID');
    });
  });

  describe('endSession', () => {
    it('ends a session and audits the end', async () => {
      const endedAt = new Date().toISOString();
      const result = await service.endSession({
        sessionId: validSessionId,
        endedAt,
        userId: 'user-456',
      });

      expect(result).toBeNull();

      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'end_telehealth_session',
        expect.objectContaining({
          sessionId: validSessionId,
          status: 'failure',
          errorMessage: 'Session store not available',
        }),
      );
    });

    it('throws on invalid endedAt timestamp', async () => {
      await expect(
        service.endSession({
          sessionId: validSessionId,
          endedAt: 'not-a-timestamp',
          userId: 'user-456',
        }),
      ).rejects.toThrow('Invalid endedAt: expected ISO 8601 timestamp');
    });
  });

  describe('checkDevices', () => {
    it('returns unavailable result in server environment', async () => {
      const result = await service.checkDevices('user-456');

      expect(result.cameraAvailable).toBe(false);
      expect(result.microphoneAvailable).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.cameraError).toBeDefined();
      expect(result.microphoneError).toBeDefined();

      // Audit should be called with status 'failure'
      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'check_devices',
        expect.objectContaining({
          status: 'failure',
        }),
      );
    });
  });

  describe('startRecording', () => {
    it('starts recording when consent is given', async () => {
      const consentAt = new Date().toISOString();
      const result = await service.startRecording(
        {
          sessionId: validSessionId,
          consentGiven: true,
          consentAt,
          patientId: validPatientId,
          practitionerId: validPractitionerId,
        },
        'user-456',
      );

      expect(result).toBeNull();

      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'start_recording',
        expect.objectContaining({
          status: 'success',
          sessionId: validSessionId,
        }),
      );
    });

    it('returns null when consent is NOT given (consent gate)', async () => {
      const consentAt = new Date().toISOString();
      const result = await service.startRecording(
        {
          sessionId: validSessionId,
          consentGiven: false,
          consentAt,
          patientId: validPatientId,
          practitionerId: validPractitionerId,
        },
        'user-456',
      );

      expect(result).toBeNull();

      // Audit should record the failure
      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'start_recording',
        expect.objectContaining({
          status: 'failure',
          errorMessage: 'Recording consent not given',
        }),
      );
    });

    it('throws on invalid consentAt timestamp', async () => {
      await expect(
        service.startRecording(
          {
            sessionId: validSessionId,
            consentGiven: true,
            consentAt: 'bad',
            patientId: validPatientId,
            practitionerId: validPractitionerId,
          },
          'user-456',
        ),
      ).rejects.toThrow('Invalid consentAt: expected ISO 8601 timestamp');
    });
  });

  describe('stopRecording', () => {
    it('stops recording and audits the stop', async () => {
      const result = await service.stopRecording(validSessionId, 'user-456');

      expect(result).toBeNull();

      expect(mockLogTelehealthAccess).toHaveBeenCalledWith(
        'stop_recording',
        expect.objectContaining({
          status: 'success',
          sessionId: validSessionId,
        }),
      );
    });
  });

  describe('getSession', () => {
    it('returns null (session store not yet wired)', async () => {
      const result = await service.getSession(validSessionId);
      expect(result).toBeNull();
    });

    it('throws on invalid sessionId', async () => {
      await expect(service.getSession('bad')).rejects.toThrow(
        'Invalid sessionId format: expected UUID',
      );
    });
  });

  describe('getActiveSessionByAppointment', () => {
    it('returns null (session store not yet wired)', async () => {
      const result = await service.getActiveSessionByAppointment(validAppointmentId);
      expect(result).toBeNull();
    });

    it('throws on invalid appointmentId', async () => {
      await expect(
        service.getActiveSessionByAppointment('bad'),
      ).rejects.toThrow('Invalid appointmentId format: expected UUID');
    });
  });
});
