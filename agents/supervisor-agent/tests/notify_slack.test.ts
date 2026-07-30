import { describe, it, expect } from "vitest";
import { z } from "zod";

// ---- CUT ----
const SCHEMA = z.object({
  channel: z.string().min(1),
  message: z.string().min(1).max(4000),
  thread_ts: z.string().optional(),
});

async function execute(input: z.infer<typeof SCHEMA>) {
  return {
    channel: input.channel,
    message_preview: input.message.slice(0, 100),
    length: input.message.length,
    thread: input.thread_ts ?? null,
    status: "queued",
    note: "Message will be delivered through the configured Slack channel on the next agent turn.",
  };
}
// ---- CUT ----

describe("notify_slack", () => {
  it("should queue a message for delivery", async () => {
    const result = await execute({
      channel: "#supervisor",
      message: "**Cohort Report**: CBT-2026-01 completed module 3 with avg score 82.",
    });

    expect(result.channel).toBe("#supervisor");
    expect(result.status).toBe("queued");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should truncate preview to 100 chars", async () => {
    const long = "x".repeat(250);
    const result = await execute({ channel: "#test", message: long });

    expect(result.message_preview).toHaveLength(100);
    expect(result.length).toBe(250);
  });

  it("should accept an optional thread_ts", async () => {
    const result = await execute({
      channel: "#supervisor",
      message: "Reply message",
      thread_ts: "1234567890.123456",
    });

    expect(result.thread).toBe("1234567890.123456");
  });

  it("should reject empty channel", () => {
    expect(() => {
      SCHEMA.parse({ channel: "", message: "test" });
    }).toThrow();
  });

  it("should reject empty message", () => {
    expect(() => {
      SCHEMA.parse({ channel: "#test", message: "" });
    }).toThrow();
  });

  it("should reject overly long message (>4000 chars)", () => {
    expect(() => {
      SCHEMA.parse({ channel: "#test", message: "x".repeat(4001) });
    }).toThrow();
  });
});
