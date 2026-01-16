import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ContextTransitionDetector,
  detectContextTransition,
  type ContextEvent,
  type ContextTransition,
  type TransitionDetectorConfig,
} from './context-transition-detector'
import { ContextType } from '../core/objectives'

describe('ContextTransitionDetector', () => {
  let detector: ContextTransitionDetector
  let config: TransitionDetectorConfig

  beforeEach(() => {
    config = {
      minConfidenceThreshold: 0.7,
      smoothingWindow: 2,
      enableCrisisElevation: true,
      enableTelemetry: true,
    }
    detector = new ContextTransitionDetector(config)
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultDetector = new ContextTransitionDetector()
      expect(defaultDetector).toBeDefined()
    })

    it('should initialize with custom config', () => {
      const customDetector = new ContextTransitionDetector({
        minConfidenceThreshold: 0.8,
        smoothingWindow: 3,
        enableCrisisElevation: false,
      })
      expect(customDetector).toBeDefined()
    })
  })

  describe('addEvent and transition detection', () => {
    it('should return null for first event (no previous context)', () => {
      const event: ContextEvent = {
        turnId: 1,
        contextType: ContextType.GENERAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const transition = detector.addEvent(event)
      expect(transition).toBeNull()
    })

    it('should detect no transition when context stays the same', () => {
      const event1: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const event2: ContextEvent = {
        turnId: 2,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.85,
        urgency: 'low',
        timestamp: Date.now() + 1000,
      }

      detector.addEvent(event1)
      const transition = detector.addEvent(event2)

      expect(transition).not.toBeNull()
      expect(transition!.detected).toBe(false)
      expect(transition!.transitionType).toBe('none')
    })

    it('should detect crisis elevation immediately without smoothing', () => {
      const event1: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const event2: ContextEvent = {
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.95,
        urgency: 'critical',
        timestamp: Date.now() + 1000,
      }

      detector.addEvent(event1)
      const transition = detector.addEvent(event2)

      expect(transition).not.toBeNull()
      expect(transition!.detected).toBe(true)
      expect(transition!.transitionType).toBe('crisis_elevation')
      expect(transition!.shouldSmooth).toBe(false)
      expect(transition!.confidence).toBe(1.0)
    })

    it('should apply smoothing to standard transitions', () => {
      const event1: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const event2: ContextEvent = {
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      }

      detector.addEvent(event1)
      const transition = detector.addEvent(event2)

      // First detection should be smoothed
      expect(transition).not.toBeNull()
      expect(transition!.detected).toBe(false)
      expect(transition!.transitionType).toBe('standard')
      expect(transition!.shouldSmooth).toBe(true)
    })

    it('should confirm transition after smoothing window', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      // First support detection - smoothing
      const transition1 = detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })
      expect(transition1!.shouldSmooth).toBe(true)
      expect(transition1!.detected).toBe(false)

      // Second consecutive support detection - confirmed
      const transition2 = detector.addEvent({
        turnId: 3,
        contextType: ContextType.SUPPORT,
        confidence: 0.85,
        urgency: 'medium',
        timestamp: Date.now() + 2000,
      })
      expect(transition2!.shouldSmooth).toBe(false)
      expect(transition2!.detected).toBe(true)
    })

    it('should reject low confidence transitions', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const transition = detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.5, // Below threshold (0.7)
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      expect(transition!.shouldSmooth).toBe(true)
      expect(transition!.detected).toBe(false)
    })
  })

  describe('crisis elevation scenarios', () => {
    it('should elevate from educational to crisis immediately', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const transition = detector.addEvent({
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.95,
        urgency: 'critical',
        timestamp: Date.now() + 500,
      })

      expect(transition!.detected).toBe(true)
      expect(transition!.transitionType).toBe('crisis_elevation')
      expect(transition!.from.contextType).toBe(ContextType.EDUCATIONAL)
      expect(transition!.to.contextType).toBe(ContextType.CRISIS)
    })

    it('should elevate from support to crisis immediately', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now(),
      })

      const transition = detector.addEvent({
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.98,
        urgency: 'critical',
        timestamp: Date.now() + 300,
      })

      expect(transition!.detected).toBe(true)
      expect(transition!.transitionType).toBe('crisis_elevation')
      expect(transition!.shouldSmooth).toBe(false)
    })

    it('should elevate from general to crisis immediately', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.GENERAL,
        confidence: 0.5,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const transition = detector.addEvent({
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.92,
        urgency: 'critical',
        timestamp: Date.now() + 200,
      })

      expect(transition!.detected).toBe(true)
      expect(transition!.transitionType).toBe('crisis_elevation')
      expect(transition!.confidence).toBe(1.0)
    })
  })

  describe('smoothing behavior', () => {
    it('should clear pending transitions when context reverts', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      // Detect support once
      detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      // Revert to educational
      const transition = detector.addEvent({
        turnId: 3,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.85,
        urgency: 'low',
        timestamp: Date.now() + 2000,
      })

      expect(transition!.detected).toBe(false)
      expect(transition!.transitionType).toBe('none')
    })

    it('should handle oscillating contexts with smoothing', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      // Oscillate between educational and support
      detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.75,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      detector.addEvent({
        turnId: 3,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.8,
        urgency: 'low',
        timestamp: Date.now() + 2000,
      })

      const transition = detector.addEvent({
        turnId: 4,
        contextType: ContextType.SUPPORT,
        confidence: 0.78,
        urgency: 'medium',
        timestamp: Date.now() + 3000,
      })

      // Should be smoothing due to oscillation
      expect(transition!.shouldSmooth).toBe(true)
    })
  })

  describe('history management', () => {
    it('should track current context', () => {
      expect(detector.getCurrentContext()).toBeNull()

      const event: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      detector.addEvent(event)
      const current = detector.getCurrentContext()

      expect(current).not.toBeNull()
      expect(current!.contextType).toBe(ContextType.EDUCATIONAL)
    })

    it('should maintain bounded history (max 50 events)', () => {
      // Add 60 events
      for (let i = 0; i < 60; i++) {
        detector.addEvent({
          turnId: i,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + i * 1000,
        })
      }

      const history = detector.getHistory(100)
      expect(history.length).toBeLessThanOrEqual(50)
    })

    it('should retrieve recent history', () => {
      for (let i = 0; i < 10; i++) {
        detector.addEvent({
          turnId: i,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now() + i * 1000,
        })
      }

      const recent = detector.getHistory(5)
      expect(recent.length).toBe(5)
      expect(recent[4]!.turnId).toBe(9)
    })

    it('should clear history and pending transitions', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      detector.clearHistory()
      expect(detector.getCurrentContext()).toBeNull()
      expect(detector.getHistory().length).toBe(0)
    })
  })

  describe('transition statistics', () => {
    it('should calculate basic stats', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const stats = detector.getTransitionStats()
      expect(stats.totalEvents).toBe(1)
      expect(stats.transitions).toBe(0)
      expect(stats.crisisElevations).toBe(0)
    })

    it('should count transitions correctly', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.85,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      detector.addEvent({
        turnId: 3,
        contextType: ContextType.INFORMATIONAL,
        confidence: 0.8,
        urgency: 'low',
        timestamp: Date.now() + 2000,
      })

      const stats = detector.getTransitionStats()
      expect(stats.totalEvents).toBe(3)
      expect(stats.transitions).toBe(2)
    })

    it('should count crisis elevations', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      detector.addEvent({
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.95,
        urgency: 'critical',
        timestamp: Date.now() + 1000,
      })

      const stats = detector.getTransitionStats()
      expect(stats.crisisElevations).toBe(1)
    })

    it('should calculate average confidence', () => {
      detector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.8,
        urgency: 'low',
        timestamp: Date.now(),
      })

      detector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.9,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      const stats = detector.getTransitionStats()
      expect(stats.averageConfidence).toBeCloseTo(0.85, 2)
    })
  })

  describe('synthetic dialogue scenarios', () => {
    it('should handle educational to clinical transition', () => {
      const events: ContextEvent[] = [
        {
          turnId: 1,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.9,
          urgency: 'low',
          timestamp: Date.now(),
        },
        {
          turnId: 2,
          contextType: ContextType.EDUCATIONAL,
          confidence: 0.85,
          urgency: 'low',
          timestamp: Date.now() + 1000,
        },
        {
          turnId: 3,
          contextType: ContextType.CLINICAL_ASSESSMENT,
          confidence: 0.88,
          urgency: 'medium',
          timestamp: Date.now() + 2000,
        },
        {
          turnId: 4,
          contextType: ContextType.CLINICAL_ASSESSMENT,
          confidence: 0.92,
          urgency: 'medium',
          timestamp: Date.now() + 3000,
        },
      ]

      let transitionDetected = false
      events.forEach((event) => {
        const transition = detector.addEvent(event)
        if (transition && transition.detected) {
          transitionDetected = true
          expect(transition.from.contextType).toBe(ContextType.EDUCATIONAL)
          expect(transition.to.contextType).toBe(ContextType.CLINICAL_ASSESSMENT)
        }
      })

      expect(transitionDetected).toBe(true)
    })

    it('should handle support to crisis dialogue', () => {
      const dialogue = [
        { context: ContextType.SUPPORT, confidence: 0.85, urgency: 'medium' as const },
        { context: ContextType.SUPPORT, confidence: 0.8, urgency: 'medium' as const },
        { context: ContextType.CRISIS, confidence: 0.95, urgency: 'critical' as const },
      ]

      let crisisElevated = false
      dialogue.forEach((turn, index) => {
        const event: ContextEvent = {
          turnId: index + 1,
          contextType: turn.context,
          confidence: turn.confidence,
          urgency: turn.urgency,
          timestamp: Date.now() + index * 1000,
        }

        const transition = detector.addEvent(event)
        if (transition && transition.transitionType === 'crisis_elevation') {
          crisisElevated = true
          expect(transition.detected).toBe(true)
          expect(transition.shouldSmooth).toBe(false)
        }
      })

      expect(crisisElevated).toBe(true)
    })

    it('should handle complex multi-context dialogue', () => {
      const dialogue = [
        { context: ContextType.GENERAL, confidence: 0.6, urgency: 'low' as const },
        { context: ContextType.EDUCATIONAL, confidence: 0.9, urgency: 'low' as const },
        { context: ContextType.EDUCATIONAL, confidence: 0.88, urgency: 'low' as const },
        { context: ContextType.SUPPORT, confidence: 0.82, urgency: 'medium' as const },
        { context: ContextType.SUPPORT, confidence: 0.85, urgency: 'medium' as const },
        { context: ContextType.INFORMATIONAL, confidence: 0.9, urgency: 'low' as const },
      ]

      const transitions: ContextTransition[] = []
      dialogue.forEach((turn, index) => {
        const event: ContextEvent = {
          turnId: index + 1,
          contextType: turn.context,
          confidence: turn.confidence,
          urgency: turn.urgency,
          timestamp: Date.now() + index * 1000,
        }

        const transition = detector.addEvent(event)
        if (transition && transition.detected) {
          transitions.push(transition)
        }
      })

      // Should have at least 2 confirmed transitions (general->edu, support, info)
      expect(transitions.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('configuration behavior', () => {
    it('should respect custom confidence threshold', () => {
      const customDetector = new ContextTransitionDetector({
        minConfidenceThreshold: 0.9,
        smoothingWindow: 2,
      })

      customDetector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.95,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const transition = customDetector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.85, // Below custom threshold (0.9)
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      expect(transition!.shouldSmooth).toBe(true)
    })

    it('should respect custom smoothing window', () => {
      const customDetector = new ContextTransitionDetector({
        smoothingWindow: 3,
        minConfidenceThreshold: 0.7,
      })

      customDetector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      // First support detection
      customDetector.addEvent({
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      })

      // Second support detection (still smoothing)
      const transition2 = customDetector.addEvent({
        turnId: 3,
        contextType: ContextType.SUPPORT,
        confidence: 0.85,
        urgency: 'medium',
        timestamp: Date.now() + 2000,
      })
      expect(transition2!.shouldSmooth).toBe(true)

      // Third support detection (confirmed)
      const transition3 = customDetector.addEvent({
        turnId: 4,
        contextType: ContextType.SUPPORT,
        confidence: 0.82,
        urgency: 'medium',
        timestamp: Date.now() + 3000,
      })
      expect(transition3!.detected).toBe(true)
    })

    it('should allow disabling crisis elevation', () => {
      const noCrisisDetector = new ContextTransitionDetector({
        enableCrisisElevation: false,
        smoothingWindow: 2,
      })

      noCrisisDetector.addEvent({
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      })

      const transition = noCrisisDetector.addEvent({
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.95,
        urgency: 'critical',
        timestamp: Date.now() + 1000,
      })

      // Should apply smoothing even for crisis
      expect(transition!.transitionType).toBe('standard')
      expect(transition!.shouldSmooth).toBe(true)
    })
  })

  describe('legacy functions', () => {
    it('detectContextTransition should work as standalone function', () => {
      const prev: ContextEvent = {
        turnId: 1,
        contextType: ContextType.EDUCATIONAL,
        confidence: 0.9,
        urgency: 'low',
        timestamp: Date.now(),
      }

      const curr: ContextEvent = {
        turnId: 2,
        contextType: ContextType.SUPPORT,
        confidence: 0.85,
        urgency: 'medium',
        timestamp: Date.now() + 1000,
      }

      const transition = detectContextTransition(prev, curr)

      expect(transition.detected).toBe(true)
      expect(transition.from).toBe(prev)
      expect(transition.to).toBe(curr)
    })

    it('detectContextTransition should identify crisis elevation', () => {
      const prev: ContextEvent = {
        turnId: 1,
        contextType: ContextType.SUPPORT,
        confidence: 0.8,
        urgency: 'medium',
        timestamp: Date.now(),
      }

      const curr: ContextEvent = {
        turnId: 2,
        contextType: ContextType.CRISIS,
        confidence: 0.95,
        urgency: 'critical',
        timestamp: Date.now() + 1000,
      }

      const transition = detectContextTransition(prev, curr)

      expect(transition.transitionType).toBe('crisis_elevation')
      expect(transition.shouldSmooth).toBe(false)
    })
  })
})
