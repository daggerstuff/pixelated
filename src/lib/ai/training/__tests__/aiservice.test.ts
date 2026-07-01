/* @vitest-environment node */
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createMockAIService,
  getAIService,
  resetAIServiceForTesting,
} from "../../index";
import { FineTuningAIService } from "../aiservice";

type StubJob = {
  id: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: Date;
  backend?: "openai" | "huggingface" | "local" | "dry-run";
  fineTunedModel?: string;
  remoteId?: string;
  updatedAt?: Date;
  ownerId?: string;
  error?: string;
};

function makeStubOrchestrator() {
  const jobs = new Map<string, StubJob>();
  const listAvailableModels = vi.fn(async () => [
    { id: "gpt-4o-mini", ownedBy: "openai", fineTunable: true },
    { id: "dry-run-stub-model", ownedBy: "dry-run", fineTunable: true },
  ]);
  const listJobsAsync = vi.fn(async () => Array.from(jobs.values()));
  const startFromPrepared = vi.fn(
    async (
      _paths: { openai: string | null; huggingface: string | null },
      config: {
        model: string;
        backend: "openai" | "huggingface" | "local" | "dry-run";
        nEpochs: number;
      },
    ): Promise<StubJob> => {
      const id = `stub-${jobs.size + 1}`;
      const job: StubJob = {
        id,
        model: config.model,
        status: "running",
        createdAt: new Date(),
        backend: config.backend,
        remoteId: `remote-${id}`,
        updatedAt: new Date(),
        ownerId: undefined,
      };
      jobs.set(id, job);
      return job;
    },
  );
  const getJobStatus = vi.fn(async (jobId: string): Promise<StubJob | null> => {
    return jobs.get(jobId) ?? null;
  });
  return { jobs, listAvailableModels, listJobsAsync, startFromPrepared, getJobStatus };
}

