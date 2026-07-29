/**
 * LatentSurfacer — transforms FishhookMatch[] into ReverieVector[]
 *
 * The second component of the Reverie Engine. Takes raw fishhook detections
 * and the source latent memories, then extracts emotional tone, derives
 * behavioral nudges, validation patterns, and relational patterns.
 *
 * CRITICAL: Never returns raw memory content. Only subconscious-level
 * behavioral modifiers. The output is a "reverie" — a subtle influence
 * on generation behavior, not an explicit memory retrieval.
 *
 * TS/Python parity: ai/memory/reverie/latent_surfacer.py
 */

import type { MemoryBlock } from "../../../types/memory";
import type {
  FishhookMatch,
  ReverieVector,
  ReverieConfig,
  ReveriePhase,
} from "../../../types/reverie";
import { DEFAULT_REVERIE_CONFIG } from "../../../types/reverie";

// ─── Behavioral Nudge Templates ──────────────────────────────────────
// Maps emotion categories to therapeutic behavioral guidance.
// These are NOT the memory content — they're derived directives that
// influence HOW the model responds, not WHAT it says explicitly.

const BEHAVIORAL_NUDGES: Record<string, string> = {
  anxiety: "acknowledge underlying anxiety without forcing resolution",
  grief: "hold space for grief; do not rush to fix or minimize",
  trauma: "trauma-informed pacing; prioritize felt safety before exploration",
  fear: "normalize fear as protective; ground in present-moment safety",
  anger: "validate anger; explore its protective function without judgment",
  despair: "assess for crisis indicators; validate the weight without dismissing",
  hopelessness: "counter hopelessness gently; anchor in small achievable steps",
  hope: "reinforce emerging hope; build on positive momentum without inflating",
  joy: "amplify joy authentically; connect to sustained meaning",
  sadness: "honor sadness as natural; resist the urge to cheer up prematurely",
  guilt: "distinguish healthy remorse from toxic guilt; explore repair actions",
  shame: "externalize shame; reduce self-attack through compassion framing",
  relief: "acknowledge relief; explore what shifted without assuming permanence",
  pride: "recognize earned pride; connect effort to outcome",
  confusion: "normalize confusion as part of integration; do not resolve prematurely",
  loneliness: "validate loneliness; explore connection patterns without prescribing",
  acceptance: "reinforce acceptance; link to behavioral congruence",
  love: "honor love in its complexity; avoid reducing to sentiment",
  trust: "recognize emerging trust; protect it through consistency",
  curiosity: "nurture curiosity; connect to self-directed exploration",
};

// ─── Validation Pattern Templates ─────────────────────────────────────
// Maps emotion categories to validation approaches. These tell the model
// HOW to validate the emotional experience, not what to say about it.

const VALIDATION_PATTERNS: Record<string, string> = {
  anxiety:
    "Anxiety is a valid response to perceived uncertainty; validate the felt sense of threat before exploring alternatives",
  grief:
    "Grief reflects the depth of attachment; validate the loss without offering closure narratives",
  trauma:
    "Trauma responses are adaptive survival mechanisms; validate the body's protective intelligence",
  fear: "Fear serves a protective function; validate the alert system before examining its accuracy",
  anger: "Anger often protects more vulnerable emotions beneath; validate the protective layer",
  despair:
    "Despair reflects accumulated weight; validate the burden without minimizing or catastrophizing",
  hopelessness:
    "Hopelessness signals cognitive exhaustion; validate the fatigue without confirming the conclusion",
  hope: "Hope emerging alongside difficulty is meaningful; validate without over-investing",
  joy: "Joy in context of struggle is resilience; validate without dismissing the hard parts",
  sadness:
    "Sadness is a natural response to loss or disappointment; validate without rushing repair",
  guilt: "Guilt can signal values in tension; validate the moral sensitivity",
  shame: "Shame thrives in isolation; validate through externalizing and contextualizing",
  relief: "Relief indicates shifting internal conditions; validate without assuming permanence",
  pride: "Pride in small steps builds self-efficacy; validate the process not just outcome",
  confusion: "Confusion often precedes integration; validate the discomfort of not-knowing",
  loneliness: "Loneliness signals unmet connection needs; validate without pathologizing",
  acceptance: "Acceptance is not passivity; validate the active process of reckoning",
  love: "Love coexists with difficulty; validate without romanticizing or minimizing",
  trust: "Trust-building is gradual; validate the vulnerability involved",
  curiosity: "Curiosity is self-directed healing; validate the inner drive toward growth",
};

