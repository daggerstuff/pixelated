import { CrisisSessionFlaggingService } from '../CrisisSessionFlaggingService'
import type { FlagSessionRequest } from '../CrisisSessionFlaggingService'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(),
          not: vi.fn(() => ({
            order: vi.fn(),
          })),
        })),
        single: vi.fn(),
      })),
      in: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  })),
}

// Mock audit logging
const mockCreateAuditLog = vi.fn()

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

vi.mock('../../supabase', () => ({
  supabase: mockSupabase,
}))

vi.mock('../../audit', () => ({
  createAuditLog: mockCreateAuditLog,
  AuditEventType: {},
  AuditEventStatus: {},
}))

vi.mock('../../logging', () => ({
  getLogger: () => mockLogger,
}))

interface MockCrisisSessionFlag {
  id: string
  user_id: string
  session_id: string
  crisis_id: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  detected_risks: string[]
  text_sample: string
  status: string
  flagged_at: string
  created_at: string
  updated_at: string
  routing_decision: Record<string, unknown>
  metadata: Record<string, unknown>
}

describe('CrisisSessionFlaggingService', () => {
  let service: CrisisSessionFlaggingService
  let mockFlagData: MockCrisisSessionFlag
  let mockRequest: FlagSessionRequest

  beforeEach(() => {
    service = new CrisisSessionFlaggingService()

    mockFlagData = {
      id: 'flag-123',
      user_id: 'user-123',
      session_id: 'session-123',
      crisis_id: 'crisis-123',
      reason: 'Crisis detected by AI',
      severity: 'high',
      confidence: 0.85,
      detected_risks: ['self_harm', 'suicidal_ideation'],
      text_sample: 'Sample text that triggered crisis detection',
      status: 'pending',
      flagged_at: '2023-06-27T10:00:00Z',
      created_at: '2023-06-27T10:00:00Z',
      updated_at: '2023-06-27T10:00:00Z',
      routing_decision: { method: 'llm', confidence: 0.85 },
      metadata: {},
    }

    mockRequest = {
      userId: 'user-123',
      sessionId: 'session-123',
      crisisId: 'crisis-123',
      timestamp: '2023-06-27T10:00:00Z',
      reason: 'Crisis detected by AI',
      severity: 'high',
      detectedRisks: ['self_harm', 'suicidal_ideation'],
      confidence: 0.85,
      textSample: 'Sample text that triggered crisis detection',
      routingDecision: { method: 'llm', confidence: 0.85 },
    }

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('flagSessionForReview', () => {
    it('should successfully flag a session for review', async () => {
      // Setup mocks
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: mockFlagData, error: null }),
        }),
      })
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      // Execute
      const result = await service.flagSessionForReview(mockRequest)

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('crisis_session_flags')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: mockRequest.userId,
        session_id: mockRequest.sessionId,
        crisis_id: mockRequest.crisisId,
        reason: mockRequest.reason,
        severity: mockRequest.severity,
        confidence: mockRequest.confidence,
        detected_risks: mockRequest.detectedRisks,
        text_sample: mockRequest.textSample,
        routing_decision: mockRequest.routingDecision,
        metadata: {},
        status: 'pending',
      })

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        mockRequest.userId,
        'crisis_session_flagged',
        mockRequest.sessionId,
        expect.objectContaining({
          crisisId: mockRequest.crisisId,
          severity: mockRequest.severity,
          reason: mockRequest.reason,
        }),
      )

      expect(result).toEqual({
        id: mockFlagData.id,
        userId: mockFlagData.user_id,
        sessionId: mockFlagData.session_id,
        crisisId: mockFlagData.crisis_id,
        reason: mockFlagData.reason,
        severity: mockFlagData.severity,
        confidence: mockFlagData.confidence,
        detectedRisks: mockFlagData.detected_risks,
        textSample: mockFlagData.text_sample,
        status: mockFlagData.status,
        flaggedAt: mockFlagData.flagged_at,
        routingDecision: mockFlagData.routing_decision,
        metadata: mockFlagData.metadata,
        createdAt: mockFlagData.created_at,
        updatedAt: mockFlagData.updated_at,
      })
    })

    it('should validate required fields', async () => {
      const invalidRequest = { ...mockRequest, userId: '' }

      await expect(
        service.flagSessionForReview(invalidRequest),
      ).rejects.toThrow(
        'Missing required fields: userId, sessionId, or crisisId',
      )
    })

    it('should validate confidence range', async () => {
      const invalidRequest = { ...mockRequest, confidence: 1.5 }

      await expect(
        service.flagSessionForReview(invalidRequest),
      ).rejects.toThrow('Confidence must be between 0 and 1')
    })

    it('should handle database errors', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      await expect(service.flagSessionForReview(mockRequest)).rejects.toThrow(
        'Failed to flag session: Database error',
      )
    })
  })

  describe('updateFlagStatus', () => {
    it('should successfully update flag status', async () => {
      const updatedFlag = {
        ...mockFlagData,
        status: 'reviewed',
        reviewed_at: '2023-06-27T11:00:00Z',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: updatedFlag, error: null }),
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await service.updateFlagStatus({
        flagId: 'flag-123',
        status: 'reviewed',
        reviewerNotes: 'Reviewed and assessed',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('crisis_session_flags')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'reviewed',
          reviewer_notes: 'Reviewed and assessed',
          reviewed_at: expect.any(String),
        }),
      )

      expect(result.status).toBe('reviewed')
    })

    it('should handle update errors', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Update failed' },
            }),
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      await expect(
        service.updateFlagStatus({
          flagId: 'flag-123',
          status: 'reviewed',
        }),
      ).rejects.toThrow('Failed to update flag status: Update failed')
    })
  })

  describe('getUserCrisisFlags', () => {
    it('should get user crisis flags', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi
            .fn()
            .mockResolvedValue({ data: [mockFlagData], error: null }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await service.getUserCrisisFlags('user-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('crisis_session_flags')
      expect(result).toHaveLength(1)
      expect(result[0]?.userId).toBe('user-123')
    })

    it('should filter out resolved flags by default', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            not: vi
              .fn()
              .mockResolvedValue({ data: [mockFlagData], error: null }),
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      await service.getUserCrisisFlags('user-123', false)

      expect(mockSelect().eq().order().not).toHaveBeenCalledWith(
        'status',
        'in',
        '(resolved,dismissed)',
      )
    })
  })

  describe('getUserSessionStatus', () => {
    it('should get user session status', async () => {
      const mockStatusData = {
        id: 'status-123',
        user_id: 'user-123',
        is_flagged_for_review: true,
        current_risk_level: 'high',
        total_crisis_flags: 5,
        active_crisis_flags: 2,
        resolved_crisis_flags: 3,
        created_at: '2023-06-27T10:00:00Z',
        updated_at: '2023-06-27T10:00:00Z',
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: mockStatusData, error: null }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await service.getUserSessionStatus('user-123')

      expect(result).toEqual({
        id: mockStatusData.id,
        userId: mockStatusData.user_id,
        isFlaggedForReview: mockStatusData.is_flagged_for_review,
        currentRiskLevel: mockStatusData.current_risk_level,
        totalCrisisFlags: mockStatusData.total_crisis_flags,
        activeCrisisFlags: mockStatusData.active_crisis_flags,
        resolvedCrisisFlags: mockStatusData.resolved_crisis_flags,
        metadata: {},
        createdAt: mockStatusData.created_at,
        updatedAt: mockStatusData.updated_at,
      })
    })

    it('should return null when no status found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await service.getUserSessionStatus('user-123')

      expect(result).toBeNull()
    })
  })

  describe('getPendingCrisisFlags', () => {
    it('should get pending crisis flags', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue({ data: [mockFlagData], error: null }),
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await service.getPendingCrisisFlags()

      expect(mockSupabase.from).toHaveBeenCalledWith('crisis_session_flags')
      expect(mockSelect().in).toHaveBeenCalledWith('status', [
        'pending',
        'under_review',
      ])
      expect(result).toHaveLength(1)
    })

    it('should respect limit parameter', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      await service.getPendingCrisisFlags(25)

      expect(mockSelect().in().order().limit).toHaveBeenCalledWith(25)
    })
  })
})
