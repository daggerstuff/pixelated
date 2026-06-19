import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Specialist sub-agent for emotion signal analysis on the latest turn of a " +
    "rehearsal session. Emits a compact, structured emotion signal (label, " +
    "intensity, valence, risk flags) that the parent agent attaches to its reply " +
    "before the tool writes the turn to Foresight. Use this whenever the trainee's " +
    "or participant's most recent turn has not yet been analyzed.",
  model: "anthropic/claude-opus-4.8",
  outputSchema: z.object({
    primary_emotion: z.string(),
    intensity: z.number().min(0).max(1),
    valence: z.number().min(-1).max(1),
    risk_flags: z.array(
      z.enum([
        "crisis_ideation",
        "harm_to_others",
        "medical_emergency",
        "distress",
      ]),
    ),
    confidence: z.number().min(0).max(1),
    evidence_span: z.string().max(280),
  }),
});
