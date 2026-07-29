// REM-Style Dream Scheduler — Sprint 3, Task 3 (TypeScript mirror)
import { MemoryBlock } from "../../../types/memory";
import { ReverieSeed } from "../../../types/reverie";
import { SemanticDeduplicator } from "./dedup";

export interface CrossLink {
  memoryAId: string;
  memoryBId: string;
  similarity: number;
  linkType: string;
}

export interface Schema {
  schemaId: string;
  title: string;
  generalization: string;
  sourceMemoryIds: string[];
  confidence: number;
}

export interface DreamResult {
  replayed: MemoryBlock[];
  crossLinks: CrossLink[];
  schemas: Schema[];
  summaries: Record<string, string>;
  reverieSeeds: ReverieSeed[];
  elapsedMs: number;
  memoriesProcessed: number;
}

export type SummarizerFn = (memories: MemoryBlock[]) => string;

export class RemDreamScheduler {
  private readonly summarizer: SummarizerFn;
  private readonly crosslinkThreshold: number;

  constructor(summarizer?: SummarizerFn, crosslinkThreshold = 0.7) {
    this.summarizer = summarizer ?? RemDreamScheduler.defaultSummarizer;
    this.crosslinkThreshold = crosslinkThreshold;
  }

  processSession(memories: MemoryBlock[]): DreamResult {
    const t0 = performance.now();

    const sorted = [...memories].sort((a, b) => b.importance.raw - a.importance.raw);
    const replayed = this.replay(sorted);
    const crossLinks = this.crosslink(sorted);
    const schemas = this.extractSchemas(sorted);
    const summaries = this.summarize(sorted);
    const reverieSeeds = this.reverieSeeding(sorted);

    const elapsedMs = performance.now() - t0;

    return {
      replayed,
      crossLinks,
      schemas,
      summaries,
      reverieSeeds,
      elapsedMs: Math.round(elapsedMs * 100) / 100,
      memoriesProcessed: memories.length,
    };
  }

  private replay(memories: MemoryBlock[]): MemoryBlock[] {
    const topN = Math.max(1, Math.floor(memories.length / 3));
    return memories.slice(0, topN).map((m) => ({
      ...m,
      consolidation: {
        ...m.consolidation,
        remCycles: Math.max(m.consolidation.remCycles - 1, 0),
        lastProcessed: Date.now(),
      },
    }));
  }

  private crosslink(memories: MemoryBlock[]): CrossLink[] {
    const dedup = new SemanticDeduplicator(this.crosslinkThreshold);
    dedup.buildIndex(memories);
    const vectors = memories.map((m) => dedup.tfidfVector(m.content));

    const links: CrossLink[] = [];
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sim = dedup.cosine(vectors[i], vectors[j]);
        if (sim >= this.crosslinkThreshold) {
          const sameEmotion = memories[i].emotions.categories.some((c) =>
            memories[j].emotions.categories.includes(c),
          );
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

  private extractSchemas(memories: MemoryBlock[]): Schema[] {
    const categoryGroups: Record<string, MemoryBlock[]> = {};
    for (const m of memories) {
      const cats = m.emotions.categories.length > 0 ? m.emotions.categories : ["general"];
      for (const cat of cats) {
        (categoryGroups[cat] ??= []).push(m);
      }
    }

    const schemas: Schema[] = [];
    let idx = 0;
    for (const [category, group] of Object.entries(categoryGroups)) {
      if (group.length < 2) continue;
      const avgValence = group.reduce((s, m) => s + m.emotions.valence, 0) / group.length;
      const valenceLabel =
        avgValence > 0.2 ? "positive" : avgValence < -0.2 ? "negative" : "neutral";
      schemas.push({
        schemaId: `schema_${idx++}`,
        title: `Pattern: ${category}`,
        generalization: `Multiple memories show ${valenceLabel} ${category}-related content across ${group.length} instances`,
        sourceMemoryIds: group.map((m) => m.id),
        confidence: Math.min(group.length / 10, 1),
      });
    }
    return schemas;
  }

  private summarize(memories: MemoryBlock[]): Record<string, string> {
    const sessionGroups: Record<string, MemoryBlock[]> = {};
    for (const m of memories) {
      (sessionGroups[m.sessionId] ??= []).push(m);
    }

    const summaries: Record<string, string> = {};
    for (const [sessionId, group] of Object.entries(sessionGroups)) {
      summaries[sessionId] = this.summarizer(group);
    }
    return summaries;
  }

  private reverieSeeding(memories: MemoryBlock[]): ReverieSeed[] {
    const seeds: ReverieSeed[] = [];
    for (const m of memories) {
      if (
        (m.consolidation.phase === "archived" || m.consolidation.phase === "forgotten") &&
        m.importance.emotionalWeight >= 2.0 &&
        m.importance.raw >= 0.3 &&
        !m.gating.crisisFlag
      ) {
        const potential = Math.min(
          0.4 * (m.importance.emotionalWeight / 5.0) +
            0.2 * Math.min(m.emotions.categories.length / 5, 1) +
            0.2 * Math.min(m.consolidation.schemaReferences.length / 5, 1) +
            0.2 * m.importance.recency,
          1,
        );
        seeds.push({
          memoryId: m.id,
          reason: `emotional weight ${m.importance.emotionalWeight}, phase ${m.consolidation.phase}`,
          potential,
        });
      }
    }
    return seeds;
  }

  private static defaultSummarizer(memories: MemoryBlock[]): string {
    if (memories.length === 0) return "";
    const top = [...memories].sort((a, b) => b.importance.raw - a.importance.raw).slice(0, 3);
    const topics = new Set(
      top.flatMap((m) => (m.emotions.categories.length > 0 ? m.emotions.categories : ["general"])),
    );
    return `Session with ${memories.length} memories. Key themes: ${[...topics].join(", ")}. Highest importance: ${top[0].content.slice(0, 100)}`;
  }
}
