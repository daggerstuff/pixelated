import { describe, expect, it } from "vitest";

import { extractToolCallSummary, normalizeToolCallPayload } from "../llm-tool-call-transformer";

// Type alias (not interface) so it satisfies the Record<string, unknown>
// constraint on normalizeToolCallPayload's type parameter.
type TestPayload = {
  model?: string;
  messages?: Array<Record<string, unknown>> | null;
};

type NormalizedCall = {
  id?: string;
  type?: string;
  name?: string;
  arguments?: string;
  function?: { name?: string; arguments?: string };
};

const callsOf = (payload: TestPayload, index = 0): NormalizedCall[] | undefined =>
  payload.messages?.[index]?.["tool_calls"] as NormalizedCall[] | undefined;

describe("module exports", () => {
  it("exports normalizeToolCallPayload and extractToolCallSummary", () => {
    // Regression guard: 24b22282b5 renamed the export, breaking the SSR build
    // (llm-provider.ts imports normalizeToolCallPayload).
    expect(typeof normalizeToolCallPayload).toBe("function");
    expect(typeof extractToolCallSummary).toBe("function");
  });
});

describe("normalizeToolCallPayload", () => {
  it("returns a defined payload when messages are present", () => {
    // Regression guard: a rewrite dropped the return statement, so payloads
    // with messages came back undefined and crashed llm-provider at runtime.
    const payload: TestPayload = {
      model: "test-model",
      messages: [{ role: "assistant", content: "hi" }],
    };

    const result = normalizeToolCallPayload(payload);

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result.model).toBe("test-model");
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages).toHaveLength(1);
  });

  it("preserves message order and non-message fields", () => {
    const payload: TestPayload = {
      model: "m",
      messages: [
        { role: "user", content: "one" },
        { role: "assistant", content: "two" },
      ],
    };

    const result = normalizeToolCallPayload(payload);

    expect(result.model).toBe("m");
    expect(result.messages?.[0]).toMatchObject({ role: "user", content: "one" });
    expect(result.messages?.[1]).toMatchObject({
      role: "assistant",
      content: "two",
    });
  });

  it("returns the payload unchanged when messages is missing", () => {
    const payload: TestPayload = { model: "m" };

    expect(normalizeToolCallPayload(payload)).toBe(payload);
  });

  it("returns the payload unchanged when messages is not an array", () => {
    const payload: TestPayload = { model: "m", messages: null };

    expect(normalizeToolCallPayload(payload)).toBe(payload);
  });

  it("does not mutate the input payload", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "c1", function: { name: "f", arguments: "{}" } }],
        },
      ],
    };
    const snapshot = JSON.stringify(payload);

    normalizeToolCallPayload(payload);

    expect(JSON.stringify(payload)).toBe(snapshot);
  });
});

describe("tool_calls normalization", () => {
  it("normalizes each tool call with id, type, function, and mirrored name/arguments", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              id: "call-123",
              type: "function",
              function: { name: "get_weather", arguments: '{"city":"Paris"}' },
            },
          ],
        },
      ],
    };

    const result = normalizeToolCallPayload(payload);
    const [call] = callsOf(result) ?? [];

    expect(call.id).toBe("call-123");
    expect(call.type).toBe("function");
    expect(call.function?.name).toBe("get_weather");
    expect(call.function?.arguments).toBe('{"city":"Paris"}');
    expect(call.name).toBe("get_weather");
    expect(call.arguments).toBe('{"city":"Paris"}');
  });

  it("defaults missing type to function and missing id to tool_N", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ function: { name: "f", arguments: "{}" } }],
        },
      ],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.id).toBe("tool_1");
    expect(call.type).toBe("function");
  });

  it("falls back to function.name when top-level name is missing", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "c1", function: { name: "lookup", arguments: "{}" } }],
        },
      ],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.name).toBe("lookup");
    expect(call.function?.name).toBe("lookup");
  });

  it("falls back to tool_N when no name is present", () => {
    const payload: TestPayload = {
      messages: [{ role: "assistant", tool_calls: [{ id: "c1", arguments: "{}" }] }],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.name).toBe("tool_1");
    expect(call.function?.name).toBe("tool_1");
  });

  it("filters non-object tool call entries", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: ["garbage", { id: "c1", function: { name: "f", arguments: "{}" } }, 42],
        },
      ],
    };

    const calls = callsOf(normalizeToolCallPayload(payload));

    expect(calls).toHaveLength(1);
    expect(calls?.[0].id).toBe("c1");
  });

  it("removes tool_calls when every entry is non-object", () => {
    const payload: TestPayload = {
      messages: [{ role: "assistant", tool_calls: ["garbage", null] }],
    };

    expect(callsOf(normalizeToolCallPayload(payload))).toBeUndefined();
  });
});

