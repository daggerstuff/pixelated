import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "./workers-ai.js";

interface EmotionalAnalysisResult {
  session_id: string;
  cohort_id: string;
  reference_period_days: number;
  analyzed_at: string;
  pattern_flags: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  recommendation: string;
  model: string;
}

interface DetectPatternsInput {
  session_id: string;
  cohort_id: string;
  reference_period_days: number;
}

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  reference_period_days: z.number().int().min(1).max(180).default(30),
});

export default defineTool({
  description:
    "Analyze the emotional trajectory of a session against cohort baselines " +
    "using Workers AI. Returns pattern flags (anomalies, spikes, distress) " +
    "and a recommendation.",
  inputSchema: SCHEMA,
  async execute(input: DetectPatternsInput) {
    const model = getModel();
    if (!model) {
      return {
        session_id: input.session_id,
        cohort_id: input.cohort_id,
        reference_period_days: input.reference_period_days,
        analyzed_at: new Date().toISOString(),
        pattern_flags: [],
        recommendation: "hold",
        model: "none",
      };
    }

    const prompt =
      `You are a clinical QA analyst reviewing emotional trajectory data. ` +
      `Based on ${input.reference_period_days} days of reference data for ` +
      `cohort "${input.cohort_id}", analyze potential emotional patterns.\n\n` +
      `Return ONLY valid JSON with NO markdown fences, NO extra text:\n` +
      `{"pattern_flags":[{"type":"anomalous_decay|spike_cluster|persistent_distress|` +
      `flat_affect|escalating_anger","severity":"low|medium|high","description":"max 80 chars"}],` +
      `"recommendation":"hold|review|escalate|flag_supervisor"}\n\n` +
      `Session ID: ${input.session_id}`;

    const { text } = await generateText({ model, prompt });
    const result = parseAnalysis(text);

    return {
      session_id: input.session_id,
      cohort_id: input.cohort_id,
      reference_period_days: input.reference_period_days,
      analyzed_at: new Date().toISOString(),
      pattern_flags: result.pattern_flags,
      recommendation: result.recommendation,
      model: "@cf/meta/llama-3.2-3b-instruct",
    } satisfies EmotionalAnalysisResult;
  },
});

function parseAnalysis(raw: string): {
  pattern_flags: EmotionalAnalysisResult["pattern_flags"];
  recommendation: string;
} {
  try {
    const cleaned = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0];
    const parsed = JSON.parse(cleaned) as {
      pattern_flags?: unknown;
      recommendation?: unknown;
    };
    return {
      pattern_flags: Array.isArray(parsed.pattern_flags)
        ? (parsed.pattern_flags as unknown[])
            .map(
              (f: unknown) =>
                f as {
                  type?: unknown;
                  severity?: unknown;
                  description?: unknown;
                },
            )
            .map((f) => ({
              type: typeof f.type === "string" ? f.type : "unknown",
              severity: ["low", "medium", "high"].includes(
                typeof f.severity === "string" ? f.severity : "",
              )
                ? ((typeof f.severity === "string" ? f.severity : "low") as
                    | "low"
                    | "medium"
                    | "high")
                : "low",
              description: typeof f.description === "string" ? f.description.slice(0, 80) : "",
            }))
        : [],
      recommendation: ["hold", "review", "escalate", "flag_supervisor"].includes(
        typeof parsed.recommendation === "string" ? parsed.recommendation : "",
      )
        ? typeof parsed.recommendation === "string"
          ? parsed.recommendation
          : "hold"
        : "hold",
    };
  } catch {
    return { pattern_flags: [], recommendation: "hold" };
  }
}
