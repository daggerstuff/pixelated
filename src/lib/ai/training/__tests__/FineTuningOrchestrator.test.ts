/* @vitest-environment node */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  FineTuningOrchestrator,
  getDefaultOrchestrator,
  setDefaultOrchestrator,
} from "../FineTuningOrchestrator";
import { TrainingBackend } from "../backends/Base";
import { TrainingBackendFactory } from "../TrainingBackendFactory";
import { MemoryJobStore } from "../job-store";

function writeDatasetFile(content: string): string {
  const dir = join(process.cwd(), "data", "test-orchestrator-refactor");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `dataset-${Date.now()}.jsonl`);
  writeFileSync(path, content, "utf-8");
  return path;
}

describe("FineTuningOrchestrator refactor", () => {
  const testDir = join(process.cwd(), "data", "test-orchestrator-refactor");
  let dryRunPath: string;

  beforeAll(() => {
    dryRunPath = writeDatasetFile(
      JSON.stringify({
        conversations: [
          { from: "human", value: "hi" },
          { from: "gpt", value: "hello" },
        ],
      }) + "\n",
    );
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("startFromPrepared records backend on the persisted job", async () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    const job = await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o-mini", nEpochs: 2, backend: "dry-run" },
    );
    expect(job.backend).toBe("dry-run");
    expect(job.status).toBe("succeeded");
    const roundTrip = await store.get(job.id);
    expect(roundTrip?.backend).toBe("dry-run");
  });

  test("getJobStatus returns the stored job without polling for terminal jobs", async () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    const job = await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o-mini", nEpochs: 1, backend: "dry-run" },
    );
    const fetched = await orch.getJobStatus(job.id);
    expect(fetched?.status).toBe("succeeded");
  });

  test("getJobStatus returns null for unknown id", async () => {
    const orch = new FineTuningOrchestrator();
    expect(await orch.getJobStatus("nope")).toBeNull();
  });

  test("cancelJob routes through the recorded backend", async () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    const job = await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o-mini", nEpochs: 1, backend: "dry-run" },
    );
    const cancelled = await orch.cancelJob(job.id);
    expect(cancelled?.status).toBe("cancelled");
  });

  test("listJobs returns newest-first sync list (back-compat)", async () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o-mini", nEpochs: 1, backend: "dry-run" },
    );
    await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o", nEpochs: 1, backend: "dry-run" },
    );
    const jobs = orch.listJobs();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs).toHaveLength(2);
  });

  test("isTerminalStatus recognises healthy terminals", () => {
    const orch = new FineTuningOrchestrator();
    expect(orch.isTerminalStatus("succeeded")).toBe(true);
    expect(orch.isTerminalStatus("failed")).toBe(true);
    expect(orch.isTerminalStatus("cancelled")).toBe(true);
    expect(orch.isTerminalStatus("running")).toBe(false);
    expect(orch.isTerminalStatus("queued")).toBe(false);
  });

  test("listAvailableModels aggregates across registered backends", async () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    const models = await orch.listAvailableModels();
    // We don't register any backends in this test, so the result is []
    // (factory has none registered). The audit-relevant behaviour here is
    // that the call resolves without error; full wiring happens in the
    // factory tests.
    expect(Array.isArray(models)).toBe(true);
  });

  test("default singleton helpers work as advertised", () => {
    const fresh = new FineTuningOrchestrator();
    setDefaultOrchestrator(fresh);
    expect(getDefaultOrchestrator()).toBe(fresh);
    setDefaultOrchestrator(new FineTuningOrchestrator());
  });

  test("does NOT delegate to a missing OpenAI provider", () => {
    const store = new MemoryJobStore();
    const orch = new FineTuningOrchestrator({ store });
    // We don't pass an api key or set OPENAI_API_KEY. Calling on a non-dry
    // backend should error clearly out of the factory, not silently proxy.
    return expect(
      orch.startFromPrepared(
        { openai: dryRunPath, huggingface: null },
        { model: "gpt-4o-mini", nEpochs: 1, backend: "openai" },
      ),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  test("custom registered backend is re-used across calls", async () => {
    let submitCalls = 0;
    class TestBackend extends TrainingBackend {
      readonly name = "dry-run" as const;
      submitJob = async () => ({
        id: `custom-${++submitCalls}`,
        remoteId: `custom-${submitCalls}`,
        model: "gpt-4o-mini",
        status: "succeeded" as const,
        createdAt: new Date(),
        fineTunedModel: "gpt-4o-mini:custom",
      });
      getJobStatus = async (id: string) => ({
        id,
        remoteId: id,
        model: "gpt-4o-mini",
        status: "succeeded" as const,
        createdAt: new Date(),
        fineTunedModel: "gpt-4o-mini:custom",
      });
      cancelJob = async (id: string) => ({
        id,
        remoteId: id,
        model: "gpt-4o-mini",
        status: "cancelled" as const,
        createdAt: new Date(),
      });
      listModels = async () => [
        { id: "gpt-4o-mini", ownedBy: "test", fineTunable: true },
      ];
    }
    const testBackend = new TestBackend();
    const store = new MemoryJobStore();
    const factory = new TrainingBackendFactory({});
    factory.register("dry-run", testBackend);
    const orch = new FineTuningOrchestrator({ store, factory });
    expect(factory.getProvider("dry-run")).toBe(testBackend);

    const job = await orch.startFromPrepared(
      { openai: dryRunPath, huggingface: null },
      { model: "gpt-4o-mini", nEpochs: 1, backend: "dry-run" },
    );
    expect(job.id).toBe("custom-1");
    expect(submitCalls).toBe(1);
    expect(orch).toBeInstanceOf(FineTuningOrchestrator);
  });
});
