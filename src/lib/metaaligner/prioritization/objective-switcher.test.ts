import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ObjectiveSwitcher,
  ObjectiveSwitchObserver,
  type SwitchMetadata,
  type ObjectiveSwitcherConfig,
} from './objective-switcher'
import { ContextType } from '../core/objectives'
import type { ContextEvent, ContextTransition } from './context-transition-detector'
import type { ObjectivePriority } from './context-objective-mapping'

describe('ObjectiveSwitcher', () => {
  let switcher: ObjectiveSwitcher

  beforeEach(() => {
    switcher = new ObjectiveSwitcher()
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(switcher).toBeDefined()
      expect(switcher.getObjectives()).toEqual([])
    })

    it('should initialize with initial context', () => {
      const initialContext: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const switcherWithContext = new ObjectiveSwitcher({
        initialContext,
      })

      const objectives = switcherWithContext.getObjectives()
      expect(objectives.length).toBeGreaterThan(0)
      expect(switcherWithContext.getCurrentContext()).toEqual(initialContext)
    })

    it('should accept custom weighting strategy', () => {
      const customStrategy = vi.fn((objs) => objs)
      const customSwitcher = new ObjectiveSwitcher({
        weightingStrategy: customStrategy,
      })

      expect(customSwitcher).toBeDefined()
    })

    it('should respect telemetry config', () => {
      const noTelemetrySwitcher = new ObjectiveSwitcher({
        enableTelemetry: false,
      })

      expect(noTelemetrySwitcher).toBeDefined()
    })
  })

  describe('onContextTransition', () => {
    it('should switch objectives on detected transition', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      const objectives = switcher.getObjectives()
      expect(objectives.length).toBeGreaterThan(0)
      expect(switcher.getCurrentContext()?.contextType).toBe(ContextType.EDUCATIONAL)
    })

    it('should not switch when transition not detected', async () => {
      const initialContext: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      switcher = new ObjectiveSwitcher({ initialContext })
      const initialObjectives = switcher.getObjectives()

      const transition: ContextTransition = {
        from: initialContext,
        to: initialContext,
        detected: false,
        transitionType: 'none',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      expect(switcher.getObjectives()).toEqual(initialObjectives)
    })

    it('should handle crisis elevation transition', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.CRISIS,
          confidence: 0.95,
          urgency: 'critical',
          timestamp: Date.now() + 500,
        },
        detected: true,
        transitionType: 'crisis_elevation',
        shouldSmooth: false,
        confidence: 1.0,
      }

      await switcher.onContextTransition(transition)

      const objectives = switcher.getObjectives()
      expect(objectives.length).toBeGreaterThan(0)
      
      // Crisis should prioritize safety
      const safetyObj = objectives.find(obj => obj.key === 'safety')
      expect(safetyObj).toBeDefined()
    })

    it('should complete switch within 150ms', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.SUPPORT,
          confidence: 0.85,
          urgency: 'medium',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.85,
      }

      const startTime = performance.now()
      await switcher.onContextTransition(transition)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(150)
    })
  })

  describe('observer pattern', () => {
    it('should notify observers on objective change', async () => {
      const observerMock = vi.fn()
      switcher.addObserver(observerMock)

      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      // Allow async notifications to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(observerMock).toHaveBeenCalled()
      const callArgs = observerMock.mock.calls[0]
      expect(callArgs[0]).toBeInstanceOf(Array) // objectives
      expect(callArgs[1]).toHaveProperty('toContext')
    })

    it('should handle multiple observers', async () => {
      const observer1 = vi.fn()
      const observer2 = vi.fn()
      const observer3 = vi.fn()

      switcher.addObserver(observer1)
      switcher.addObserver(observer2)
      switcher.addObserver(observer3)

      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.SUPPORT,
          confidence: 0.85,
          urgency: 'medium',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.85,
      }

      await switcher.onContextTransition(transition)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(observer1).toHaveBeenCalled()
      expect(observer2).toHaveBeenCalled()
      expect(observer3).toHaveBeenCalled()
    })

    it('should remove observers correctly', async () => {
      const observer = vi.fn()
      switcher.addObserver(observer)
      switcher.removeObserver(observer)

      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(observer).not.toHaveBeenCalled()
    })

    it('should handle observer errors gracefully', async () => {
      const failingObserver = vi.fn(() => {
        throw new Error('Observer error')
      })
      switcher.addObserver(failingObserver)

      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      // Should not throw
      await expect(switcher.onContextTransition(transition)).resolves.not.toThrow()
    })
  })

  describe('concurrency and race conditions', () => {
    it('should handle concurrent switch attempts safely', async () => {
      const transitions: ContextTransition[] = [
        {
          from: {
            turnId: 1,
            contextType: ContextType.GENERAL,
            confidence: 0.7,
            urgency: 'low',
            timestamp: Date.now(),
          },
          to: {
            turnId: 2,
            contextType: ContextType.EDUCATIONAL,
            confidence: 0.9,
            urgency: 'low',
            timestamp: Date.now() + 100,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.9,
        },
        {
          from: {
            turnId: 2,
            contextType: ContextType.EDUCATIONAL,
            confidence: 0.9,
            urgency: 'low',
            timestamp: Date.now() + 100,
          },
          to: {
            turnId: 3,
            contextType: ContextType.SUPPORT,
            confidence: 0.85,
            urgency: 'medium',
            timestamp: Date.now() + 200,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.85,
        },
      ]

      // Fire both transitions simultaneously
      await Promise.all(transitions.map(t => switcher.onContextTransition(t)))

      // Should have valid state (last transition should win)
      const currentContext = switcher.getCurrentContext()
      expect(currentContext).toBeDefined()
      expect([ContextType.EDUCATIONAL, ContextType.SUPPORT]).toContain(
        currentContext?.contextType,
      )
    })

    it('should process pending switches', async () => {
      const switchCount = 5
      const transitions: ContextTransition[] = []

      for (let i = 0; i < switchCount; i++) {
        transitions.push({
          from: {
            turnId: i,
            contextType: i % 2 === 0 ? ContextType.GENERAL : ContextType.EDUCATIONAL,
            confidence: 0.8,
            urgency: 'low',
            timestamp: Date.now() + i * 100,
          },
          to: {
            turnId: i + 1,
            contextType: i % 2 === 0 ? ContextType.EDUCATIONAL : ContextType.SUPPORT,
            confidence: 0.85,
            urgency: 'medium',
            timestamp: Date.now() + (i + 1) * 100,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.85,
        })
      }

      // Fire all transitions rapidly
      await Promise.all(transitions.map(t => switcher.onContextTransition(t)))

      // All should be processed (check telemetry)
      const telemetry = switcher.getTelemetry()
      expect(telemetry.objective_switch_count).toBeGreaterThan(0)
    })

    it('should maintain data consistency under load', async () => {
      const iterations = 10
      const promises: Promise<void>[] = []

      for (let i = 0; i < iterations; i++) {
        const transition: ContextTransition = {
          from: {
            turnId: i,
            contextType: ContextType.GENERAL,
            confidence: 0.7,
            urgency: 'low',
            timestamp: Date.now() + i * 50,
          },
          to: {
            turnId: i + 1,
            contextType: i % 3 === 0 ? ContextType.EDUCATIONAL : 
                        i % 3 === 1 ? ContextType.SUPPORT : ContextType.INFORMATIONAL,
            confidence: 0.85,
            urgency: 'medium',
            timestamp: Date.now() + (i + 1) * 50,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.85,
        }

        promises.push(switcher.onContextTransition(transition))
      }

      await Promise.all(promises)

      // Should have valid objectives
      const objectives = switcher.getObjectives()
      expect(objectives).toBeInstanceOf(Array)
      expect(objectives.length).toBeGreaterThan(0)

      // Telemetry should be consistent
      const telemetry = switcher.getTelemetry()
      expect(telemetry.objective_switch_count).toBeGreaterThan(0)
      expect(telemetry.failed_switches).toBe(0)
    })
  })

  describe('telemetry', () => {
    it('should track switch count', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      const telemetry = switcher.getTelemetry()
      expect(telemetry.objective_switch_count).toBe(1)
    })

    it('should track multiple switches', async () => {
      for (let i = 0; i < 3; i++) {
        const transition: ContextTransition = {
          from: {
            turnId: i,
            contextType: i % 2 === 0 ? ContextType.GENERAL : ContextType.EDUCATIONAL,
            confidence: 0.7,
            urgency: 'low',
            timestamp: Date.now() + i * 1000,
          },
          to: {
            turnId: i + 1,
            contextType: i % 2 === 0 ? ContextType.EDUCATIONAL : ContextType.SUPPORT,
            confidence: 0.9,
            urgency: 'low',
            timestamp: Date.now() + (i + 1) * 1000,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.9,
        }

        await switcher.onContextTransition(transition)
      }

      const telemetry = switcher.getTelemetry()
      expect(telemetry.objective_switch_count).toBe(3)
    })

    it('should calculate average duration', async () => {
      for (let i = 0; i < 2; i++) {
        const transition: ContextTransition = {
          from: {
            turnId: i,
            contextType: ContextType.GENERAL,
            confidence: 0.7,
            urgency: 'low',
            timestamp: Date.now() + i * 1000,
          },
          to: {
            turnId: i + 1,
            contextType: ContextType.EDUCATIONAL,
            confidence: 0.9,
            urgency: 'low',
            timestamp: Date.now() + (i + 1) * 1000,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.9,
        }

        await switcher.onContextTransition(transition)
      }

      const telemetry = switcher.getTelemetry()
      expect(telemetry.average_switch_duration_ms).toBeGreaterThan(0)
      expect(telemetry.average_switch_duration_ms).toBeLessThan(150)
    })

    it('should track observer notifications', async () => {
      const observer = vi.fn()
      switcher.addObserver(observer)

      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)
      await new Promise(resolve => setTimeout(resolve, 10))

      const telemetry = switcher.getTelemetry()
      expect(telemetry.observer_notifications).toBe(1)
    })

    it('should reset telemetry', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)
      expect(switcher.getTelemetry().objective_switch_count).toBe(1)

      switcher.resetTelemetry()
      expect(switcher.getTelemetry().objective_switch_count).toBe(0)
    })
  })

  describe('audit logging', () => {
    it('should create audit log entry on switch', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      const auditLog = switcher.getAuditLog()
      expect(auditLog.length).toBe(1)
      expect(auditLog[0]?.success).toBe(true)
      expect(auditLog[0]?.toContext).toBe(ContextType.EDUCATIONAL)
    })

    it('should include objectives in audit log', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      const auditLog = switcher.getAuditLog()
      expect(auditLog[0]?.objectives).toBeInstanceOf(Array)
      expect(auditLog[0]?.objectives.length).toBeGreaterThan(0)
    })

    it('should limit audit log size', async () => {
      const smallLogSwitcher = new ObjectiveSwitcher({
        maxAuditLogSize: 5,
      })

      for (let i = 0; i < 10; i++) {
        const transition: ContextTransition = {
          from: {
            turnId: i,
            contextType: ContextType.GENERAL,
            confidence: 0.7,
            urgency: 'low',
            timestamp: Date.now() + i * 1000,
          },
          to: {
            turnId: i + 1,
            contextType: ContextType.EDUCATIONAL,
            confidence: 0.9,
            urgency: 'low',
            timestamp: Date.now() + (i + 1) * 1000,
          },
          detected: true,
          transitionType: 'standard',
          shouldSmooth: false,
          confidence: 0.9,
        }

        await smallLogSwitcher.onContextTransition(transition)
      }

      const auditLog = smallLogSwitcher.getAuditLog()
      expect(auditLog.length).toBeLessThanOrEqual(5)
    })

    it('should clear audit log', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)
      expect(switcher.getAuditLog().length).toBe(1)

      switcher.clearAuditLog()
      expect(switcher.getAuditLog().length).toBe(0)
    })
  })

  describe('getObjectives', () => {
    it('should return read-only objectives', () => {
      const objectives = switcher.getObjectives()
      
      // Should be frozen
      expect(Object.isFrozen(objectives)).toBe(true)
    })

    it('should return current objectives after switch', async () => {
      const transition: ContextTransition = {
        from: {
          turnId: 1,
          contextType: ContextType.GENERAL,
          confidence: 0.7,
          urgency: 'low',
          timestamp: Date.now(),
        },
        to: {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.9,
      }

      await switcher.onContextTransition(transition)

      const objectives = switcher.getObjectives()
      expect(objectives.length).toBeGreaterThan(0)
      
      // Should have informativeness high for educational context
      const infoObj = objectives.find(obj => obj.key === 'informativeness')
      expect(infoObj).toBeDefined()
    })
  })

  describe('isSwitching', () => {
    it('should return false when not switching', () => {
      expect(switcher.isSwitching()).toBe(false)
    })
  })
})
