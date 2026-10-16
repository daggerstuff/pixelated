/* @vitest-environment node */
import { describe, expect, test } from "vitest";

import {
  normalizeLrSchedule,
  resolveLrForStep,
  resolveLrMultiplier,
  scaleLrForBatchSize,
  scaledLrHint,
} from "../lr-schedule";
import {
  estimateLoraParams,
  getDimuonLrHint,
  getLoraCapacityWarning,
  validateLoraConfig,
} from "../lora";

describe("lr-schedule helpers (Tinker)", () => {
  test("constant schedule returns 1 at any step", () => {
    expect(resolveLrMultiplier(undefined, 5, 100)).toBe(1);
    expect(resolveLrMultiplier({ kind: "constant" }, 0, 100)).toBe(1);
    expect(resolveLrMultiplier({ kind: "constant" }, 99, 100)).toBe(1);
  });

  test("linear-decay-to-zero goes 1 → 0", () => {
    const sched = { kind: "linear-decay-to-zero" as const, decaySteps: 100 };
    expect(resolveLrMultiplier(sched, 0, 100)).toBeCloseTo(1);
    expect(resolveLrMultiplier(sched, 50, 100)).toBeCloseTo(0.5);
    expect(resolveLrMultiplier(sched, 100, 100)).toBeCloseTo(0);
    expect(resolveLrMultiplier(sched, 150, 100)).toBe(0);
  });

  test("cosine goes 1 → ~0", () => {
    const sched = { kind: "cosine" as const, decaySteps: 100 };
    expect(resolveLrMultiplier(sched, 0, 100)).toBeCloseTo(1);
    expect(resolveLrMultiplier(sched, 50, 100)).toBeCloseTo(0.5, 1);
    expect(resolveLrMultiplier(sched, 100, 100)).toBeCloseTo(0, 1);
  });

  test("warmup ramps 0 → 1 before schedule", () => {
    const sched = {
      kind: "linear-decay-to-zero" as const,
      warmupSteps: 10,
      decaySteps: 100,
    };
    expect(resolveLrMultiplier(sched, 0, 100)).toBeCloseTo(0.1);
    expect(resolveLrMultiplier(sched, 9, 100)).toBeCloseTo(1);
    expect(resolveLrMultiplier(sched, 10, 100)).toBeCloseTo(1);
  });

  test("resolveLrForStep scales base LR", () => {
    expect(resolveLrForStep(1e-4, { kind: "constant" }, 50, 100)).toBe(1e-4);
    expect(
      resolveLrForStep(1e-4, { kind: "linear-decay-to-zero", decaySteps: 100 }, 50, 100),
    ).toBeCloseTo(5e-5);
  });

  test("scaleLrForBatchSize follows sqrt rule", () => {
    expect(scaleLrForBatchSize(1e-4, 32, 32)).toBeCloseTo(1e-4);
    expect(scaleLrForBatchSize(1e-4, 32, 128)).toBeCloseTo(2e-4);
    expect(scaleLrForBatchSize(1e-4, 32, 8)).toBeCloseTo(5e-5);
  });

  test("scaleLrForBatchSize guards invalid batch", () => {
    expect(scaleLrForBatchSize(1e-4, 0, 32)).toBe(1e-4);
    expect(scaleLrForBatchSize(1e-4, 32, 0)).toBe(1e-4);
  });

  test("scaledLrHint returns null when inapplicable", () => {
    expect(scaledLrHint({ model: "x", nEpochs: 1, backend: "dry-run" })).toBeNull();
    expect(
      scaledLrHint({ model: "x", nEpochs: 1, backend: "dry-run", batchSize: 32, baselineBatchSize: 32 }),
    ).toBeNull();
  });

  test("scaledLrHint computes when applicable", () => {
    const hint = scaledLrHint({
      model: "x",
      nEpochs: 1,
      backend: "dry-run",
      batchSize: 128,
      baselineBatchSize: 32,
      learningRateMultiplier: 1e-4,
    });
    expect(hint).not.toBeNull();
    expect(hint!).toBeCloseTo(2e-4);
  });

  test("normalizeLrSchedule defaults correctly", () => {
    expect(normalizeLrSchedule(undefined, 3)).toEqual({ kind: "constant" });
    expect(normalizeLrSchedule({ kind: "cosine" }, 3).decaySteps).toBeGreaterThan(0);
    expect(normalizeLrSchedule({ kind: "linear-decay-to-zero", decaySteps: 50 }, 3).decaySteps).toBe(
      50,
    );
  });
});

describe("lora helpers (Tinker)", () => {
  test("estimateLoraParams scales with rank and target", () => {
    const all32 = estimateLoraParams(7_000_000_000, 32, "all");
    const all64 = estimateLoraParams(7_000_000_000, 64, "all");
    const attn32 = estimateLoraParams(7_000_000_000, 32, "attention-only");
    expect(all64).toBeGreaterThan(all32);
    expect(attn32).toBeLessThan(all32);
    expect(all32).toBeGreaterThan(0);
  });

  test("getLoraCapacityWarning fires when tokens exceed params", () => {
    expect(getLoraCapacityWarning(100, 1000)).toBeNull();
    expect(getLoraCapacityWarning(1000, 100)).toContain("LoRA capacity");
    expect(getLoraCapacityWarning(0, 100)).toBeNull();
  });

  test("getDimuonLrHint uses 15x SFT / 60x RL", () => {
    expect(getDimuonLrHint(1e-4, "sft")).toBeCloseTo(1.5e-3);
    expect(getDimuonLrHint(1e-4, "rl")).toBeCloseTo(6e-3);
  });

  test("validateLoraConfig warns on attention-only and bad rank", () => {
    expect(validateLoraConfig(32, "all")).toHaveLength(0);
    expect(validateLoraConfig(0, "all")[0]).toMatch(/positive integer/);
    expect(validateLoraConfig(16, "attention-only")[0]).toMatch(/attention-only/);
  });
});
