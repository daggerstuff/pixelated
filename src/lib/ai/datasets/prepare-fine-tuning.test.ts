import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mapRoleToHuggingFace,
  mapRoleToOpenAI,
  preparedDatasetsExist,
} from "./prepare-fine-tuning";

describe("prepare-fine-tuning", () => {
  describe("mapRoleToOpenAI", () => {
    it("should map client to user", () => {
      expect(mapRoleToOpenAI("client")).toBe("user");
    });

    it("should map therapist to assistant", () => {
      expect(mapRoleToOpenAI("therapist")).toBe("assistant");
    });

    it("should map user to user", () => {
      expect(mapRoleToOpenAI("user")).toBe("user");
    });

    it("should map assistant to assistant", () => {
      expect(mapRoleToOpenAI("assistant")).toBe("assistant");
    });

    it("should handle uppercase roles", () => {
      expect(mapRoleToOpenAI("CLIENT")).toBe("user");
      expect(mapRoleToOpenAI("THERAPIST")).toBe("assistant");
    });

    it("should default unknown roles to user", () => {
      expect(mapRoleToOpenAI("unknown")).toBe("user");
      expect(mapRoleToOpenAI("moderator")).toBe("user");
    });
  });

  describe("mapRoleToHuggingFace", () => {
    it("should map client to human", () => {
      expect(mapRoleToHuggingFace("client")).toBe("human");
    });

    it("should map therapist to gpt", () => {
      expect(mapRoleToHuggingFace("therapist")).toBe("gpt");
    });

    it("should map user to human", () => {
      expect(mapRoleToHuggingFace("user")).toBe("human");
    });

    it("should map assistant to gpt", () => {
      expect(mapRoleToHuggingFace("assistant")).toBe("gpt");
    });

    it("should handle uppercase roles", () => {
      expect(mapRoleToHuggingFace("CLIENT")).toBe("human");
      expect(mapRoleToHuggingFace("THERAPIST")).toBe("gpt");
    });

    it("should default unknown roles to human", () => {
      expect(mapRoleToHuggingFace("unknown")).toBe("human");
    });
  });
});

describe("preparedDatasetsExist", () => {
  let preparedDir: string;

  beforeEach(() => {
    preparedDir = join(process.cwd(), "data", "prepared");
  });

  afterEach(() => {
    try {
      rmSync(preparedDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return false for both when neither exists", () => {
    const status = preparedDatasetsExist();
    expect(status.openai).toBe(false);
    expect(status.huggingface).toBe(false);
  });

  it("should return true for OpenAI when file exists", () => {
    mkdirSync(preparedDir, { recursive: true });
    writeFileSync(join(preparedDir, "openai_dataset.jsonl"), "test", "utf-8");

    const status = preparedDatasetsExist();
    expect(status.openai).toBe(true);
    expect(status.huggingface).toBe(false);
  });

  it("should return true for HuggingFace when file exists", () => {
    mkdirSync(preparedDir, { recursive: true });
    writeFileSync(join(preparedDir, "huggingface_dataset.jsonl"), "test", "utf-8");

    const status = preparedDatasetsExist();
    expect(status.openai).toBe(false);
    expect(status.huggingface).toBe(true);
  });

  it("should return true for both when both files exist", () => {
    mkdirSync(preparedDir, { recursive: true });
    writeFileSync(join(preparedDir, "openai_dataset.jsonl"), "test", "utf-8");
    writeFileSync(join(preparedDir, "huggingface_dataset.jsonl"), "test", "utf-8");

    const status = preparedDatasetsExist();
    expect(status.openai).toBe(true);
    expect(status.huggingface).toBe(true);
  });
});
