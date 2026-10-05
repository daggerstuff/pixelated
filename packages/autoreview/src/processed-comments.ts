/**
 * Tracks which comment ids have already been processed so a repeated review
 * pass does not re-report comments it has already addressed.
 */
export interface ProcessedCommentStore {
  has(id: string): boolean
  add(id: string): void
  ids(): string[]
}

export class InMemoryProcessedCommentStore implements ProcessedCommentStore {
  private readonly processed = new Set<string>()

  has(id: string): boolean {
    return this.processed.has(id)
  }

  add(id: string): void {
    this.processed.add(id)
  }

  ids(): string[] {
    return [...this.processed]
  }
}

export interface DedupeResult<T> {
  /** Comments not seen before (now marked processed). */
  fresh: T[]
  /** Ids that were already processed and therefore skipped. */
  alreadyProcessed: string[]
}

/**
 * Splits a batch into fresh vs already-processed comments, marking the fresh
 * ones as processed so a subsequent pass treats them as handled.
 */
export function dedupeComments<T extends { id: string }>(
  comments: T[],
  store: ProcessedCommentStore,
): DedupeResult<T> {
  const fresh: T[] = []
  const alreadyProcessed: string[] = []
  for (const comment of comments) {
    if (store.has(comment.id)) {
      alreadyProcessed.push(comment.id)
    } else {
      fresh.push(comment)
      store.add(comment.id)
    }
  }
  return { fresh, alreadyProcessed }
}
