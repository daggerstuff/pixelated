import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "./workers-ai.js";
import { analyzePace, type PaceSignal } from "./analyze_pace.js";

interface EmotionSignal {
  primary_emotion: string;
  intensity: number;
  valence: number;
  risk_flags: string[];
  confidence: number;
  evidence_span: string;
}

interface AnalyzeEmotionResult {
  session_id: string;
  emotion: EmotionSignal;
  pace?: PaceSignal;
  persistent_note?: string;
  analyzer: string;
  evaluated_at: string;
  model: string;
}

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  turn_text: z.string().min(1),
  previous_turn_text: z.string().optional(),
  recent_turns: z
    .array(
      z.object({
        role: z.enum(["trainee", "participant", "supervisor"]),
        text: z.string().min(1),
        timestamp: z.string().datetime().optional(),
      }),
    )
    .min(3)
    .max(10)
    .optional(),
  session_duration_minutes: z.number().min(0).max(120).optional(),
});

export default defineTool({
  description:
    "Produce a structured emotion signal for the most recent turn by " +
    "calling Workers AI (@cf/meta/llama-3.2-3b-instruct). Returns a " +
    "structured emotion label, intensity, valence, and risk flags. " +
    "When recent_turns is provided, also runs a parallel pace analysis " +
    "and attaches pacing observations as a persistent_note. " +
    "Falls back to neutral stub when Workers AI credentials are missing.",
  inputSchema: SCHEMA,
  async execute(input) {
    const model = getModel();

    const [emotion, pace] = await Promise.all([
      model ? analyzeEmotion(input, model) : Promise.resolve(fallbackEmotion()),
      input.recent_turns
        ? analyzePace({
            session_id: input.session_id,
            recent_turns: input.recent_turns,
            session_duration_minutes: input.session_duration_minutes ?? 10,
          })
        : Promise.resolve(null),
    ]);

    const result: AnalyzeEmotionResult = {
      session_id: input.session_id,
      emotion,
      pace: pace?.stuck ? pace : undefined,
      analyzer: model
        ? "session-agent.tools.analyze_emotion:workers-ai:v1"
        : "session-agent.tools.analyze_emotion:fallback:v1",
      evaluated_at: new Date().toISOString(),
      model: model ? "@cf/meta/llama-3.2-3b-instruct" : "none",
    };

    if (pace?.suggestion) {
      result.persistent_note = `[pace] ${pace.suggestion}`;
    }

    return result satisfies AnalyzeEmotionResult;
  },
});

// ── Direct call, importable by other tools ──────────────────────────

async function analyzeEmotion(
  input: z.infer<typeof SCHEMA>,
  model: NonNullable<ReturnType<typeof getModel>>,
): Promise<EmotionSignal> {
  const ctx = input.previous_turn_text ? `Previous turn: "${input.previous_turn_text}"\n\n` : "";

  const prompt =
    `${ctx}Analyze the emotional content of the text below. ` +
    `Return ONLY valid JSON with NO markdown fences, NO extra text:\n` +
    `{"primary_emotion":"string","intensity":0.0-1.0,"valence":-1.0-1.0,` +
    `"risk_flags":["distress","crisis_ideation","harm_to_others","medical_emergency"],` +
    `"confidence":0.0-1.0,"evidence_span":"short excerpt"}\n\n` +
    `TEXT:\n"""\n${input.turn_text}\n"""`;

  const { text } = await generateText({ model, prompt });
  return parseEmotionJson(text);
}

// ── Fallback ─────────────────────────────────────────────────────────

function fallbackEmotion(): EmotionSignal {
  return {
    primary_emotion: "neutral",
    intensity: 0,
    valence: 0,
    risk_flags: [],
    confidence: 0,
    evidence_span: "",
  };
}

// ── Parsing helpers ──────────────────────────────────────────────────

function parseEmotionJson(raw: string): EmotionSignal {
  try {
    const cleaned = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0];
    const parsed = JSON.parse(cleaned);
    return {
      primary_emotion: parsed.primary_emotion ?? "neutral",
      intensity: clamp(parsed.intensity, 0, 1),
      valence: clamp(parsed.valence, -1, 1),
      risk_flags: normalizedRiskFlags(parsed.risk_flags),
      confidence: clamp(parsed.confidence, 0, 1),
      evidence_span: String(parsed.evidence_span ?? "").slice(0, 120),
    };
  } catch {
    return fallbackEmotion();
  }
}

function normalizedRiskFlags(
  flags: unknown,
): Array<"distress" | "crisis_ideation" | "harm_to_others" | "medical_emergency"> {
  const valid = new Set(["distress", "crisis_ideation", "harm_to_others", "medical_emergency"]);
  if (!Array.isArray(flags)) return [];
  return flags.filter(
    (f): f is "distress" | "crisis_ideation" | "harm_to_others" | "medical_emergency" =>
      typeof f === "string" && valid.has(f),
  );
}

function clamp(n: unknown, min: number, max: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}
