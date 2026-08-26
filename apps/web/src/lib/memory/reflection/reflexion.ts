// Reflexion Framework — Sprint 4, Task 1 (TypeScript mirror)

export enum FeedbackType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  NEUTRAL = 'neutral',
}

export interface ActionFeedbackPair {
  action: string
  feedback: string
  feedbackType: FeedbackType
  timestampMs: number
  sessionId: string
}

export interface VerbalReflection {
  reflectionId: string
  whatWentWell: string[]
  whatWentWrong: string[]
  whatToChange: string[]
  sourcePairs: ActionFeedbackPair[]
  confidence: number
}

export interface ReflexionResult {
  reflections: VerbalReflection[]
  contextUpdates: string[]
  memoriesToUpdate: string[]
  elapsedMs: number
}

export type ReflectionGeneratorFn = (pairs: ActionFeedbackPair[]) => string

export class ReflexionEngine {
  private readonly generator: ReflectionGeneratorFn
  private readonly minPairs: number
  private readonly trajectories: Map<string, ActionFeedbackPair[]> = new Map()

  constructor(generator?: ReflectionGeneratorFn, minPairs = 3) {
    this.generator =
      generator ?? ((pairs) => ReflexionEngine.defaultGenerator(pairs))
    this.minPairs = minPairs
  }

  recordAction(
    action: string,
    feedback: string,
    feedbackType: FeedbackType,
    sessionId: string,
  ): void {
    const pair: ActionFeedbackPair = {
      action,
      feedback,
      feedbackType,
      timestampMs: Date.now(),
      sessionId,
    }
    if (!this.trajectories.has(sessionId)) {
      this.trajectories.set(sessionId, [])
    }
    this.trajectories.get(sessionId)!.push(pair)
  }

  reflect(sessionId: string): ReflexionResult | null {
    const pairs = this.trajectories.get(sessionId) ?? []
    if (pairs.length < this.minPairs) return null

    const rawReflection = this.generator(pairs)
    const parsed = ReflexionEngine.parseReflection(rawReflection, pairs)

    const contextUpdates = parsed.whatToChange

    return {
      reflections: [parsed],
      contextUpdates,
      memoriesToUpdate: [],
      elapsedMs: 0,
    }
  }

  reflectAll(): Record<string, ReflexionResult> {
    const results: Record<string, ReflexionResult> = {}
    for (const sessionId of this.trajectories.keys()) {
      const result = this.reflect(sessionId)
      if (result) results[sessionId] = result
    }
    return results
  }

  getTrajectory(sessionId: string): ActionFeedbackPair[] {
    return [...(this.trajectories.get(sessionId) ?? [])]
  }

  clearSession(sessionId: string): void {
    this.trajectories.delete(sessionId)
  }

  private static parseReflection(
    raw: string,
    pairs: ActionFeedbackPair[],
  ): VerbalReflection {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const wentWell: string[] = []
    const wentWrong: string[] = []
    const toChange: string[] = []
    let section: string | null = null

    for (const line of lines) {
      const lower = line.toLowerCase()
      if (
        lower.includes('went well') ||
        lower.includes('success') ||
        lower.includes('positive')
      ) {
        section = 'well'
        continue
      }
      if (
        lower.includes('went wrong') ||
        lower.includes('fail') ||
        lower.includes('negative')
      ) {
        section = 'wrong'
        continue
      }
      if (
        lower.includes('change') ||
        lower.includes('differently') ||
        lower.includes('improve')
      ) {
        section = 'change'
        continue
      }
      if (section === 'well' && line.startsWith('-')) {
        wentWell.push(line.replace(/^- /, ''))
      } else if (section === 'wrong' && line.startsWith('-')) {
        wentWrong.push(line.replace(/^- /, ''))
      } else if (section === 'change' && line.startsWith('-')) {
        toChange.push(line.replace(/^- /, ''))
      }
    }

    const failures = pairs.filter(
      (p) => p.feedbackType === FeedbackType.FAILURE,
    ).length
    const confidence = pairs.length > 0 ? 1 - failures / pairs.length : 0.5

    return {
      reflectionId: `reflexion_${Date.now()}`,
      whatWentWell:
        wentWell.length > 0
          ? wentWell
          : ['Trajectory completed without major issues'],
      whatWentWrong: wentWrong,
      whatToChange: toChange,
      sourcePairs: pairs,
      confidence: Math.round(confidence * 100) / 100,
    }
  }

  private static defaultGenerator(pairs: ActionFeedbackPair[]): string {
    const successes = pairs.filter(
      (p) => p.feedbackType === FeedbackType.SUCCESS,
    )
    const failures = pairs.filter(
      (p) => p.feedbackType === FeedbackType.FAILURE,
    )
    const partials = pairs.filter(
      (p) => p.feedbackType === FeedbackType.PARTIAL,
    )

    const lines = ['Reflection:']
    lines.push('What went well:')
    for (const p of successes) lines.push(`- ${p.action}: ${p.feedback}`)
    if (successes.length === 0) lines.push('- No clear successes identified')

    lines.push('What went wrong:')
    for (const p of failures) lines.push(`- ${p.action}: ${p.feedback}`)
    if (failures.length === 0) lines.push('- No clear failures identified')

    lines.push('What to change next time:')
    for (const p of partials)
      lines.push(`- Refine: ${p.action} (was ${p.feedback})`)
    if (partials.length === 0) lines.push('- Continue current approach')

    return lines.join('\n')
  }

  get sessionCount(): number {
    return this.trajectories.size
  }

  get totalPairs(): number {
    let total = 0
    for (const pairs of this.trajectories.values()) total += pairs.length
    return total
  }
}
