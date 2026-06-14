import { describe, it, expect, beforeEach, vi } from "vitest";

import { FineTuningAIService } from "../FineTuningAIService";
import type {
  TrainingOrchestratorLike,
  ModelInfo,
  TrainingJobSummary,
} from "../FineTuningAIService";
import type { CacheClient } from "../../../services/cacheService";
import { GestaltClient } from "../../../services/ai/GestaltClient";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fakeOrchestrator(overrides?: Partial<TrainingOrchestratorLike>): TrainingOrchestratorLike {
  return {
    listJobs: vi
      .fn<() => TrainingJobSummary[] | Promise<TrainingJobSummary[]>>()
      .mockResolvedValue([]),
    listAvailableModels: vi
      .fn<() => Promise<ModelInfo[]>>()
      .mockResolvedValue([{ id: "test-model-v1", name: "Test Model", provider: "test" }]),
    ...overrides,
  };
}

/** In-memory fake that behaves like CacheClient for unit tests. */
function fakeCache() {
  const store = new Map<string, { value: unknown; expiry: number }>();
  const del = (k: string) => {
    store.delete(k);
  };
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry || entry.expiry < Date.now()) {
        del(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      store.set(key, {
        value: JSON.parse(value),
        expiry: Date.now() + (ttl ?? 60) * 1000,
      });
    }),
    delete: vi.fn(async (key: string) => {
      del(key);
    }),
    clearByPrefix: vi.fn(),
    mget: vi.fn(),
    keys: vi.fn(),
    _store: store,
  };
}

// ─── S1: Production happy path ──────────────────────────────────────────────

describe("FineTuningAIService (S1: production happy path)", () => {
  let orch: ReturnType<typeof fakeOrchestrator>;
  let cache: CacheClient;
  let service: FineTuningAIService;

  beforeEach(() => {
    orch = fakeOrchestrator();
    cache = fakeCache() as unknown as CacheClient;
    service = new FineTuningAIService(orch, cache);
  });

  it("initialize() probes orchestrator and sets initialized", async () => {
    await service.initialize();
    expect(orch.listAvailableModels).toHaveBeenCalledOnce();
  });

  it("initialize() tolerates orchestrator failure (degraded mode)", async () => {
    const brokenOrch = fakeOrchestrator({
      listAvailableModels: vi.fn().mockRejectedValue(new Error("connection refused")),
    });
    const svc = new FineTuningAIService(brokenOrch, cache);
    await expect(svc.initialize()).resolves.toBeUndefined();
  });

  it("getStatus() returns AIServiceStatus shape after init", async () => {
    await service.initialize();
    const status = await service.getStatus();
    expect(status).toMatchObject({
      isAvailable: true,
      performanceMetrics: {
        averageResponseTime: expect.any(Number),
        successRate: expect.any(Number),
        errorRate: expect.any(Number),
      },
      lastHealthCheck: expect.any(Date),
    });
    expect(Array.isArray(status.activeModels)).toBe(true);
  });

  it("getStatus() returns degraded status when orchestrator fails", async () => {
    const brokenOrch = fakeOrchestrator({
      listAvailableModels: vi.fn().mockRejectedValue(new Error("down")),
    });
    const svc = new FineTuningAIService(brokenOrch, cache);
    await svc.initialize();
    const status = await svc.getStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.activeModels).toEqual([]);
    expect(status.performanceMetrics.successRate).toBe(0);
  });

  it("processText() throws before initialize()", async () => {
    await expect(service.processText("hello")).rejects.toThrow(/not initialised/);
  });

  it("dispose() clears initialized flag", async () => {
    await service.initialize();
    expect((service as unknown as { initialized: boolean }).initialized).toBe(true);
    await service.dispose();
    expect((service as unknown as { initialized: boolean }).initialized).toBe(false);
  });
});

// ─── S3: Status caching ─────────────────────────────────────────────────────

describe("FineTuningAIService (S3: getStatus caching)", () => {
  let orch: ReturnType<typeof fakeOrchestrator>;
  let cache: CacheClient & { _store: Map<string, { value: unknown; expiry: number }> };
  let service: FineTuningAIService;

  beforeEach(async () => {
    orch = fakeOrchestrator();
    cache = fakeCache() as unknown as CacheClient & {
      _store: Map<string, { value: unknown; expiry: number }>;
    };
    service = new FineTuningAIService(orch, cache);
    await service.initialize();
  });

  it("first getStatus() calls orchestrator and caches result", async () => {
    // initialize() already called listAvailableModels once in beforeEach
    const status1 = await service.getStatus();
    // getStatus → buildStatus calls listAvailableModels: now 2 total
    expect(orch.listAvailableModels).toHaveBeenCalledTimes(2);
    const status2 = await service.getStatus();
    // Second call uses cache — orchestrator not called again: still 2
    expect(orch.listAvailableModels).toHaveBeenCalledTimes(2);
    // Cache serializes Date → string (JSON.parse after JSON.stringify)
    expect(status2).toEqual({ ...status1, lastHealthCheck: expect.any(String) });
  });

  it("getStatus() returns fresh data after cache expiry", async () => {
    // initialize() called listAvailableModels once in beforeEach
    await service.getStatus();
    // getStatus → buildStatus: now 2 total
    expect(orch.listAvailableModels).toHaveBeenCalledTimes(2);
    // Clear cache to simulate TTL expiry
    cache._store.clear();
    await service.getStatus();
    // Cache miss → buildStatus called again: now 3 total
    expect(orch.listAvailableModels).toHaveBeenCalledTimes(3);
  });
});

// ─── S4: GestaltClient with AIService ───────────────────────────────────────

describe("GestaltClient (S4: AIService injection)", () => {
  it("routes analyzeGestalt through AIService when provided", async () => {
    const aiService = {
      initialize: vi.fn(),
      getStatus: vi.fn(),
      processText: vi.fn().mockResolvedValue({ defense_label: 1 }),
      dispose: vi.fn(),
    };
    const client = new GestaltClient(aiService);
    const result = await client.analyzeGestalt({
      dialogue: [{ speaker: "user", text: "hello" }],
      target_utterance: "hello",
      plutchik_scores: { joy: 0.5 },
      ocean_scores: { openness: 0.5 },
    });
    expect(aiService.processText).toHaveBeenCalled();
    expect(result).toEqual({ defense_label: 1 });
  });

  it("falls back to direct fetch when no AIService provided", async () => {
    const client = new GestaltClient();
    // Without AIService it fetches directly — expect a network error since no
    // Gestalt server is running in test.
    await expect(
      client.analyzeGestalt({
        dialogue: [{ speaker: "user", text: "hi" }],
        target_utterance: "hi",
        plutchik_scores: { joy: 0.3 },
        ocean_scores: { openness: 0.4 },
      }),
    ).rejects.toThrow();
  });
});
