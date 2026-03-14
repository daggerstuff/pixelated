import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as getById } from "../turns/[id]";
import { GET as replay } from "../artifacts/[id]/replay";
import { getLedger } from "../../../../lib/agent-note-collab/server";

vi.mock("../../../../lib/agent-note-collab/server", () => ({
  getLedger: vi.fn(),
}));

describe("API: Agent Note Collab ID Endpoints", () => {
  const mockLedger = {
    getById: vi.fn(),
    replayByArtifact: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getLedger as any).mockReturnValue(mockLedger);
  });

  describe("GET /api/agent-note-collab/turns/[id]", () => {
    it("should return a turn by ID", async () => {
      const mockTurn = { turnId: "turn-1", artifactId: "art-1" };
      mockLedger.getById.mockResolvedValue(mockTurn);

      const response = await getById({ params: { id: "turn-1" } } as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.turnId).toBe("turn-1");
    });

    it("should return 404 if turn not found", async () => {
      mockLedger.getById.mockResolvedValue(null);

      const response = await getById({ params: { id: "missing" } } as any);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/agent-note-collab/artifacts/[id]/replay", () => {
    it("should return replay turns for an artifact", async () => {
      const mockTurns = [{ turnId: "1" }, { turnId: "2" }];
      mockLedger.replayByArtifact.mockResolvedValue(mockTurns);

      const url = new URL("http://localhost/api/artifacts/art-1/replay?asOf=2024-01-01");
      const response = await replay({ params: { id: "art-1" }, url } as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(mockLedger.replayByArtifact).toHaveBeenCalledWith("art-1", "2024-01-01");
    });
  });
});
