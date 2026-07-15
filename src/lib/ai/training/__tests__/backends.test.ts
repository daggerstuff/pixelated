/* @vitest-environment node */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { HuggingFaceTrainingBackend } from "../backends/HuggingFaceTrainingBackend";
import { LocalTrainingBackend } from "../backends/LocalBackend";

describe("LocalTrainingBackend (API path)", () => {
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

describe("LocalTrainingBackend (microservice path)", () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  test("submitJob routes through microservice when scriptPath is set", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: {
            id: "local-123",
            model: "llama3",
            status: "queued",
            created_at: 1_700_000_000,
            fine_tuned_model: null,
          },
        }),
        { status: 202 },
      ),
    );

    const backend = new LocalTrainingBackend({
      scriptPath: "/some/path.py",
      microserviceUrl: "http://ai-svc",
    });
    const result = await backend.submitJob("/tmp/ds.jsonl", {
      model: "llama3",
      nEpochs: 2,
      backend: "local",
    });

    expect(result.remoteId).toBe("local-123");
    expect(result.status).toBe("queued");

    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://ai-svc/api/training/jobs");
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body as string);
    expect(body.model).toBe("llama3");
    expect(body.epochs).toBe(2);
  });

  test("getJobStatus routes through microservice when scriptPath is set", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: {
            id: "local-123",
            model: "llama3",
            status: "succeeded",
            created_at: 1_700_000_000,
            fine_tuned_model: "my-local-model",
          },
        }),
        { status: 200 },
      ),
    );

    const backend = new LocalTrainingBackend({
      scriptPath: "/some/path.py",
      microserviceUrl: "http://ai-svc",
    });
    const result = await backend.getJobStatus("local-123");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("succeeded");
    expect(result!.fineTunedModel).toBe("my-local-model");

    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://ai-svc/api/training/jobs/local-123");
  });

  test("cancelJob routes through microservice when scriptPath is set", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: { id: "local-123", status: "cancelled" },
        }),
        { status: 200 },
      ),
    );

    const backend = new LocalTrainingBackend({
      scriptPath: "/some/path.py",
      microserviceUrl: "http://ai-svc",
    });
    const result = await backend.cancelJob("local-123");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("cancelled");

    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://ai-svc/api/training/jobs/local-123/cancel");
    expect(call[1].method).toBe("POST");
  });
  test("useMicroservice falls back to LOCAL_TRAINING_SCRIPT_PATH env var", () => {
    vi.stubEnv("LOCAL_TRAINING_SCRIPT_PATH", "/env/path.py");
    const backendWithEnv = new LocalTrainingBackend();
    expect((backendWithEnv as any).useMicroservice).toBe(true);

    vi.unstubAllEnvs();
    const backendWithoutEnv = new LocalTrainingBackend();
    expect((backendWithoutEnv as any).useMicroservice).toBe(false);
  });
});

describe("HuggingFaceTrainingBackend", () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("submitJob posts to microservice and returns job", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: {
            id: "hf-123",
            model: "mistralai/Mistral-7B-v0.1",
            status: "queued",
            created_at: 1_700_000_000,
            fine_tuned_model: null,
          },
        }),
        { status: 202 },
      ),
    );

    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    const result = await backend.submitJob("/tmp/ds.jsonl", {
      model: "mistralai/Mistral-7B-v0.1",
      nEpochs: 1,
      backend: "huggingface",
    });

    expect(result.id).toBe("hf-123");
    expect(result.status).toBe("queued");
    expect(result.model).toBe("mistralai/Mistral-7B-v0.1");

    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://ai-svc/api/training/jobs");
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body as string);
    expect(body.model).toBe("mistralai/Mistral-7B-v0.1");
    expect(body.dataset).toBe("/tmp/ds.jsonl");
    expect(body.epochs).toBe(1);
  });

  test("getJobStatus returns job from microservice", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: {
            id: "hf-123",
            model: "meta-llama/Llama-2-7b-hf",
            status: "succeeded",
            created_at: 1_700_000_000,
            fine_tuned_model: "my-model",
          },
        }),
        { status: 200 },
      ),
    );

    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    const result = await backend.getJobStatus("hf-123");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("succeeded");
    expect(result!.fineTunedModel).toBe("my-model");
  });

  test("getJobStatus returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));
    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    expect(await backend.getJobStatus("hf-123")).toBeNull();
  });

  test("cancelJob posts to microservice cancel endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          job: { id: "hf-123", status: "cancelled" },
        }),
        { status: 200 },
      ),
    );

    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    const result = await backend.cancelJob("hf-123");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("cancelled");

    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://ai-svc/api/training/jobs/hf-123/cancel");
    expect(call[1].method).toBe("POST");
  });

  test("cancelJob returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));
    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    expect(await backend.cancelJob("hf-123")).toBeNull();
  });

  test("listModels fetches from microservice", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          models: [
            { id: "meta-llama/Llama-2-7b-hf", owned_by: "meta", fine_tunable: true },
          ],
        }),
        { status: 200 },
      ),
    );

    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    const models = await backend.listModels();
    expect(models).toEqual([
      { id: "meta-llama/Llama-2-7b-hf", ownedBy: "meta", fineTunable: true },
    ]);
  });

  test("listModels falls back to static list on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));
    const backend = new HuggingFaceTrainingBackend({
      baseUrl: "http://ai-svc",
      apiKey: "test-key",
    });
    const models = await backend.listModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain("meta-llama/Llama-2-7b-hf");
    expect(ids).toContain("mistralai/Mistral-7B-v0.1");
    expect(models.every((m) => m.fineTunable)).toBe(true);
  });
});
