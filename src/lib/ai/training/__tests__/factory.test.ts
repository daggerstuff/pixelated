/* @vitest-environment node */
import { describe, expect, test } from "vitest";

import { TrainingBackendFactory } from "../TrainingBackendFactory";
import { MemoryCostTracker } from "../TrainingBackendFactory";
import { MemoryJobStore } from "../job-store";
import { DryRunTrainingBackend } from "../backends/DryRunBackend";

describe("TrainingBackendFactory", () => {
  test("registers and reuses explicitly added backends", () => {
    const factory = new TrainingBackendFactory({});
    const dry = new DryRunTrainingBackend();
    factory.register("dry-run", dry);
    expect(factory.getProvider("dry-run")).toBe(dry);
    // Second call must not replace the registered backend.
    expect(factory.getProvider("dry-run")).toBe(dry);
  });

  test("builds backend lazily from env when not registered", () => {
    const factory = new TrainingBackendFactory({});
    expect(() => factory.getProvider("openai")).toThrow(/OPENAI_API_KEY/);
  });

  test("exposes the active job store", () => {
    const factory = new TrainingBackendFactory({});
    expect(factory.getJobStore()).toBeInstanceOf(MemoryJobStore);
  });

  test("exposes a fresh MemoryCostTracker by default", () => {
    const factory = new TrainingBackendFactory({});
    expect(factory.getCostTracker()).toBeInstanceOf(MemoryCostTracker);
  });

  test("setJobStore replaces the underlying store", () => {
    const factory = new TrainingBackendFactory({});
    const custom = new MemoryJobStore();
    factory.setJobStore(custom);
    expect(factory.getJobStore()).toBe(custom);
  });

  test("setCostTracker replaces the active cost tracker", () => {
    const factory = new TrainingBackendFactory({});
    const custom = new MemoryCostTracker();
    factory.setCostTracker(custom);
    expect(factory.getCostTracker()).toBe(custom);
  });
});
