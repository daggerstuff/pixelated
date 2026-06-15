/* @vitest-environment node */
import { describe, expect, test } from "vitest";

import { DryRunTrainingBackend } from "../backends/DryRunBackend";

describe("DryRunTrainingBackend", () => {
  test("submitJob returns succeeded job with fineTunedModel", async () => {
    const backend = new DryRunTrainingBackend();
    const job = await backend.submitJob("/tmp/x.jsonl", {
      model: "gpt-4o-mini",
      nEpochs: 1,
      backend: "dry-run",
    });
    expect(job.status).toBe("succeeded");
    expect(job.fineTunedModel).toMatch(/gpt-4o-mini:dry-run-/);
  });

  test("cancelJob returns cancelled status", async () => {
    const backend = new DryRunTrainingBackend();
    const cancelled = await backend.cancelJob("ft-1");
    expect(cancelled?.status).toBe("cancelled");
  });

  test("listModels exposes dry-run fixtures", async () => {
    const backend = new DryRunTrainingBackend();
    const models = await backend.listModels();
    expect(models.map((m) => m.id)).toContain("gpt-4o-mini");
  });

  test("verifyWebhookSignature returns false (no-op default)", () => {
    const backend = new DryRunTrainingBackend();
    expect(backend.verifyWebhookSignature("{}", "sig")).toBe(false);
  });
});
