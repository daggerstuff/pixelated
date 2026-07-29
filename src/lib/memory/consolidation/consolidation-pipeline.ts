/**
 * ConsolidationPipeline — orchestrator for memory dedup + REM dreaming + forgetting.
 *
 * Coordinates the full Sprint 3 consolidation pipeline at the ProductMemoryGateway
 * level, working directly with UnifiedMemory / ProductMemoryRecord types.
 *
 * Pipeline phases:
 *   1. FETCH → load all eligible memories for the user via gateway
 *   2. DEDUP  → TF-IDF cosine similarity on content, merge near-duplicates
 *   3. DREAM  → REM-style cross-linking and schema extraction
 *   4. FORGET → Ebbinghaus decay evaluation → archive/prune candidates
 *   5. APPLY  → persist changes back through the gateway
 */

import type { UnifiedMemory } from "@pixelated/memory-schema";

import type { ProductMemoryGateway } from "@/lib/services/product-memory-gateway";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DedupCluster {
  clusterId: string;
  members: UnifiedMemory[];
  representative: UnifiedMemory;
  similarityScores: number[];
}

export interface CrossLink {
  memoryAId: string;
  memoryBId: string;
  similarity: number;
  linkType: "semantic_similarity" | "emotional_co_occurrence";
}

export interface SchemaPattern {
  schemaId: string;
  title: string;
  generalization: string;
  sourceMemoryIds: string[];
  confidence: number;
}

export interface ConsolidationReport {
  mergedIds: string[];
  archivedIds: string[];
  deletedIds: string[];
  latentIds: string[];
  crossLinks: CrossLink[];
  schemas: SchemaPattern[];
  totalBefore: number;
  totalAfterDedup: number;
  totalAfterForgetting: number;
  elapsedMs: number;
}

export interface ConsolidationConfig {
  dedupThreshold: number;
  crosslinkThreshold: number;
  forgettingHalfLifeDays: number;
  archiveThreshold: number;
  deleteThreshold: number;
  maxMemoriesPerRun: number;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  dedupThreshold: 0.92,
  crosslinkThreshold: 0.7,
  forgettingHalfLifeDays: 30,
  archiveThreshold: 0.15,
  deleteThreshold: 0.05,
  maxMemoriesPerRun: 1000,
};

// ---------------------------------------------------------------------------
// TF-IDF helpers (pure, no external deps)
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function buildIdf(memories: UnifiedMemory[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const m of memories) {
    const terms = new Set(tokenize(m.content));
    for (const t of terms) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }
  const n = memories.length;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
  }
  return idf;
}

