/**
 * Tests for EHR Native Patient Service (F1.7)
 *
 * @vitest-environment node
 */

import type { PoolClient } from 'pg'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPatientRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByMRN: vi.fn(),
  search: vi.fn(),
  findActive: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
}

const mockEncounterRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByPatient: vi.fn(),
}

const mockAppointmentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByPatient: vi.fn(),
}

const mockObservationRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByPatient: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/ehr-native/repositories/patient-repository', () => ({
  PatientRepository: class MockPatientRepository {
    create = mockPatientRepo.create
    findById = mockPatientRepo.findById
    findByMRN = mockPatientRepo.findByMRN
    search = mockPatientRepo.search
    findActive = mockPatientRepo.findActive
    update = mockPatientRepo.update
    deactivate = mockPatientRepo.deactivate
  },
}))

vi.mock('@/lib/ehr-native/repositories/encounter-repository', () => ({
  EncounterRepository: class MockEncounterRepository {
    create = mockEncounterRepo.create
    findById = mockEncounterRepo.findById
    findByPatient = mockEncounterRepo.findByPatient
  },
}))

vi.mock('@/lib/ehr-native/repositories/appointment-repository', () => ({
  AppointmentRepository: class MockAppointmentRepository {
    create = mockAppointmentRepo.create
    findById = mockAppointmentRepo.findById
    findByPatient = mockAppointmentRepo.findByPatient
  },
}))

vi.mock('@/lib/ehr-native/repositories/observation-repository', () => ({
  ObservationRepository: class MockObservationRepository {
    create = mockObservationRepo.create
    findById = mockObservationRepo.findById
    findByPatient = mockObservationRepo.findByPatient
  },
}))

const { PatientService } = await import('../patient-service')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validPatientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const validPatient = {
  resourceType: 'Patient' as const,
  identifier: [{ system: 'http://hospital.example.org/mrn', value: 'MRN-001' }],
  active: true,
  name: [{ family: 'Doe', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-01-15',
}

const validEncounter = {
  resourceType: 'Encounter' as const,
  status: 'finished' as const,
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/patient-001' },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientService', () => {
  let service: InstanceType<typeof PatientService>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PatientService(rlsContext)
  })

  describe('createPatient', () => {
    it('creates a patient through the repository', async () => {
      mockPatientRepo.create.mockResolvedValue(validPatient)
      const result = await service.createPatient({ fhirResource: validPatient })
      expect(result).toEqual(validPatient)
      expect(mockPatientRepo.create).toHaveBeenCalledWith(validPatient)
    })
  })

  describe('getPatient', () => {
    it('returns the patient when found', async () => {
      mockPatientRepo.findById.mockResolvedValue(validPatient)
      const result = await service.getPatient(validPatientId)
      expect(result).toEqual(validPatient)
    })

    it('returns null when patient not found', async () => {
      mockPatientRepo.findById.mockResolvedValue(null)
      const result = await service.getPatient(validPatientId)
      expect(result).toBeNull()
    })

    it('throws on invalid patient ID format', async () => {
      await expect(service.getPatient('not-a-uuid')).rejects.toThrow()
    })
  })

  describe('getPatientByMRN', () => {
    it('returns the patient when found by MRN', async () => {
      mockPatientRepo.findByMRN.mockResolvedValue(validPatient)
      const result = await service.getPatientByMRN('MRN-001')
      expect(result).toEqual(validPatient)
    })

    it('returns null when MRN not found', async () => {
      mockPatientRepo.findByMRN.mockResolvedValue(null)
      const result = await service.getPatientByMRN('MRN-999')
      expect(result).toBeNull()
    })

    it('returns null for empty MRN', async () => {
      const result = await service.getPatientByMRN('')
      expect(result).toBeNull()
    })
  })

  describe('searchPatients', () => {
    it('delegates to repository search with pagination', async () => {
      mockPatientRepo.searchByName.mockResolvedValue([validPatient])
      const result = await service.searchPatients({ nameQuery: 'Doe', limit: 10, offset: 0 })
      expect(result).toEqual([validPatient])
      expect(mockPatientRepo.searchByName).toHaveBeenCalledWith('Doe', 10, 0)
    })
  })

  describe('createEncounter', () => {
    it('creates an encounter after validating patient exists', async () => {
      const patientId = validPatientId
      mockPatientRepo.findById.mockResolvedValue(validPatient)
      mockEncounterRepo.create.mockResolvedValue(validEncounter)
      const result = await service.createEncounter(patientId, validEncounter)
      expect(result).toEqual(validEncounter)
    })

    it('throws when patient does not exist', async () => {
      const patientId = validPatientId
      mockPatientRepo.findById.mockResolvedValue(null)
      await expect(service.createEncounter(patientId, validEncounter)).rejects.toThrow()
    })
  })

  describe('getPatientEncounters', () => {
    it('returns encounters for a valid patient', async () => {
      const patientId = validPatientId
      mockEncounterRepo.findByPatient.mockResolvedValue([validEncounter])
      const result = await service.getPatientEncounters(patientId, 10, 0)
      expect(result).toEqual([validEncounter])
    })

    it('throws on invalid patient ID', async () => {
      await expect(service.getPatientEncounters('bad', 10, 0)).rejects.toThrow()
    })
  })
})
