import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "../turns";
import { getLedger } from "../../../../lib/agent-note-collab/server";
import { TurnSubmissionResult } from "../../../../lib/agent-note-collab";

vi.mock("../../../../lib/agent-note-collab/server", () => ({
  getLedger: vi.fn(),
}));

describe("API: /api/agent-note-collab/turns", () => {
  const mockLedger = {
    list: vi.fn(),
    submitTurn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getLedger as any).mockReturnValue(mockLedger);
  });

  describe("GET", () => {
    it("should return turns from the ledger", async () => {
      const mockTurns = [{ turnId: "1", artifactId: "art-1" }];
      mockLedger.list.mockResolvedValue(mockTurns);

      const url = new URL("http://localhost/api/agent-note-collab/turns?artifactId=art-1");
      const response = await GET({ url } as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockTurns);
      expect(mockLedger.list).toHaveBeenCalledWith(expect.objectContaining({
        artifactId: "art-1",
      }));
    });

    it("should handle errors", async () => {
      mockLedger.list.mockRejectedValue(new Error("Storage error"));
      
      const url = new URL("http://localhost/api/agent-note-collab/turns");
      const response = await GET({ url } as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.errors[0].code).toBe("INTERNAL_ERROR");
    });
  });

  describe("POST", () => {
    it("should submit a turn and return 201 on success", async () => {
      const mockResult: TurnSubmissionResult = {
        ok: true,
        turn: { turnId: "1" } as any,
        action: "accept",
      };
      mockLedger.submitTurn.mockResolvedValue(mockResult);

      const request = new Request("http://localhost/api/agent-note-collab/turns", {
        method: "POST",
        body: JSON.stringify({ artifactId: "art-1", decision: "test" }),
      });
      const response = await POST({ request } as any);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.turn.turnId).toBe("1");
    });

    it("should return 400 on validation failure", async () => {
      mockLedger.submitTurn.mockResolvedValue({
        ok: false,
        errors: [{ code: "RETRY", message: "Confidence low" }],
      });

      const request = new Request("http://localhost/api/agent-note-collab/turns", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const response = await POST({ request } as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
    });
  });
});
