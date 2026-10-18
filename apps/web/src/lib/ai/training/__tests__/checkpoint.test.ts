import { describe, it, expect } from "vitest";
import { FineTuningOrchestrator } from "../FineTuningOrchestrator";
import { MemoryJobStore } from "../job-store";
import { TrainingBackendFactory } from "../TrainingBackendFactory";
import { TrainingBackend } from "../backends/Base";
import type { FineTuningJob } from "../types";

class TinkerFake extends TrainingBackend {
  readonly name = "dry-run" as const;
  saveCheckpoint = async (remoteId: string) => ({
    checkpointId: `ckpt-${remoteId}`,
    path: `/tmp/ckpt-${remoteId}`,
  });
  resumeFromCheckpoint = async (id: string): Promise<FineTuningJob> => ({
    id: `resumed-${id}`,
    remoteId: id,
    model: "gpt-4o-mini",
    status: "queued",
    createdAt: new Date(),
  });
  submitJob = async (_p: string, c: any): Promise<FineTuningJob> => ({
    id: `dry-${Date.now()}`, remoteId: `dry-${Date.now()}`, model: c.model, status: "succeeded", createdAt: new Date(),
  });
  getJobStatus = async (r: string) => ({ id: r, remoteId: r, model: "gpt-4o-mini", status: "succeeded" as const, createdAt: new Date() });
  cancelJob = async (r: string) => ({ id: r, remoteId: r, model: "gpt-4o-mini", status: "cancelled" as const, createdAt: new Date() });
  listModels = async () => [];
}

describe("Checkpoint resume", () => {
  it("saveCheckpoint creates pointer and resumeFromCheckpoint restores job", async () => {
    const store = new MemoryJobStore();
    const factory = new TrainingBackendFactory({});
    factory.register("dry-run", new TinkerFake());
    const orch = new FineTuningOrchestrator({ store, factory });
    // Seed a job manually
    const job: FineTuningJob = { id: "j1", remoteId: "r1", model: "gpt-4o-mini", status: "succeeded", createdAt: new Date(), backend: "dry-run" };
    await store.put(job);
    const cp = await orch.saveCheckpoint("j1", "adapter");
    expect(cp?.kind).toBe("adapter");
    expect(cp?.jobId).toBe("j1");
    expect(orch.getCheckpoint(cp!.id)).toEqual(cp);
    const resumed = await orch.resumeFromCheckpoint(cp!.id);
    expect(resumed?.id).toContain("resumed");
  });
  it("returns null for unknown job/checkpoint", async () => {
    const orch = new FineTuningOrchestrator({ store: new MemoryJobStore() });
    expect(await orch.saveCheckpoint("nope")).toBeNull();
    expect(await orch.resumeFromCheckpoint("nope")).toBeNull();
    expect(orch.getCheckpoint("nope")).toBeNull();
  });
});
