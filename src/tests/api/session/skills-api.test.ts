import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST, GET } from "../skills";
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

describe("Session Skills API", () => {
  const mockPool = new Pool();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /api/session/skills", () => {
    it("should save skill scores with batched INSERT query", async () => {
      const skillScores = {
        "Active Listening": 85,
        "Empathy": 90,
        "Technical Skills": 75,
        "Interpersonal Communication": 80
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          therapistId: "therapist-123",
          skillScores
        })
      };

      const mockClient = await mockPool.connect();
      // Mock session update
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
      // Mock batched skill insert
      mockClient.query.mockResolvedValueOnce({ rowCount: 4 });

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.sessionId).toBe("test-session-123");

      // Verify session update query
      expect(mockClient.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining("UPDATE sessions"),
        [JSON.stringify(skillScores), "test-session-123"]
      );

      // Verify batched skill insert query
      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining("INSERT INTO skill_development"),
        expect.arrayContaining([
          "therapist-123", "Active Listening", "interpersonal", 85, 1,
          "therapist-123", "Empathy", "interpersonal", 90, 1,
          "therapist-123", "Technical Skills", "technical", 75, 1,
          "therapist-123", "Interpersonal Communication", "interpersonal", 80, 1
        ])
      );

      // Verify only 2 queries were executed (not N+1)
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it("should handle skill category classification correctly", async () => {
      const skillScores = {
        "Active Listening": 85,
        "Technical Analysis": 75,
        "Interpersonal Skills": 80,
        "Therapeutic Intervention": 90
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          therapistId: "therapist-123",
          skillScores
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // Session update
      mockClient.query.mockResolvedValueOnce({ rowCount: 4 }); // Batched insert

      await POST({ request: mockRequest } as any);

      // Verify the batched query parameters include correct categories
      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        expect.any(String),
        expect.arrayContaining([
          "therapist-123", "Active Listening", "interpersonal", 85, 1,
          "therapist-123", "Technical Analysis", "technical", 75, 1,
          "therapist-123", "Interpersonal Skills", "interpersonal", 80, 1,
          "therapist-123", "Therapeutic Intervention", "therapeutic", 90, 1
        ])
      );
    });

    it("should return 400 for missing required fields", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123"
          // Missing therapistId and skillScores
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe("Missing required fields: sessionId, therapistId, skillScores");
    });

    it("should return 404 for session not found", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "non-existent-session",
          therapistId: "therapist-123",
          skillScores: { "Test Skill": 50 }
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // Session not found

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe("Session not found");
    });

    it("should handle empty skill scores gracefully", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          therapistId: "therapist-123",
          skillScores: {}
        })
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // Session update

      const response = await POST({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.success).toBe(true);

      // Should only execute session update, no skill insert
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it("should handle database errors", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          sessionId: "test-session-123",
          therapistId: "therapist-123",
          skillScores: { "Test Skill": 50 }
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

  describe("GET /api/session/skills", () => {
    it("should retrieve skill scores from specific session", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/skills?sessionId=test-session-123"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          skill_scores: { "Active Listening": 85, "Empathy": 90 }
        }]
      });

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.sessionId).toBe("test-session-123");
      expect(responseBody.skillScores).toEqual({ "Active Listening": 85, "Empathy": 90 });
    });

    it("should retrieve therapist's skill development history", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/skills?therapistId=therapist-123"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            skill_name: "Active Listening",
            skill_category: "therapeutic",
            current_score: 85,
            practice_sessions: 5,
            last_practiced: "2025-01-01T10:00:00Z",
            created_at: "2025-01-01T09:00:00Z"
          },
          {
            skill_name: "Empathy",
            skill_category: "therapeutic",
            current_score: 90,
            practice_sessions: 3,
            last_practiced: "2025-01-02T10:00:00Z",
            created_at: "2025-01-02T09:00:00Z"
          }
        ]
      });

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.therapistId).toBe("therapist-123");
      expect(responseBody.skills).toHaveLength(2);
      expect(responseBody.skills[0].skill_name).toBe("Active Listening");
    });

    it("should return 400 for missing parameters", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/skills"
      };

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe("Missing sessionId or therapistId parameter");
    });

    it("should return 404 for session not found", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/skills?sessionId=non-existent-session"
      };

      const mockClient = await mockPool.connect();
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const response = await GET({ request: mockRequest } as any);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe("Session not found");
    });

    it("should handle database errors", async () => {
      const mockRequest = {
        url: "http://localhost:3000/api/session/skills?sessionId=test-session-123"
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