describe("FineTuningAIService", () => {
  afterEach(() => {
    resetAIServiceForTesting();
    delete process.env["OPENAI_DEFAULT_BACKEND"];
  });

  test("getStatus reports active models and available status", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({ orchestrator: stub });
    await service.initialize();

    const status = await service.getStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.activeModels).toContain("gpt-4o-mini");
    expect(status.lastHealthCheck).toBeInstanceOf(Date);
  });

  test("processText submits a new fine-tune job via the orchestrator", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stub,
      defaultBackend: "dry-run",
    });
    await service.initialize();

    const result = (await service.processText("/data/ds.jsonl", {
      model: "gpt-4o-mini",
      nEpochs: 2,
    })) as {
      processed: boolean;
      jobId: string;
      backend: string;
      result: string;
    };

    expect(result.processed).toBe(true);
    expect(result.jobId).toBe("stub-1");
    expect(result.backend).toBe("dry-run");

    expect(stub.startFromPrepared).toHaveBeenCalledTimes(1);
    const [paths, config] = stub.startFromPrepared.mock.calls[0] ?? [];
    expect(paths).toEqual({ openai: "/data/ds.jsonl", huggingface: null });
    expect(config).toMatchObject({
      model: "gpt-4o-mini",
      backend: "dry-run",
      nEpochs: 2,
    });
  });

  test("processText with jobId returns the existing job summary", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stub,
      defaultBackend: "dry-run",
    });
    await service.initialize();

    await service.processText("/data/ds.jsonl", { backend: "dry-run" });

    const result = (await service.processText("ignored", {
      jobId: "stub-1",
    })) as {
      processed: boolean;
      jobId: string;
      status: string;
      backend?: string;
    };

    expect(result.jobId).toBe("stub-1");
    expect(result.status).toBe("running");
    expect(result.backend).toBe("dry-run");
    expect(stub.startFromPrepared).toHaveBeenCalledTimes(1);
    expect(stub.getJobStatus).toHaveBeenCalledWith("stub-1");
  });

  test("processText returns processed=false when referencing an unknown job", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stub,
      defaultBackend: "dry-run",
    });
    await service.initialize();

    const result = (await service.processText("ignored", {
      jobId: "missing",
    })) as { processed: boolean; result: string };

    expect(result.processed).toBe(false);
    expect(result.result).toMatch(/No fine-tuning job/);
  });

  test("dispose clears the initialize promise so re-init re-runs the ready log", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stub,
      defaultBackend: "dry-run",
    });
    await service.initialize();
    await service.dispose();
    // After dispose the service can still process requests; initialize
    // internally rebuilds its promise chain and getStatus re-queries the
    // orchestrator without leaking the old promise.
    await service.initialize();
    await service.processText("/data/ds.jsonl", { backend: "dry-run" });
    expect(stub.startFromPrepared).toHaveBeenCalledTimes(1);
  });

  test("setOrchestratorForTesting swaps the underlying instance", async () => {
    const stubA = makeStubOrchestrator();
    const stubB = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stubA,
      defaultBackend: "dry-run",
    });
    await service.initialize();

    await service.processText("/data/a.jsonl", { backend: "dry-run" });
    expect(stubA.startFromPrepared).toHaveBeenCalledTimes(1);
    expect(stubB.startFromPrepared).toHaveBeenCalledTimes(0);

    service.setOrchestratorForTesting(stubB);
    await service.processText("/data/b.jsonl", { backend: "dry-run" });
    expect(stubB.startFromPrepared).toHaveBeenCalledTimes(1);
  });

  test("empty / non-numeric string falls back to nEpochs default rather than 0", async () => {
    const stub = makeStubOrchestrator();
    const service = new FineTuningAIService({
      orchestrator: stub,
      defaultBackend: "dry-run",
    });
    await service.initialize();

    await service.processText("/data/empty.jsonl", {
      backend: "dry-run",
      nEpochs: "",
    });
    const [, config] = stub.startFromPrepared.mock.calls[0] ?? [];
    // empty/garbage string must NOT silently become 0
    expect((config as { nEpochs: number }).nEpochs).toBe(3);

    await service.processText("/data/garbage.jsonl", {
      backend: "dry-run",
      nEpochs: "not-a-number",
    });
    const [, config2] = stub.startFromPrepared.mock.calls[1] ?? [];
    expect((config2 as { nEpochs: number }).nEpochs).toBe(3);
  });

  test("invalid OPENAI_DEFAULT_BACKEND env falls back to dry-run instead of leaking typos", async () => {
    const prev = process.env["OPENAI_DEFAULT_BACKEND"];
    try {
      process.env["OPENAI_DEFAULT_BACKEND"] = "openaii";
      const stub = makeStubOrchestrator();
      const service = new FineTuningAIService({
        orchestrator: stub,
      });
      // Trigger resolution with no explicit backend; the typo env value
      // must not survive into the orchestrator factory.
      const res = (await service.processText("/data/env.jsonl", {})) as {
        backend: string;
      };
      expect(res.backend).toBe("dry-run");
    } finally {
      if (prev === undefined) delete process.env["OPENAI_DEFAULT_BACKEND"];
      else process.env["OPENAI_DEFAULT_BACKEND"] = prev;
    }
  });
});

describe("getAIService wiring", () => {
  afterEach(() => {
    resetAIServiceForTesting();
    delete process.env["PIX_AI_USE_MOCK"];
  });

  test("returns MockAIService when NODE_ENV is test", async () => {
    process.env["NODE_ENV"] = "test";
    const svc = getAIService();
    // MockAIService requires initialize() before processText succeeds.
    await svc.initialize();
    const res = (await svc.processText("hello world")) as {
      processed: boolean;
      confidence: number;
      result: string;
    };
    expect(res.processed).toBe(true);
    expect(typeof res.confidence).toBe("number");
    expect(res.result).toMatch(/^Processed:/);
  });

  test("returns MockAIService when PIX_AI_USE_MOCK=1 even outside tests", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["PIX_AI_USE_MOCK"] = "1";
    const svc = getAIService();
    await svc.initialize();
    const res = (await svc.processText("ignored", {
      backend: "openai",
    })) as { processed: boolean; confidence?: number };
    expect(res.processed).toBe(true);
    expect(typeof res.confidence).toBe("number");
  });

  test("returns FineTuningAIService by default in non-test environments", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["PIX_AI_USE_MOCK"];
    const prevVitest = process.env["VITEST"];
    delete process.env["VITEST"];
    
    try {
      const svc = getAIService();
      expect(svc).toBeInstanceOf(FineTuningAIService);
    } finally {
      if (prevVitest !== undefined) process.env["VITEST"] = prevVitest;
    }
  });

  test("createMockAIService returns a fresh mock instance", async () => {
    const svc = createMockAIService();
    await svc.initialize();
    const res = (await svc.processText("hi")) as { confidence: number };
    expect(typeof res.confidence).toBe("number");
  });
});