// ─── Default fallbacks ────────────────────────────────────────────────

const DEFAULT_NUDGE = "respond with heightened emotional attunement; let the conversation breathe";
const DEFAULT_VALIDATION = "validate the emotional experience without assuming its cause";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a unique reverie ID. Uses timestamp + random for uniqueness.
 */
function generateReverieId(sourceMemoryId: string, timestamp: number): string {
  const hash = sourceMemoryId.split("").reduce((h, c) => {
    return ((h << 5) - h + c.charCodeAt(0)) | 0;
  }, 0);
  return `rev_${Math.abs(hash).toString(36)}_${timestamp.toString(36)}`;
}

/**
 * Derive behavioral nudge from emotion categories.
 * Combines top 2 categories' nudges, weighted by resonance.
 */
function deriveBehavioralNudge(categories: string[], resonanceScore: number): string {
  if (categories.length === 0) return DEFAULT_NUDGE;

  const sorted = [...categories].slice(0, 2);
  const nudges = sorted.map((cat) => BEHAVIORAL_NUDGES[cat]).filter(Boolean);

  if (nudges.length === 0) return DEFAULT_NUDGE;
  if (nudges.length === 1) return nudges[0];

  // Strong resonance → more directive nudge; weak → softer
  if (resonanceScore > 0.6) {
    return `${nudges[0]}; ${nudges[1]}`;
  }
  return `gently ${nudges[0]}`;
}

/**
 * Derive validation pattern from emotion categories.
 */
function deriveValidationPattern(categories: string[]): string {
  if (categories.length === 0) return DEFAULT_VALIDATION;

  const patterns = categories
    .slice(0, 2)
    .map((cat) => VALIDATION_PATTERNS[cat])
    .filter(Boolean);

  if (patterns.length === 0) return DEFAULT_VALIDATION;
  return patterns[0]; // Primary emotion drives validation
}

/**
 * Derive relational pattern from schema references.
 * If the memory has schema references, indicate recurring thematic patterns.
 */
function deriveRelationalPattern(schemaReferences: string[], categories: string[]): string | null {
  if (schemaReferences.length === 0) return null;

  const theme = categories.length > 0 ? categories[0] : "emotional";
  const schemaCount = schemaReferences.length;

  if (schemaCount >= 3) {
    return `themes of ${theme} recur across multiple consolidated schemas; likely a core pattern`;
  }
  if (schemaCount >= 1) {
    return `emerging ${theme} pattern detected in consolidation; monitor for recurrence`;
  }
  return null;
}

/**
 * Determine initial reverie phase based on resonance score.
 */
function determineInitialPhase(resonanceScore: number): ReveriePhase {
  if (resonanceScore > 0.7) return "active";
  if (resonanceScore > 0.5) return "surfacing";
  return "seeded";
}

// ─── LatentSurfacer ───────────────────────────────────────────────────

export class LatentSurfacer {
  private config: ReverieConfig;

  constructor(config: ReverieConfig = DEFAULT_REVERIE_CONFIG) {
    this.config = config;
  }

