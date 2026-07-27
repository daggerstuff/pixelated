/**
 * Encrypted Memory Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptedMemory } from "../encrypted-memory";

describe("EncryptedMemoryService", () => {
  const originalEnv = process.env["NODE_ENV"];

  beforeEach(async () => {
    process.env["NODE_ENV"] = "test";
    (encryptedMemory as any).instance = null;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await encryptedMemory.initialize();
  });

  afterEach(async () => {
    process.env["NODE_ENV"] = originalEnv;
    vi.restoreAllMocks();
  });

  describe("session management", () => {
    it("should create encrypted session state", async () => {
      const session = await encryptedMemory.createSession("test-session-123", "therapist-456", []);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe("test-session-123");
      expect(session.therapistId).toBe("therapist-456");
      expect(session.encryptedData).toBeDefined();
    });

    it("should update session with new messages", async () => {
      await encryptedMemory.createSession("test-session-456", "therapist-789", []);

      const updated = await encryptedMemory.updateSession("test-session-456", []);

      expect(updated).toBeDefined();
      expect(updated?.metadata.messageCount).toBe(0);
    });

    it("should return null for non-existent session", () => {
      const session = encryptedMemory.getSession("non-existent");
      expect(session).toBeNull();
    });
  });

  describe("memory entries", () => {
    it("should create encrypted memory entry", async () => {
      const entry = await encryptedMemory.createMemoryEntry(
        "patient-123",
        "Session summary",
        "session_summary",
        { sentiment: "positive" },
      );

      expect(entry).toBeDefined();
      expect(entry.patientId).toBe("patient-123");
      expect(entry.entryType).toBe("session_summary");
      expect(entry.encryptedContent).toBeDefined();
    });

    it("should retrieve patient memories", async () => {
      await encryptedMemory.createMemoryEntry("patient-456", "Memory 1", "emotional_pattern");
      await encryptedMemory.createMemoryEntry("patient-456", "Memory 2", "therapist_note");
      await encryptedMemory.createMemoryEntry(
        "patient-789",
        "Different patient",
        "session_summary",
      );

      const memories = encryptedMemory.getPatientMemories("patient-456");

      expect(memories).toHaveLength(2);
      expect(memories.every((m) => m.patientId === "patient-456")).toBe(true);
    });
  });

  describe("emotional state tracking", () => {
    it("should store encrypted emotional state", async () => {
      const state = await encryptedMemory.storeEmotionalState(
        "test-session-789",
        [0.8, 0.2, 0.1],
        "emotion",
      );

      expect(state).toBeDefined();
      expect(state.vectorType).toBe("emotion");
      expect(state.metadata.dimensions).toBe(3);
    });

    it("should retrieve emotional trajectory", async () => {
      await encryptedMemory.storeEmotionalState("test-session-101", [0.5, 0.5], "emotion");
      await encryptedMemory.storeEmotionalState("test-session-101", [0.7, 0.3], "emotion");

      const trajectory = encryptedMemory.getEmotionalTrajectory("test-session-101");

      expect(trajectory).toHaveLength(2);
    });

    it("should analyze emotional trajectory", async () => {
      await encryptedMemory.storeEmotionalState("test-session-102", [0.5, 0.5], "emotion");

      const analysis = await encryptedMemory.analyzeEmotionalTrajectory("test-session-102");

      expect(analysis).toBeDefined();
      expect(analysis.encryptedAnalysis).toBeDefined();
    });
  });

  describe("data operations", () => {
    it("should export encrypted data", async () => {
      await encryptedMemory.createSession("export-test", "therapist", []);

      const exported = await encryptedMemory.exportEncryptedData();

      expect(exported).toBeDefined();
      expect(exported["sessions"]).toBeDefined();
    });

    it("should import encrypted data", async () => {
      const data = {
        sessions: [
          {
            sessionId: "imported-1",
            therapistId: "therapist-test",
            encryptedData: "encrypted-content",
            metadata: { messageCount: 1 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        memories: [],
      };

      await encryptedMemory.importEncryptedData(data as any);

      const session = encryptedMemory.getSession("imported-1");
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("imported-1");
    });
  });
});
