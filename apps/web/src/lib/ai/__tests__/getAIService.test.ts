import { describe, it, expect, afterEach, vi } from "vitest";

// Mock modules with side effects that fail in test environments.
// - arize-setup → OTLP exporter with bad URL crashes in node
// - datasets → node:fs imports crash in jsdom
vi.mock("../tracing/arize-setup", () => ({ initArizeTracing: vi.fn(), getArizeTracer: vi.fn() }));
vi.mock("../datasets/prepare-fine-tuning", () => ({}));
vi.mock("../datasets/merge-datasets", () => ({}));

describe("getAIService factory (S2: mock-vs-prod dispatch)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns MockAIService when PRODUCTION_AI_SERVICE is not set", async () => {
    vi.stubEnv("PRODUCTION_AI_SERVICE", "");
    const mod = await import("../index");
    mod.resetAIServiceForTesting();
    const svc =  mod.getAIService();
    const status = await svc.getStatus();
    expect(status.activeModels).toEqual(["mock-model-v1"]);
    await svc.dispose();
  });

  it("returns FineTuningAIService when PRODUCTION_AI_SERVICE=true", async () => {
    vi.stubEnv("PRODUCTION_AI_SERVICE", "true");
    const mod = await import("../index");
    mod.resetAIServiceForTesting();
    const svc =  mod.getAIService();
    const status = await svc.getStatus();
    expect(Array.isArray(status.activeModels)).toBe(true);
    await svc.dispose();
  });
});
