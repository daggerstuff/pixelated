/**
 * analyze_pace — pacing analysis for the session-agent.
 *
 * Analyzes recent turn history for conversational rhythm patterns using
 * Workers AI (@cf/meta/llama-3.2-3b-instruct). Runs sub-second and
 * returns a structured pacing signal the agent can attach to persistent_notes.
 *
 * Exported at two levels:
 *   - `analyzePace()` — direct async function, importable by other tools
 *   - `defineTool()`  — Eve tool definition for the parent agent to call
 *
 * Falls back to empty result when Workers AI credentials are missing.
 */

import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "./workers-ai.js";

export interface PaceSignal {
  stuck: boolean;
  pattern: "reflection_loop" | "topic_avoidance" | "rapid_fire" | "normal";
  consecutive_same_technique: number;
  suggestion: string;
  conversation_flow: string;
}

interface TurnInput {
  role: "trainee" | "participant" | "supervisor";
  text: string;
  timestamp?: string;
}

interface PaceInput {
  session_id: string;
  recent_turns: TurnInput[];
  session_duration_minutes: number;
}

export interface PaceResult {
  session_id: string;
  analyzed_at: string;
  stuck: boolean;
  pattern: PaceSignal["pattern"];
  consecutive_same_technique: number;
  suggestion: string;
  conversation_flow: string;
  model: string;
}

/** Direct async pace analysis, importable by other tools. */
export async function analyzePace(input: PaceInput): Promise<PaceResult | null> {
  const model = getModel();
  if (!model) return null;

  const turnsText = input.recent_turns
    .map((t) => `[${t.role}] ${t.text}`)
    .join("\n---\n");

  const prompt =
    `You are a clinical training supervisor monitoring a therapy rehearsal session.\n` +
    `The session has been running for ${Math.round(input.session_duration_minutes)} minutes.\n\n` +
    `Analyze the conversational rhythm of these recent turns. Determine if the trainee ` +
    `is stuck in a technique loop, avoiding topics, rushing, or progressing normally.\n\n` +
    `Return ONLY valid JSON with NO markdown fences, NO extra text:\n` +
    `{"stuck":true/false,"pattern":"reflection_loop|topic_avoidance|rapid_fire|normal",` +
    `"consecutive_same_technique":0,"suggestion":"max 160 chars","conversation_flow":"max 200 chars"}\n\n` +
    `RECENT TURNS:\n"""\n${turnsText}\n"""`;

  const { text } = await generateText({ model, prompt });
  const parsed = parsePaceJson(text);

  return {
    session_id: input.session_id,
    analyzed_at: new Date().toISOString(),
    ...parsed,
    model: "@cf/meta/llama-3.2-3b-instruct",
  };
}

function parsePaceJson(raw: string): Omit<PaceResult, "session_id" | "analyzed_at" | "model"> {
  try {
    const cleaned = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0];
    const parsed = JSON.parse(cleaned);
    const patterns = ["reflection_loop", "topic_avoidance", "rapid_fire", "normal"] as const;
    return {
      stuck: typeof parsed.stuck === "boolean" ? parsed.stuck : false,
      pattern: (patterns as readonly string[]).includes(parsed.pattern)
        ? (parsed.pattern as PaceResult["pattern"])
        : "normal",
      consecutive_same_technique:
        typeof parsed.consecutive_same_technique === "number"
          ? Math.max(0, parsed.consecutive_same_technique)
          : 0,
      suggestion: String(parsed.suggestion ?? "").slice(0, 160),
      conversation_flow: String(parsed.conversation_flow ?? "").slice(0, 200),
    };
  } catch {
    return emptyPace();
  }
}

function emptyPace() {
  return {
    stuck: false,
    pattern: "normal" as const,
    consecutive_same_technique: 0,
    suggestion: "",
    conversation_flow: "",
  };
}

function emptyResult(sessionId: string): PaceResult {
  return {
    session_id: sessionId,
    analyzed_at: new Date().toISOString(),
    ...emptyPace(),
    model: "none",
  };
}

// ── Eve tool definition ─────────────────────────────────────────────

const PaceTurnSchema = z.object({
  role: z.enum(["trainee", "participant", "supervisor"]),
  text: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  recent_turns: z.array(PaceTurnSchema).min(3).max(10),
  session_duration_minutes: z.number().min(0).max(120),
});

export default defineTool({
  description:
    "Analyze trainee conversational rhythm for pacing patterns using " +
    "Workers AI. Returns a structured signal (stuck, pattern type, " +
    "suggestion, conversation flow summary). The agent should attach " +
    "non-trivial suggestions to persistent_notes for longitudinal tracking. " +
    "Call this after generating the reply -- the result is supervisory " +
    "metadata that does not gate the response.",
  inputSchema: SCHEMA,
  async execute(input) {
    const result = await analyzePace(input);
    if (!result) {
      return {
        session_id: input.session_id,
        analyzed_at: new Date().toISOString(),
        stuck: false,
        pattern: "normal" as const,
        consecutive_same_technique: 0,
        suggestion: "",
        conversation_flow: "",
        model: "none",
      };
    }
    return result satisfies PaceResult;
  },
});
