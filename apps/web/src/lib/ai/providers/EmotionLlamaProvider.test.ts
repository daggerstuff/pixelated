/* @vitest-environment node */
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emotionMetricsMock, explainabilityMock } = vi.hoisted(() => {
  const emotionMetricsMock = {
    analysisPerformed: vi.fn(),
    analysisLatency: vi.fn(),
  };
  const explainabilityMock = {
    getExplainabilityService: vi.fn(() => ({ enrich: (value: unknown) => value })),
  };
  return { emotionMetricsMock, explainabilityMock };
});

vi.mock("../../sentry/utils", () => ({ emotionMetrics: emotionMetricsMock }));
vi.mock("../explainability", () => ({
  getExplainabilityService: explainabilityMock.getExplainabilityService,
}));

import { EmotionLlamaProvider } from "./EmotionLlamaProvider";

describe("EmotionLlamaProvider FHE ciphertext hash", () => {
  const ciphertext = "cipher-abc-123";
  const fheService = {
    encrypt: vi.fn().mockResolvedValue(ciphertext),
    decrypt: vi.fn(async (value: unknown) => value),
  };

  const provider = new EmotionLlamaProvider(
    "https://example.com/",
    "test-key",
    fheService as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes deterministic sha256 of the ciphertext in the request payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        emotions: JSON.stringify([{ type: "joy", intensity: 0.8, confidence: 0.9 }]),
        dimensions: JSON.stringify({ valence: 0.5, arousal: 0.4, dominance: 0.6 }),
        confidence: 0.8,
        metadata: {},
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeEmotions("hello world");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/analyze/emotions");
    const body = JSON.parse((init as RequestInit).body as string);
    const expectedHash = createHash("sha256").update(JSON.stringify(ciphertext)).digest("hex");
    expect(body.text).toBe(ciphertext);
    expect(body.fhe_ciphertext_hash).toBe(expectedHash);
    expect(analysis.metadata?.modelVersion).toBe("llama-emotion-v1.0");

    vi.unstubAllGlobals();
  });

  it("does not send fhe_ciphertext_hash on the fallback path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "boom" });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeEmotions("hello world");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(analysis.metadata?.modelVersion).toBe("fallback-v1.0");
    vi.unstubAllGlobals();
  });
});
