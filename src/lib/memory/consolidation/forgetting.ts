// Forgetting Mechanisms — Sprint 3, Task 4 (TypeScript mirror)
import { MemoryBlock } from "../../../types/memory";

export enum ForgetAction {
  PRESERVE = "preserve",
  ARCHIVE = "archive",
  DELETE = "delete",
  LATENT = "latent",
}

export interface ForgetDecision {
  memoryId: string;
  action: ForgetAction;
  reason: string;
  retentionScore: number;
}

export interface ForgettingConfig {
  halfLifeDays: number;
  archiveThreshold: number;
  deleteThreshold: number;
  crisisPreserve: boolean;
  minRemCycles: number;
  reverieEligibleMinEmotionalWeight: number;
}

const DEFAULT_CONFIG: ForgettingConfig = {
  halfLifeDays: 30,
  archiveThreshold: 0.15,
  deleteThreshold: 0.05,
  crisisPreserve: true,
  minRemCycles: 1,
  reverieEligibleMinEmotionalWeight: 2.0,
};

export class ForgettingEngine {
  private readonly config: ForgettingConfig;

  constructor(config?: Partial<ForgettingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(memory: MemoryBlock, nowMs?: number): ForgetDecision {
    if (memory.gating.crisisFlag && this.config.crisisPreserve) {
      return {
        memoryId: memory.id,
        action: ForgetAction.PRESERVE,
        reason: "Crisis content — preserved indefinitely",
        retentionScore: 1.0,
      };
    }

    if (memory.consolidation.remCycles > this.config.minRemCycles) {
      return {
        memoryId: memory.id,
        action: ForgetAction.PRESERVE,
        reason: `REM cycles remaining (${memory.consolidation.remCycles})`,
        retentionScore: 0.8,
      };
    }

    const retention = this.retentionScore(memory, nowMs);

    if (retention >= this.config.archiveThreshold) {
      return {
        memoryId: memory.id,
        action: ForgetAction.PRESERVE,
        reason: `Retention score ${retention.toFixed(3)} above archive threshold`,
        retentionScore: retention,
      };
    }

    // Check LATENT before ARCHIVE — emotionally significant memories in the
    // archive zone (deleteThreshold <= retention < archiveThreshold) should
    // become reverie candidates, not archived.
    if (
      retention >= this.config.deleteThreshold &&
      memory.importance.emotionalWeight >= this.config.reverieEligibleMinEmotionalWeight &&
      !memory.gating.crisisFlag
    ) {
      return {
        memoryId: memory.id,
        action: ForgetAction.LATENT,
        reason: `Retention ${retention.toFixed(3)} — reverie candidate (emotional weight ${memory.importance.emotionalWeight})`,
        retentionScore: retention,
      };
    }

    if (retention >= this.config.deleteThreshold) {
      return {
        memoryId: memory.id,
        action: ForgetAction.ARCHIVE,
        reason: `Retention score ${retention.toFixed(3)} — archive candidate`,
        retentionScore: retention,
      };
    }

    return {
      memoryId: memory.id,
      action: ForgetAction.DELETE,
      reason: `Retention score ${retention.toFixed(3)} — pruning candidate`,
      retentionScore: retention,
    };
  }

  batchEvaluate(memories: MemoryBlock[], nowMs?: number): ForgetDecision[] {
    return memories.map((m) => this.evaluate(m, nowMs));
  }

  getPruningCandidates(memories: MemoryBlock[], nowMs?: number): [MemoryBlock, ForgetDecision][] {
    const decisions = this.batchEvaluate(memories, nowMs);
    const candidates = memories
      .map((m, i) => [m, decisions[i]] as [MemoryBlock, ForgetDecision])
      .filter(
        ([, d]) =>
          d.action === ForgetAction.ARCHIVE ||
          d.action === ForgetAction.DELETE ||
          d.action === ForgetAction.LATENT,
      );
    candidates.sort((a, b) => a[1].retentionScore - b[1].retentionScore);
    return candidates;
  }

  applyForgetting(memory: MemoryBlock, nowMs?: number): MemoryBlock {
    const retention = this.retentionScore(memory, nowMs);
    const decision = this.evaluate(memory, nowMs);

    if (decision.action === ForgetAction.LATENT) {
      return {
        ...memory,
        importance: {
          ...memory.importance,
          recency: Math.max(memory.importance.recency * retention, 0),
          raw: Math.max(memory.importance.raw * retention, 0),
        },
        consolidation: {
          ...memory.consolidation,
          phase: "latent",
          reverieEligible: true,
          reveriePhase: "seeded",
        },
      };
    }

    return {
      ...memory,
      importance: {
        ...memory.importance,
        recency: Math.max(memory.importance.recency * retention, 0),
        raw: Math.max(memory.importance.raw * retention, 0),
      },
    };
  }

  private retentionScore(memory: MemoryBlock, nowMs?: number): number {
    const now = nowMs ?? Date.now();
    const ageMs = Math.max(now - memory.timestamp, 0);
    const ageDays = ageMs / (1000 * 86400);

    const ebbinghaus = Math.exp((-Math.log(2) * ageDays) / this.config.halfLifeDays);
    const importanceFactor = memory.importance.raw;
    const emotionalBoost = memory.importance.emotionalWeight / 5.0;
    const crisisBoost = memory.gating.crisisFlag ? 1.0 : 0.0;

    const retention =
      0.4 * ebbinghaus + 0.3 * importanceFactor + 0.2 * emotionalBoost + 0.1 * crisisBoost;

    return Math.min(Math.max(retention, 0), 1);
  }
}