  /**
   * Transform fishhook matches into reverie vectors.
   *
   * @param matches - Fishhook detections from FishhookDetector
   * @param latentPool - The full latent memory pool (to look up source memories)
   * @returns ReverieVector[] — new reverie vectors, sorted by resonanceScore desc
   *
   * CRITICAL: No raw memory content appears in the output. Only derived
   * behavioral modifiers, emotional tone, and validation patterns.
   */
  surface(matches: FishhookMatch[], latentPool: MemoryBlock[]): ReverieVector[] {
    if (matches.length === 0) return [];

    // Index latent pool for quick lookup
    const memoryMap = new Map<string, MemoryBlock>();
    for (const mem of latentPool) {
      memoryMap.set(mem.id, mem);
    }

    const reveries: ReverieVector[] = [];

    for (const match of matches) {
      const sourceMemory = memoryMap.get(match.latentMemoryId);
      if (!sourceMemory) continue;

      // Skip if not reverie-eligible (safety check)
      if (!sourceMemory.consolidation.reverieEligible) continue;

      // Skip crisis memories from reverie surfacing — too delicate
      if (sourceMemory.gating.crisisFlag) continue;

      const emotions = sourceMemory.emotions;
      const categories = emotions.categories;
      const resonance = match.resonanceScore;

      const reverieVector: ReverieVector = {
        id: generateReverieId(match.latentMemoryId, match.timestamp),
        sourceMemoryId: match.latentMemoryId,
        resonanceScore: resonance,
        emotionalTone: {
          valence: emotions.valence,
          arousal: emotions.arousal,
          categories: [...categories], // Copy, not reference
        },
        behavioralNudge: deriveBehavioralNudge(categories, resonance),
        validationPattern: deriveValidationPattern(categories),
        relationalPattern: deriveRelationalPattern(
          sourceMemory.consolidation.schemaReferences,
          categories,
        ),
        phase: determineInitialPhase(resonance),
        createdAt: match.timestamp,
        lastTriggeredAt: match.timestamp,
        triggerCount: 1,
        decayHalfLife: this.config.decayHalfLifeMessages,
      };

      reveries.push(reverieVector);
    }

    // Sort by resonance score descending — highest resonance first
    reveries.sort((a, b) => b.resonanceScore - a.resonanceScore);

    // Respect max active reveries limit
    const maxActive = this.config.maxActiveReveries;
    if (reveries.length > maxActive) {
      // Keep top N, downgrade the rest to 'dormant'
      for (let i = maxActive; i < reveries.length; i++) {
        reveries[i].phase = "dormant";
      }
    }

    return reveries;
  }

  /**
   * Update an existing reverie vector when re-triggered.
   * Increments trigger count, updates last triggered, recalculates phase.
   */
  retrigger(reverie: ReverieVector, newResonance: number, timestamp: number): ReverieVector {
    const triggerCount = reverie.triggerCount + 1;
    // Blend resonance — new detection weighted with existing
    const blendedResonance = reverie.resonanceScore * 0.4 + newResonance * 0.6;

    let phase: ReveriePhase;
    if (blendedResonance > 0.7) phase = "active";
    else if (blendedResonance > 0.5) phase = "surfacing";
    else if (blendedResonance > this.config.fadingThreshold) phase = "seeded";
    else phase = "fading";

    return {
      ...reverie,
      resonanceScore: blendedResonance,
      lastTriggeredAt: timestamp,
      triggerCount,
      phase,
    };
  }

  /**
   * Apply decay to a reverie vector based on messages elapsed since last trigger.
   *
   * @param reverie - The reverie to decay
   * @param messagesSinceTrigger - Number of messages since last trigger
   * @returns Updated reverie with decayed resonance and possibly new phase
   */
  decay(reverie: ReverieVector, messagesSinceTrigger: number): ReverieVector {
    if (messagesSinceTrigger <= 0) return reverie;

    // Exponential decay: resonance *= 2^(-elapsed/halflife)
    const decayFactor = Math.pow(0.5, messagesSinceTrigger / reverie.decayHalfLife);
    const decayedResonance = reverie.resonanceScore * decayFactor;

    let phase: ReveriePhase;
    if (decayedResonance <= this.config.fadingThreshold) {
      phase = "fading";
    } else if (decayedResonance > 0.7) {
      phase = "active";
    } else if (decayedResonance > 0.5) {
      phase = "surfacing";
    } else {
      phase = "seeded";
    }

    return {
      ...reverie,
      resonanceScore: decayedResonance,
      phase,
    };
  }

  /**
   * Check if a reverie should be pruned (fully faded).
   */
  isFaded(reverie: ReverieVector): boolean {
    return reverie.phase === "fading" && reverie.resonanceScore < this.config.fadingThreshold;
  }
}
