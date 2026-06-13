// Consolidation Trigger Engine — Sprint 3, Task 5 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'

export enum TriggerType {
  MANUAL = 'manual',
  STEP_COUNT = 'step_count',
  COMPACTION = 'compaction',
  CRISIS = 'crisis',
  SESSION_END = 'session_end',
}

export interface TriggerEvent {
  triggerType: TriggerType
  timestampMs: number
  context: Record<string, unknown>
  priority: number
}

export interface TriggerConfig {
  stepInterval: number
  compactionThreshold: number
  crisisTakesPrecedence: boolean
}

const DEFAULT_CONFIG: TriggerConfig = {
  stepInterval: 50,
  compactionThreshold: 200,
  crisisTakesPrecedence: true,
}

export class ConsolidationTriggerEngine {
  private readonly config: TriggerConfig
  private stepCounter = 0
  private pendingTriggers: TriggerEvent[] = []
  private readonly crisisReflectionPrompts: Record<string, string> = {
    immediate: 'Process recent crisis content for safety review.',
    postSession: 'Reflect on crisis patterns from this session.',
  }

  constructor(config?: Partial<TriggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  recordStep(): TriggerEvent | null {
    this.stepCounter++
    if (this.stepCounter >= this.config.stepInterval) {
      this.stepCounter = 0
      const event: TriggerEvent = {
        triggerType: TriggerType.STEP_COUNT,
        timestampMs: Date.now(),
        context: { stepsSinceLast: this.config.stepInterval },
        priority: 3,
      }
      this.pendingTriggers.push(event)
      return event
    }
    return null
  }

  checkCompaction(memories: MemoryBlock[]): TriggerEvent | null {
    if (memories.length >= this.config.compactionThreshold) {
      const event: TriggerEvent = {
        triggerType: TriggerType.COMPACTION,
        timestampMs: Date.now(),
        context: { memoryCount: memories.length },
        priority: 2,
      }
      this.pendingTriggers.push(event)
      return event
    }
    return null
  }

  detectCrisisTrigger(memories: MemoryBlock[]): TriggerEvent | null {
    const crisisMemories = memories.filter((m) => m.gating.crisisFlag)
    if (crisisMemories.length > 0) {
      const event: TriggerEvent = {
        triggerType: TriggerType.CRISIS,
        timestampMs: Date.now(),
        context: { crisisCount: crisisMemories.length },
        priority: 1,
      }
      this.pendingTriggers.push(event)
      return event
    }
    return null
  }

  onSessionEnd(): TriggerEvent {
    const event: TriggerEvent = {
      triggerType: TriggerType.SESSION_END,
      timestampMs: Date.now(),
      context: {},
      priority: 4,
    }
    this.pendingTriggers.push(event)
    return event
  }

  requestManual(context?: Record<string, unknown>): TriggerEvent {
    const event: TriggerEvent = {
      triggerType: TriggerType.MANUAL,
      timestampMs: Date.now(),
      context: context ?? {},
      priority: 5,
    }
    this.pendingTriggers.push(event)
    return event
  }

  getNextTrigger(): TriggerEvent | null {
    if (this.pendingTriggers.length === 0) return null

    if (this.config.crisisTakesPrecedence) {
      const crisisTrigger = this.pendingTriggers.find(
        (t) => t.triggerType === TriggerType.CRISIS,
      )
      if (crisisTrigger) return crisisTrigger
    }

    this.pendingTriggers.sort((a, b) => a.priority - b.priority)
    return this.pendingTriggers.shift() ?? null
  }

  clearTriggers(): void {
    this.pendingTriggers = []
  }

  getCrisisReflectionPrompt(context = 'immediate'): string {
    return (
      this.crisisReflectionPrompts[context] ??
      this.crisisReflectionPrompts['immediate']
    )
  }

  shouldTrigger(memories: MemoryBlock[]): boolean {
    if (memories.some((m) => m.gating.crisisFlag)) return true
    return memories.length >= this.config.compactionThreshold
  }

  get pendingCount(): number {
    return this.pendingTriggers.length
  }

  reset(): void {
    this.stepCounter = 0
    this.pendingTriggers = []
  }
}
