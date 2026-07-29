/**
 * Reverie Engine Types
 *
 * Inspired by Westworld's "reveries" — Arnold Weber's mechanism where latent
 * memories from purged narrative loops surface as subconscious gestures that
 * influence behavior without conscious awareness.
 *
 * In the memory system, reveries allow archived/latent memories to subtly
 * influence LLM behavior through system-level behavioral modifiers, without
 * being explicitly retrieved into the context window.
 *
 * TS/Python parity: ai/memory/reverie_types.py mirrors this file.
 */

// ─── Reverie Phase ──────────────────────────────────────────────────────
// Tracks where a memory sits in the reverie lifecycle.
// dormant: not yet eligible for reveries
// seeded: flagged as reverie-eligible, waiting in latent pool
// surfacing: fishhook detected, reverie vector being formed
// active: reverie vector injected as behavioral modifier
// fading: resonance decaying, soon to return to dormant/seeded

export type ReveriePhase = "dormant" | "seeded" | "surfacing" | "active" | "fading";

// ─── Fishhook Match ─────────────────────────────────────────────────────
// A trigger that resonates between current context and a latent memory.
// "Fishhooks" pull from the deep sea of consciousness — subtle cues that
// access memories that were supposed to be purged.

export type FishhookMatchType = "lexical" | "emotional" | "pattern" | "surprise";

export interface FishhookMatch {
  /** The latent memory that was hooked */
  latentMemoryId: string;
  /** The current context/memory that triggered the hook */
  triggerMemoryId: string;
  /** What kind of resonance triggered the match */
  matchType: FishhookMatchType;
  /** [0,1] — how strongly this fishhook resonates */
  resonanceScore: number;
  /** Which features contributed to the match */
  matchedFeatures: string[];
  /** When the fishhook was detected */
  timestamp: number;
}

// ─── Reverie Vector ─────────────────────────────────────────────────────
// A subconscious influence derived from a latent memory. Does NOT contain
// raw memory content — only emotional tone and behavioral patterns.
// This is the "reverie" itself: a subtle gesture that influences behavior.

export interface ReverieVector {
  /** Unique reverie ID */
  id: string;
  /** The latent memory this reverie was derived from */
  sourceMemoryId: string;
  /** [0,1] — overall resonance strength */
  resonanceScore: number;
  /** Emotional tone extracted from the source memory */
  emotionalTone: {
    valence: number; // -1..1
    arousal: number; // 0..1
    categories: string[];
  };
  /** Behavioral suggestion for the LLM (e.g., "lean toward validation") */
  behavioralNudge: string;
  /** Validation pattern (e.g., "acknowledge loss without fixing") */
  validationPattern: string;
  /** Relational pattern if detected (e.g., "trust echoes early sessions") */
  relationalPattern: string | null;
  /** Current phase in the reverie lifecycle */
  phase: ReveriePhase;
  /** When this reverie was created */
  createdAt: number;
  /** When it was last triggered by a fishhook */
  lastTriggeredAt: number;
  /** How many times fishhooks have re-triggered this reverie */
  triggerCount: number;
  /** Decay half-life in messages (resonance halves every N messages) */
  decayHalfLife: number;
}

// ─── Reverie Config ─────────────────────────────────────────────────────

export interface ReverieConfig {
  /** Minimum TF-IDF cosine similarity for lexical fishhooks (default 0.3) */
  fishhookThreshold: number;
  /** Weight for emotional resonance in composite score (default 0.3) */
  emotionalResonanceWeight: number;
  /** Weight for lexical resonance in composite score (default 0.25) */
  lexicalResonanceWeight: number;
  /** Weight for pattern resonance in composite score (default 0.25) */
  patternResonanceWeight: number;
  /** Weight for surprise resonance in composite score (default 0.2) */
  surpriseResonanceWeight: number;
  /** Maximum simultaneously active reveries (default 3) */
  maxActiveReveries: number;
  /** Resonance decay half-life in messages (default 10) */
  decayHalfLifeMessages: number;
  /** Run fishhook detection every N messages (default 5) */
  triggerInterval: number;
  /** Minimum importance for a memory to enter the latent pool (default 0.1) */
  latentPoolMinImportance: number;
  /** Minimum emotional weight for reverie eligibility (default 2.0) */
  reverieEligibleMinEmotionalWeight: number;
  /** Resonance below which a reverie is removed (default 0.05) */
  fadingThreshold: number;
}

export const DEFAULT_REVERIE_CONFIG: ReverieConfig = {
  fishhookThreshold: 0.3,
  emotionalResonanceWeight: 0.3,
  lexicalResonanceWeight: 0.25,
  patternResonanceWeight: 0.25,
  surpriseResonanceWeight: 0.2,
  maxActiveReveries: 3,
  decayHalfLifeMessages: 10,
  triggerInterval: 5,
  latentPoolMinImportance: 0.1,
  reverieEligibleMinEmotionalWeight: 2.0,
  fadingThreshold: 0.05,
};

// ─── Reverie Result ─────────────────────────────────────────────────────

export interface ReverieResult {
  /** Fishhooks detected this cycle */
  fishhooks: FishhookMatch[];
  /** New reverie vectors created */
  newReveries: ReverieVector[];
  /** All currently active reveries (after injection + decay) */
  activeReveries: ReverieVector[];
  /** System-level behavioral modifier prompt (inject at system level) */
  reveriePrompt: string;
  /** Whether any reveries changed this cycle */
  changed: boolean;
  /** Elapsed processing time in ms */
  elapsedMs: number;
}

// ─── Reverie Seeds (from REM Dream) ────────────────────────────────────

export interface ReverieSeed {
  /** Memory ID seeded into latent pool */
  memoryId: string;
  /** Why it was selected for reverie seeding */
  reason: string;
  /** Reverie potential score [0,1] */
  potential: number;
}

export interface ReverieSeedResult {
  /** Memories transitioned to latent phase */
  seeds: ReverieSeed[];
  /** Memories that were already latent */
  alreadyLatent: string[];
  /** Total latent pool size after seeding */
  latentPoolSize: number;
  /** Elapsed ms */
  elapsedMs: number;
}
