/* @vitest-environment node */
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prepareForHuggingFace, prepareForOpenAI } from "./prepare-fine-tuning";

const testRecord = {
  conversation_id: "test_conv_001",
  source: "integration_test",
  messages: [
    { role: "client", content: "I've been feeling anxious about my job interview tomorrow." },
    { role: "therapist", content: "It's completely normal to feel anxious before an important event. Can you tell me more about what specific thoughts are coming up for you?" },
    { role: "client", content: "I'm worried I'll freeze up and forget everything I prepared." },
  ],
  metadata: { quality_score: 0.85 },
};

describe("prepare-fine-tuning integration", () => {
  // Unique run-scoped directories so parallel vitest workers (and aborted
  // prior runs) never collide on shared files or read a stale artifact.
  const runId = `${process.pid}-${Date.now()}`;
  const sourceDir = join(process.cwd(), "ai", "data", `normalized-${runId}`);
  const testOnlyOutDir = join(process.cwd(), "data", `test-prepared-${runId}`);
  const testFilePath = join(sourceDir, "test_integration_normalized.jsonl");

  beforeAll(() => {
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(testFilePath, JSON.stringify(testRecord) + "\n", "utf-8");
  });

  afterAll(() => {
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch {}
    try { rmSync(testOnlyOutDir, { recursive: true, force: true }); } catch {}
  });

  test("prepareForOpenAI produces valid OpenAI-format output", async () => {
    const outputPath = await prepareForOpenAI(sourceDir, testOnlyOutDir);
    expect(outputPath).not.toBeNull();
    expect(existsSync(outputPath!)).toBe(true);

    const lines = readFileSync(outputPath!, "utf-8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("messages");
      expect(Array.isArray(parsed.messages)).toBe(true);
      expect(parsed.messages.length).toBeGreaterThanOrEqual(2);

      const systemMsgs = parsed.messages.filter(
        (m: { role: string }) => m.role === "system",
      );
      expect(systemMsgs.length).toBe(1);
      expect(systemMsgs[0].content).toContain("empathetic");

      for (const msg of parsed.messages) {
        expect(["system", "user", "assistant"]).toContain(msg.role);
        expect(typeof msg.content).toBe("string");
      }
    }
  }, 30000);

  test("prepareForHuggingFace produces valid HuggingFace-format output", async () => {
    const outputPath = await prepareForHuggingFace(sourceDir, testOnlyOutDir);
    expect(outputPath).not.toBeNull();
    expect(existsSync(outputPath!)).toBe(true);

    const lines = readFileSync(outputPath!, "utf-8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("conversations");
      expect(Array.isArray(parsed.conversations)).toBe(true);
      expect(parsed.conversations.length).toBeGreaterThanOrEqual(2);

      for (const conv of parsed.conversations) {
        expect(["human", "gpt"]).toContain(conv.from);
        expect(typeof conv.value).toBe("string");
      }

      if (parsed.source !== undefined) {
        expect(typeof parsed.source).toBe("string");
      }
      if (parsed.quality_score !== undefined) {
        expect(typeof parsed.quality_score).toBe("number");
      }
    }
  }, 30000);
});
