/* @vitest-environment node */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

// HuggingFaceTrainingBackend reads AI_SERVICE_API_KEY from env into a module-level
// const at import time, so the key must be present BEFORE the backend module is
// evaluated. A side-effect import placed ahead of the orchestrator import runs
// first (ESM evaluates imports in source order) and seeds the env in time, so the
// backend proceeds to the network call instead of throwing "API key required".
import "./training-orchestrator.test-env";

import { FineTuningOrchestrator } from "./training-orchestrator";

function writeDatasetFile(content: string): string {
  const dir = join(process.cwd(), "data", "test-orchestrator");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `test-${Date.now()}.jsonl`);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function cleanDir(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

describe("FineTuningOrchestrator", () => {
  const testDir = join(process.cwd(), "data", "test-orchestrator");
  let openaiPath: string;
  let huggingfacePath: string;

  beforeAll(() => {
    openaiPath = writeDatasetFile(
      JSON.stringify({
        messages: [
          { role: "system", content: "You are empathetic." },
          { role: "user", content: "I feel anxious." },
          { role: "assistant", content: "Tell me more." },
        ],
      }) + "\n",
    );
    huggingfacePath = writeDatasetFile(
      JSON.stringify({
        conversations: [
          { from: "human", value: "I feel anxious." },
          { from: "gpt", value: "Tell me more." },
        ],
      }) + "\n",
    );
  });

  afterAll(() => {
    cleanDir(testDir);
  });

  describe("dry-run backend", () => {
    test("returns a succeeded job with fineTunedModel", async () => {
      const orch = new FineTuningOrchestrator();
      const job = await orch.startFromPrepared(
        { openai: openaiPath, huggingface: huggingfacePath },
        { model: "gpt-4o-mini", nEpochs: 3, backend: "dry-run" },
      );

      expect(job.id).toMatch(/^ft-/);
      expect(job.status).toBe("succeeded");
      expect(job.fineTunedModel).toContain("gpt-4o-mini:dry-run-");
    });
  });

  describe("getJobStatus", () => {
    test("returns null for unknown job", async () => {
      const orch = new FineTuningOrchestrator();
      expect(await orch.getJobStatus("nonexistent")).toBeNull();
    });

    test("returns stored job data", async () => {
      const orch = new FineTuningOrchestrator();
      const job = await orch.startFromPrepared(
        { openai: openaiPath, huggingface: null },
        { model: "gpt-4o-mini", nEpochs: 2, backend: "dry-run" },
      );

      const stored = await orch.getJobStatus(job.id);
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe(job.id);
      expect(stored!.status).toBe("succeeded");
    });
  });

  describe("listJobs", () => {
    test("lists all created jobs", async () => {
      const orch = new FineTuningOrchestrator();
      await orch.startFromPrepared(
        { openai: openaiPath, huggingface: null },
        { model: "gpt-4o-mini", nEpochs: 2, backend: "dry-run" },
      );
      await orch.startFromPrepared(
        { openai: openaiPath, huggingface: null },
        { model: "gpt-4o", nEpochs: 1, backend: "dry-run" },
      );

      const jobs = orch.listJobs();
      expect(jobs).toHaveLength(2);
    });
  });

  describe("validation", () => {
    test("throws when dataset file is missing", async () => {
      const orch = new FineTuningOrchestrator();
      await expect(
        orch.startFromPrepared(
          { openai: "/nonexistent/file.jsonl", huggingface: null },
          { model: "gpt-4o-mini", nEpochs: 3, backend: "dry-run" },
        ),
      ).rejects.toThrow("Dataset file not found");
    });

    test("throws when dataset file is empty", async () => {
      const emptyPath = writeDatasetFile("");
      const orch = new FineTuningOrchestrator();
      await expect(
        orch.startFromPrepared(
          { openai: emptyPath, huggingface: null },
          { model: "gpt-4o-mini", nEpochs: 3, backend: "dry-run" },
        ),
      ).rejects.toThrow("Dataset file is empty");
    });

    test("throws when dataset file is not valid JSONL", async () => {
      const badPath = writeDatasetFile("not-json\n");
      const orch = new FineTuningOrchestrator();
      await expect(
        orch.startFromPrepared(
          { openai: badPath, huggingface: null },
          { model: "gpt-4o-mini", nEpochs: 3, backend: "dry-run" },
        ),
      ).rejects.toThrow("Dataset file does not contain valid JSONL");
    });

    test("throws when required dataset path is missing", async () => {
      const orch = new FineTuningOrchestrator();
      await expect(
        orch.startFromPrepared(
          { openai: null, huggingface: null },
          { model: "gpt-4o-mini", nEpochs: 3, backend: "openai" },
        ),
      ).rejects.toThrow("No dataset path available for OpenAI backend");
    });
  });

  describe("constructor", () => {
    test("uses provided api key and base url", () => {
      const orch = new FineTuningOrchestrator({
        openaiApiKey: "sk-test",
        baseUrl: "https://custom.example.com/v1/fine_tuning/jobs",
      });
      expect(orch).toBeInstanceOf(FineTuningOrchestrator);
    });
  });

  describe("error backends", () => {
    beforeEach(() => {
      // Ensure the backend proceeds past its API-key guard to the network call.
      process.env["AI_SERVICE_API_KEY"] = "test-key";
    });

    test("huggingface backend throws when microservice unreachable", async () => {
      const orch = new FineTuningOrchestrator();
      await expect(
        orch.startFromPrepared(
          { openai: openaiPath, huggingface: huggingfacePath },
          { model: "meta-llama/Llama-2-7b", nEpochs: 3, backend: "huggingface" },
        ),
      ).rejects.toThrow(/fetch failed|Connection refused|ECONNREFUSED|returned \d{3}/);
    });

    test("local backend returns failed job when unreachable", async () => {
      const orch = new FineTuningOrchestrator();
      const job = await orch.startFromPrepared(
        { openai: openaiPath, huggingface: huggingfacePath },
        { model: "local-model", nEpochs: 3, backend: "local" },
      );
      expect(job.status).toBe("failed");
      expect(job.error).toBeDefined();
      expect(typeof job.error).toBe("string");
    });
  });
});
