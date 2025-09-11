import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST, GET } from "../progress";
import { Pool } from 'pg';

// Mock pg.Pool
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockClient = {
    query: mockQuery,
    release: vi.fn(),
  };
  const mockPool = {
    connect: vi.fn(() => Promise.resolve(mockClient)),
 };
  return { Pool: vi.fn(() => mockPool) };
});

describe("Session Progress API", () => {
  const mockPool = new Pool();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /api/session/progress", () => {
    it("should save session progress metrics", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          progressMetrics: { totalMessages: 10, progress: 50 },
          therapistId: "therapist-123",
          evaluationFeedback: "Good session"
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // Update session
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // Insert feedback

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.sessionId).toBe("test-session-123");
    });

    it("should return 400 for missing sessionId", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          progressMetrics: { totalMessages: 10, progress: 50 }
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe("Missing required field: sessionId");
    });

    it("should return 404 for session not found", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "non-existent-session",
          progressMetrics: { totalMessages: 10, progress: 50 }
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // Session not found

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe("Session not found");
    });

    it("should handle database errors", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          progressMetrics: { totalMessages: 10, progress: 50 }
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(500);
      expect(responseBody.error).toBe("Internal server error");
    });
  });

  describe("GET /api/session/progress", () => {
    it("should retrieve session progress data", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/progress?sessionId=test-session-123"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          progress_metrics: { totalMessages: 10, progress: 50 },
          progress_snapshots: [{ timestamp: "2025-01-01T10:00:00Z", value: 25 }],
          skill_scores: { "Active Listening": 85 }
        }]
      });
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          therapist_id: "therapist-123",
          feedback: "Good session",
          created_at: "2025-01-01T10:00:00Z"
        }]
      });

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.sessionId).toBe("test-session-123");
      expect(responseBody.progressMetrics).toBeDefined();
      expect(responseBody.feedback).toHaveLength(1);
    });

    it("should return 400 for missing sessionId", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/progress"
      };

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe("Missing sessionId parameter");
    });

    it("should return 404 for session not found", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/progress?sessionId=non-existent-session"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // Session not found

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe("Session not found");
    });

    it("should handle database errors", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/progress?sessionId=test-session-123"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(500);
      expect(responseBody.error).toBe("Internal server error");
    });
  });
});
