/* @vitest-environment node */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { HuggingFaceTrainingBackend } from "../backends/HuggingFaceTrainingBackend";
import { LocalTrainingBackend } from "../backends/LocalBackend";

describe("LocalTrainingBackend", () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("submitJob returns failed status when server is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"))
    const backend = new LocalTrainingBackend();
    const result = await backend.submitJob("/tmp/no.jsonl", {
      model: "any",
      nEpochs: 1,
      backend: "local",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Connection refused");
  });

  test("getJobStatus returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"))
    const backend = new LocalTrainingBackend();
    expect(await backend.getJobStatus("x")).toBeNull();
  });

  test("cancelJob returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"))
    const backend = new LocalTrainingBackend();
    expect(await backend.cancelJob("x")).toBeNull();
  });

  test("listModels falls back to default model when server is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"))
    const backend = new LocalTrainingBackend({ model: "local-gguf-base" });
    const models = await backend.listModels();
    expect(models).toEqual([
      { id: "local-gguf-base", ownedBy: "local", fineTunable: true },
    ]);
  });
});

describe("HuggingFaceTrainingBackend", () => {
  test("cancelJob throws until microservice wiring lands", async () => {
    const backend = new HuggingFaceTrainingBackend({});
    await expect(backend.cancelJob("hf-1")).rejects.toThrow(
      /HuggingFaceTrainingBackend does not support cancel/,
    );
  });

  test("submitJob throws when finetune_model.py is missing", async () => {
    const backend = new HuggingFaceTrainingBackend({
      scriptPath: "/tmp/non-existent-script.py",
      timeoutMs: 1000,
    });
    await expect(
      backend.submitJob("/tmp/missing.jsonl", {
        model: "mistralai/Mistral-7B-v0.1",
        nEpochs: 1,
        backend: "huggingface",
      }),
    ).rejects.toThrow(/HuggingFace backend script not found/);
  });

  test("listModels includes mistral and llama entries", async () => {
    const backend = new HuggingFaceTrainingBackend({});
    const models = await backend.listModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain("meta-llama/Llama-2-7b-hf");
    expect(ids).toContain("mistralai/Mistral-7B-v0.1");
    expect(models.every((m) => m.fineTunable)).toBe(true);
  });
});