function tfidfVector(text: string, idf: Map<string, number>): Map<string, number> {
  const terms = tokenize(text);
  if (terms.length === 0) return new Map();
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const maxTf = Math.max(...tf.values());
  const vec = new Map<string, number>();
  for (const [t, count] of tf) {
    vec.set(t, (count / maxTf) * (idf.get(t) ?? 1.0));
  }
  return vec;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (const [t, v] of a) {
    normA += v * v;
    if (b.has(t)) dot += v * b.get(t)!;
  }
  for (const [, v] of b) normB += v * v;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function retentionScore(memory: UnifiedMemory, halfLifeDays: number, nowMs: number): number {
  const createdAt = new Date(memory.createdAt).getTime();
  if (isNaN(createdAt)) return 1;
  const ageMs = Math.max(nowMs - createdAt, 0);
  const ageDays = ageMs / (1000 * 86400);
  const ebbinghaus = Math.exp((-Math.log(2) * ageDays) / halfLifeDays);
  // Blend: 60% Ebbinghaus + 40% importance
  return 0.6 * ebbinghaus + 0.4 * memory.importance;
}

// ---------------------------------------------------------------------------
// ConsolidationPipeline
// ---------------------------------------------------------------------------

export class ConsolidationPipeline {
  private readonly config: ConsolidationConfig;

  constructor(config?: Partial<ConsolidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run the full consolidation pipeline for a user.
   *
   * 1. Fetch all memories via the gateway
   * 2. Run TF-IDF dedup → merge near-duplicates
   * 3. Run REM dreaming → cross-link and extract schemas
   * 4. Run forgetting → mark archive/prune candidates
   * 5. Apply changes back through the gateway
   */
  async run(gateway: ProductMemoryGateway, userId: string): Promise<ConsolidationReport> {
    const t0 = performance.now();

    // ── Phase 1: Fetch ──────────────────────────────────────────────────
    const allMemories = await this.fetchAllMemories(gateway, userId);
    const totalBefore = allMemories.length;

    // ── Phase 2: Dedup ───────────────────────────────────────────────────
    const dedupResult = this.deduplicate(allMemories);
    const afterDedup = dedupResult.uniqueMemories;
    const totalAfterDedup = afterDedup.length;

    // ── Phase 3: REM Dreaming ───────────────────────────────────────────
    const crossLinks = this.findCrossLinks(afterDedup);
    const schemas = this.extractSchemas(afterDedup);

    // ── Phase 4: Forgetting ─────────────────────────────────────────────
    const nowMs = Date.now();
    const forgettingResult = this.evaluateForgetting(afterDedup, nowMs);

    // ── Phase 5: Apply ──────────────────────────────────────────────────
    // Merged IDs from dedup → delete duplicates (keep representative)
    for (const mergedId of dedupResult.mergedIds) {
      try {
        await gateway.deleteMemory({ userId, memoryId: mergedId });
      } catch {
        // Best-effort: continue if one delete fails
      }
    }

    // Archived IDs from forgetting → store archival marker in metadata
    for (const archivedId of forgettingResult.archiveIds) {
      try {
        // `ProductMemoryUpdateInput` requires `content` — read current content first
        const current = await gateway.getMemory({
          userId,
          memoryId: archivedId,
        });
        if (current) {
          await gateway.updateMemory({
            userId,
            memoryId: archivedId,
            content: current.content,
            metadata: {
              retention: "archived",
              archivedAt: new Date().toISOString(),
            },
          });
        }
      } catch {
        // Best-effort
      }
    }

    for (const latentId of forgettingResult.latentIds) {
      try {
        const current = await gateway.getMemory({
          userId,
          memoryId: latentId,
        });
        if (current) {
          await gateway.updateMemory({
            userId,
            memoryId: latentId,
            content: current.content,
            metadata: {
              retention: "latent",
              latentAt: new Date().toISOString(),
              reverieEligible: true,
            },
          });
        }
      } catch {
        // Best-effort
      }
    }

    const elapsedMs = performance.now() - t0;

    return {
      mergedIds: [...dedupResult.mergedIds],
      archivedIds: [...forgettingResult.archiveIds],
      deletedIds: [...forgettingResult.deleteIds],
      latentIds: [...forgettingResult.latentIds],
      crossLinks,
      schemas,
      totalBefore,
      totalAfterDedup,
      totalAfterForgetting: totalAfterDedup - forgettingResult.deleteCount,
      elapsedMs: Math.round(elapsedMs * 100) / 100,
    };
  }

  /**
   * Run only the dedup phase (lighter weight for post-store hooks).
   */
  async runDedupOnly(
    gateway: ProductMemoryGateway,
    userId: string,
  ): Promise<{ mergedIds: string[]; elapsedMs: number }> {
    const t0 = performance.now();
    const allMemories = await this.fetchAllMemories(gateway, userId);
    const result = this.deduplicate(allMemories);
    for (const mergedId of result.mergedIds) {
      try {
        await gateway.deleteMemory({ userId, memoryId: mergedId });
      } catch {
        // Best-effort
      }
    }
    return {
      mergedIds: [...result.mergedIds],
      elapsedMs: performance.now() - t0,
    };
  }

  // -----------------------------------------------------------------------
  // Phase 1: Fetch (paginated)
  // -----------------------------------------------------------------------

  private async fetchAllMemories(
    gateway: ProductMemoryGateway,
    userId: string,
  ): Promise<UnifiedMemory[]> {
    const all: UnifiedMemory[] = [];
    let offset = 0;
    const limit = 100;
    while (all.length < this.config.maxMemoriesPerRun) {
      const result = await gateway.listMemories({ userId, limit, offset });
      all.push(...result.memories);
      if (result.memories.length < limit) break;
      offset += limit;
    }
    return all;
  }

  // -----------------------------------------------------------------------
  // Phase 2: Semantic deduplication via TF-IDF cosine similarity
  // -----------------------------------------------------------------------

  private deduplicate(memories: UnifiedMemory[]): {
    uniqueMemories: UnifiedMemory[];
    mergedIds: string[];
  } {
    if (memories.length < 2) {
      return { uniqueMemories: [...memories], mergedIds: [] };
    }

    const idf = buildIdf(memories);
    const vectors = memories.map((m) => tfidfVector(m.content, idf));
    const used = new Set<number>();
    const clusters: DedupCluster[] = [];
    const unique: UnifiedMemory[] = [];

    for (let i = 0; i < memories.length; i++) {
      if (used.has(i)) continue;
      const members: UnifiedMemory[] = [memories[i]];
      const scores = [1.0];
      used.add(i);

      for (let j = i + 1; j < memories.length; j++) {
        if (used.has(j)) continue;
        const sim = cosineSim(vectors[i], vectors[j]);
        if (sim >= this.config.dedupThreshold) {
          members.push(memories[j]);
          scores.push(sim);
          used.add(j);
        }
      }

      if (members.length > 1) {
        const rep = members.reduce((a, b) => (b.importance > a.importance ? b : a));
        clusters.push({
          clusterId: `cluster_${clusters.length}`,
          members,
          representative: rep,
          similarityScores: scores,
        });
        unique.push(rep);
      } else {
        unique.push(memories[i]);
      }
    }

    const mergedIds = clusters.flatMap((c) =>
      c.members.filter((m) => m.id !== c.representative.id).map((m) => m.id),
    );

    return { uniqueMemories: unique, mergedIds };
  }

  // -----------------------------------------------------------------------
  // Phase 3: REM-style cross-linking and schema extraction
  // -----------------------------------------------------------------------

  private findCrossLinks(memories: UnifiedMemory[]): CrossLink[] {
    if (memories.length < 2) return [];

    const idf = buildIdf(memories);
    const vectors = memories.map((m) => tfidfVector(m.content, idf));
    const links: CrossLink[] = [];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sim = cosineSim(vectors[i], vectors[j]);
        if (sim >= this.config.crosslinkThreshold) {
          const sameEmotion =
            memories[i].emotionalContext?.valence !== undefined &&
            memories[j].emotionalContext?.valence !== undefined &&
            Math.sign(memories[i].emotionalContext!.valence) ===
              Math.sign(memories[j].emotionalContext!.valence);
          links.push({
            memoryAId: memories[i].id,
            memoryBId: memories[j].id,
            similarity: Math.round(sim * 10000) / 10000,
            linkType: sameEmotion ? "emotional_co_occurrence" : "semantic_similarity",
          });
        }
      }
    }
    return links;
  }

  private extractSchemas(memories: UnifiedMemory[]): SchemaPattern[] {
    const categoryGroups = new Map<string, UnifiedMemory[]>();
    for (const m of memories) {
      const cat = m.category || "general";
      const group = categoryGroups.get(cat) ?? [];
      group.push(m);
      categoryGroups.set(cat, group);
    }

    const schemas: SchemaPattern[] = [];
    let idx = 0;
    for (const [category, group] of categoryGroups) {
      if (group.length < 2) continue;
      const avgCatImportance = group.reduce((s, m) => s + m.importance, 0) / group.length;
      schemas.push({
        schemaId: `schema_${idx++}`,
        title: `Pattern: ${category}`,
        generalization: `Memories in "${category}" show avg importance ${avgCatImportance.toFixed(3)} across ${group.length} entries`,
        sourceMemoryIds: group.map((m) => m.id),
        confidence: Math.min(group.length / 20, 1),
      });
    }
    return schemas;
  }

  // -----------------------------------------------------------------------
  // Phase 4: Ebbinghaus forgetting
  // -----------------------------------------------------------------------

  private evaluateForgetting(
    memories: UnifiedMemory[],
    nowMs: number,
  ): {
    archiveIds: string[];
    deleteIds: string[];
    latentIds: string[];
    deleteCount: number;
  } {
    const archiveIds: string[] = [];
    const deleteIds: string[] = [];
    const latentIds: string[] = [];

    for (const m of memories) {
      const score = retentionScore(m, this.config.forgettingHalfLifeDays, nowMs);
      if (score < this.config.deleteThreshold) {
        deleteIds.push(m.id);
      } else if (score < this.config.archiveThreshold) {
        const hasEmotionalContext =
          m.emotionalContext !== null && m.emotionalContext.intensity >= 0.3;
        const isCrisis = m.category === "crisis";
        if (hasEmotionalContext && !isCrisis) {
          latentIds.push(m.id);
        } else {
          archiveIds.push(m.id);
        }
      }
    }

    return {
      archiveIds,
      deleteIds,
      latentIds,
      deleteCount: deleteIds.length,
    };
  }
}