describe("tool call id normalization", () => {
  const withId = (id: unknown): NormalizedCall | undefined => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id, function: { name: "f", arguments: "{}" } }],
        },
      ],
    };
    return (callsOf(normalizeToolCallPayload(payload)) ?? [])[0];
  };

  it("sanitizes characters outside [a-zA-Z0-9._-]", () => {
    expect(withId("call/abc 123")?.id).toBe("call_abc_123");
  });

  it("truncates ids to 72 characters", () => {
    expect(withId("a".repeat(80))?.id).toBe("a".repeat(72));
  });

  it("falls back to tool_N for non-string ids", () => {
    expect(withId(123)?.id).toBe("tool_1");
  });

  it("falls back to tool_N for blank ids", () => {
    expect(withId("   ")?.id).toBe("tool_1");
  });
});

describe("arguments normalization", () => {
  const withArgs = (rawArgs: unknown): NormalizedCall | undefined => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "c1", function: { name: "f", arguments: rawArgs } }],
        },
      ],
    };
    return (callsOf(normalizeToolCallPayload(payload)) ?? [])[0];
  };

  it("defaults missing arguments to {}", () => {
    const call = withArgs(undefined);

    expect(call?.function?.arguments).toBe("{}");
    expect(call?.arguments).toBe("{}");
  });

  it("re-serializes valid JSON strings compactly", () => {
    expect(withArgs('{"city": "Paris"}')?.function?.arguments).toBe('{"city":"Paris"}');
  });

  it("repairs trailing commas and single-quoted JSON", () => {
    expect(withArgs("{ 'city': 'Paris', }")?.function?.arguments).toBe('{"city":"Paris"}');
  });

  it("keeps unparseable strings as-is", () => {
    expect(withArgs("not json at all")?.function?.arguments).toBe("not json at all");
  });

  it("truncates long unparseable strings to 8192 characters", () => {
    expect(withArgs("x".repeat(9000))?.function?.arguments).toHaveLength(8192);
  });

  it("serializes object arguments", () => {
    expect(withArgs({ city: "Paris" })?.function?.arguments).toBe('{"city":"Paris"}');
  });

  it("truncates oversized strings that skip JSON repair", () => {
    // Over 2x the args cap, so repair is skipped and the raw string is kept.
    expect(withArgs("y".repeat(20_000))?.function?.arguments).toHaveLength(8192);
  });

  it("falls back to {} when serializing the object throws", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(withArgs(circular)?.function?.arguments).toBe("{}");
  });
});

describe("legacy function_call synthesis", () => {
  it("synthesizes a tool call from function_call.name and arguments", () => {
    const payload: TestPayload = {
      messages: [
        {
          role: "assistant",
          tool_call_id: "call-abc",
          function_call: { name: "search", arguments: '{"q":"pixelated"}' },
        },
      ],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.id).toBe("call-abc");
    expect(call.type).toBe("function");
    expect(call.function?.name).toBe("search");
    expect(call.function?.arguments).toBe('{"q":"pixelated"}');
    expect(call.name).toBe("search");
  });

  it("falls back to tool_N when function_call has no name", () => {
    const payload: TestPayload = {
      messages: [{ role: "assistant", function_call: { arguments: '{"a":1}' } }],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.name).toBe("tool_1");
    expect(call.function?.name).toBe("tool_1");
    expect(call.function?.arguments).toBe('{"a":1}');
  });

  it("synthesizes a placeholder call when function_call is null", () => {
    const payload: TestPayload = {
      messages: [{ role: "assistant", function_call: null }],
    };

    const [call] = callsOf(normalizeToolCallPayload(payload)) ?? [];

    expect(call.name).toBe("tool_1");
    expect(call.function?.arguments).toBe("{}");
  });
});

describe("plain messages", () => {
  it("passes messages without tool calls through unchanged", () => {
    const payload: TestPayload = {
      messages: [{ role: "user", content: "hello" }],
    };

    const result = normalizeToolCallPayload(payload);

    expect(result.messages?.[0]).toEqual({ role: "user", content: "hello" });
  });
});

describe("extractToolCallSummary", () => {
  it("formats as name(arguments)", () => {
    expect(
      extractToolCallSummary({
        function: { name: "get_weather", arguments: '{"city":"Paris"}' },
      }),
    ).toBe('get_weather({"city":"Paris"})');
  });

  it("prefers function.name over top-level name", () => {
    expect(
      extractToolCallSummary({
        name: "top",
        function: { name: "fn", arguments: "{}" },
      }),
    ).toBe("fn({})");
  });

  it("uses top-level name and arguments when function is absent", () => {
    expect(extractToolCallSummary({ name: "search", arguments: '{"q":"x"}' })).toBe(
      'search({"q":"x"})',
    );
  });

  it("defaults to tool({}) for unknown input", () => {
    expect(extractToolCallSummary(null)).toBe("tool({})");
    expect(extractToolCallSummary(undefined)).toBe("tool({})");
    expect(extractToolCallSummary({})).toBe("tool({})");
  });
});
