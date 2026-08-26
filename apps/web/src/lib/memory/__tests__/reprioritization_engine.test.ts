import {
  ReprioritizationEngine,
  EvidenceAccumulator,
  createEngine,
  defaultConfig,
  UpstreamDomain,
  EvidenceSeverity,
  PriorityTier,
  type ReprioritizationConfig,
  type EvidencePoint,
} from '../reprioritization_engine'

describe('ReprioritizationEngine TS', () => {
  describe('ReprioritizationConfig', () => {
    it('default config has sensible values', () => {
      const cfg = defaultConfig()
      expect(cfg.actionThreshold).toBe(0.3)
      expect(cfg.urgentThreshold).toBe(3.0)
      expect(cfg.highThreshold).toBe(2.0)
      expect(cfg.mediumThreshold).toBe(1.0)
      expect(cfg.lowThreshold).toBe(0.5)
      expect(cfg.churnPreventionWindowDays).toBe(7)
      expect(cfg.evidenceDecayRate).toBe(0.05)
    })

    it('defaultConfig merges overrides', () => {
      const cfg = defaultConfig({ actionThreshold: 0.5, urgentThreshold: 5.0 })
      expect(cfg.actionThreshold).toBe(0.5)
      expect(cfg.urgentThreshold).toBe(5.0)
      expect(cfg.highThreshold).toBe(2.0) // unchanged
    })
  })

  describe('createEngine factory', () => {
    it('creates engine with default config', () => {
      const engine = createEngine()
      expect(engine).toBeInstanceOf(ReprioritizationEngine)
    })

    it('creates engine with custom config', () => {
      const customCfg: ReprioritizationConfig = {
        actionThreshold: 0.9,
        churnPreventionWindowDays: 14,
        evidenceDecayRate: 0.1,
        maxTrackedPatterns: 500,
        maxEvidenceAgeDays: 60,
        urgentThreshold: 4.0,
        highThreshold: 3.0,
        mediumThreshold: 2.0,
        lowThreshold: 1.0,
        reprioritizeScoreDeltaRatio: 0.3,
      }
      const engine = createEngine(customCfg)
      expect(engine).toBeInstanceOf(ReprioritizationEngine)
    })
  })

  describe('EvidenceAccumulator', () => {
    it('records evidence and calculates weight', () => {
      const acc = new EvidenceAccumulator(defaultConfig())
      const point: EvidencePoint = {
        patternId: 'p1',
        patternType: 'memory_deficiency',
        description: 'Missing context in turn 3',
        domain: UpstreamDomain.CURATION,
        severity: EvidenceSeverity.HIGH,
        frequency: 0.8,
        confidence: 0.9,
        rootCauseHypothesis: 'Missing memory injection',
        metricsImpacted: ['coherence_score'],
        timestamp: new Date().toISOString(),
      }
      const result = acc.recordEvidence(point)
      expect(result.patternId).toBe('p1')
      expect(result.totalWeight).toBeGreaterThan(0)
      expect(result.isActionable).toBe(true)
    })

    it('non-actionable evidence below threshold', () => {
      const acc = new EvidenceAccumulator(
        defaultConfig({ actionThreshold: 10.0 }),
      )
      const point: EvidencePoint = {
        patternId: 'p2',
        patternType: 'minor_noise',
        description: 'Minor noise',
        domain: UpstreamDomain.CURATION,
        severity: EvidenceSeverity.LOW,
        frequency: 0.1,
        confidence: 0.3,
        rootCauseHypothesis: 'Noise',
        metricsImpacted: [],
        timestamp: new Date().toISOString(),
      }
      const result = acc.recordEvidence(point)
      expect(result.isActionable).toBe(false)
    })

    it('parseFeedbackReport extracts evidence from report format', () => {
      const acc = new EvidenceAccumulator(defaultConfig())
      const report = {
        failure_patterns: [
          {
            pattern_id: 'fp1',
            pattern_type: 'memory_deficiency',
            description: 'Missing memory for user',
            severity: 'high',
            frequency: 0.75,
            metrics_impacted: ['coherence'],
          },
        ],
        upstream_mappings: [
          {
            failure_pattern: { pattern_id: 'fp1' },
            upstream_domain: 'curation',
            confidence: 0.85,
            root_cause_hypothesis: 'Memory not injected',
          },
        ],
      }
      const points = acc.ingestFeedbackDict(report)
      expect(points).toHaveLength(1)
      expect(points[0].patternId).toBe('fp1')
      expect(points[0].domain).toBe(UpstreamDomain.CURATION)
      expect(points[0].severity).toBe(EvidenceSeverity.HIGH)
    })

    it('getActionablePatterns returns only actionable accumulations', () => {
      const acc = new EvidenceAccumulator(defaultConfig())
      const highPoint: EvidencePoint = {
        patternId: 'actionable1',
        patternType: 'memory_deficiency',
        description: 'Critical gap',
        domain: UpstreamDomain.PRIVACY,
        severity: EvidenceSeverity.CRITICAL,
        frequency: 1.0,
        confidence: 1.0,
        rootCauseHypothesis: 'Root',
        metricsImpacted: [],
        timestamp: new Date().toISOString(),
      }
      const lowPoint: EvidencePoint = {
        patternId: 'not_actionable1',
        patternType: 'minor',
        description: 'Minor',
        domain: UpstreamDomain.CURATION,
        severity: EvidenceSeverity.LOW,
        frequency: 0.05,
        confidence: 0.1,
        rootCauseHypothesis: 'Minor',
        metricsImpacted: [],
        timestamp: new Date().toISOString(),
      }
      acc.recordEvidence(highPoint)
      acc.recordEvidence(lowPoint)
      const actionable = acc.getActionablePatterns()
      expect(actionable.some((a) => a.patternId === 'actionable1')).toBe(true)
      expect(actionable.some((a) => a.patternId === 'not_actionable1')).toBe(
        false,
      )
    })

    it('clear removes all accumulations', () => {
      const acc = new EvidenceAccumulator(defaultConfig())
      acc.recordEvidence({
        patternId: 'temp',
        patternType: 't',
        description: 't',
        domain: UpstreamDomain.CURATION,
        severity: EvidenceSeverity.LOW,
        frequency: 0.5,
        confidence: 0.5,
        rootCauseHypothesis: 't',
        metricsImpacted: [],
        timestamp: new Date().toISOString(),
      })
      expect(acc.getAllAccumulations().size).toBe(1)
      acc.clear()
      expect(acc.getAllAccumulations().size).toBe(0)
    })

    it('summary reports correct counts', () => {
      const acc = new EvidenceAccumulator(defaultConfig())
      acc.recordEvidence({
        patternId: 'sum_p1',
        patternType: 't',
        description: 't',
        domain: UpstreamDomain.REVIEW,
        severity: EvidenceSeverity.MEDIUM,
        frequency: 0.6,
        confidence: 0.7,
        rootCauseHypothesis: 't',
        metricsImpacted: [],
        timestamp: new Date().toISOString(),
      })
      const summary = acc.summary() as Record<string, number>
      expect(summary['totalPatterns']).toBe(1)
      expect(summary['actionablePatterns']).toBe(1)
    })
  })

  describe('ReprioritizationEngine', () => {
    function makeFeedbackReport(
      patternId: string,
      severity: string,
      frequency: number,
    ) {
      return {
        failure_patterns: [
          {
            pattern_id: patternId,
            pattern_type: 'memory_deficiency',
            description: `Pattern ${patternId}`,
            severity,
            frequency,
            metrics_impacted: [],
          },
        ],
        upstream_mappings: [
          {
            failure_pattern: { pattern_id: patternId },
            upstream_domain: 'curation',
            confidence: 0.8,
            root_cause_hypothesis: 'Root cause',
          },
        ],
      } as Record<string, unknown>
    }

    it('loadFeedbackDict ingests and returns evidence points', async () => {
      const engine = new ReprioritizationEngine()
      const report = makeFeedbackReport('e1', 'high', 0.7)
      const points = engine.loadFeedbackDict(report)
      expect(points).toHaveLength(1)
      expect(points[0].patternId).toBe('e1')
    })

    it('runReprioritization creates backlog item for actionable pattern', async () => {
      const engine = new ReprioritizationEngine()
      engine.loadFeedbackDict(
        makeFeedbackReport('critical_gap', 'critical', 1.0),
      )
      const report = await engine.runReprioritization()
      expect(report.newBacklogItems.length).toBeGreaterThanOrEqual(1)
      expect(report.priorityChanges.length).toBeGreaterThanOrEqual(0)
    })

    it('CRITICAL severity produces higher score than MEDIUM', async () => {
      const criticalEngine = new ReprioritizationEngine()
      criticalEngine.loadFeedbackDict(
        makeFeedbackReport('crit1', 'critical', 1.0),
      )
      const criticalReport = await criticalEngine.runReprioritization()

      const mediumEngine = new ReprioritizationEngine()
      mediumEngine.loadFeedbackDict(makeFeedbackReport('med1', 'medium', 1.0))
      const mediumReport = await mediumEngine.runReprioritization()

      expect(criticalReport.newBacklogItems.length).toBeGreaterThan(0)
      expect(mediumReport.newBacklogItems.length).toBeGreaterThan(0)
      const criticalScore = criticalReport.newBacklogItems[0].priorityScore
      const mediumScore = mediumReport.newBacklogItems[0].priorityScore
      expect(criticalScore).toBeGreaterThan(mediumScore)
    })

    it('runReprioritization returns runId and timestamp', async () => {
      const engine = new ReprioritizationEngine()
      engine.loadFeedbackDict(makeFeedbackReport('ts1', 'medium', 0.5))
      const report = await engine.runReprioritization()
      expect(report.runId).toMatch(/^run-\d+$/)
      expect(report.timestamp).toBeTruthy()
    })

    it('getBacklog returns items sorted by priority score', async () => {
      const engine = new ReprioritizationEngine()
      engine.loadFeedbackDict(makeFeedbackReport('sort1', 'critical', 1.0))
      engine.loadFeedbackDict(makeFeedbackReport('sort2', 'low', 0.2))
      await engine.runReprioritization()
      const backlog = engine.getBacklog()
      for (let i = 1; i < backlog.length; i++) {
        expect(backlog[i - 1].priorityScore).toBeGreaterThanOrEqual(
          backlog[i].priorityScore,
        )
      }
    })

    it('getBacklogByDomain filters correctly', async () => {
      const engine = new ReprioritizationEngine()
      engine.loadFeedbackDict(
        makeFeedbackReport('privacy_issue', 'critical', 1.0),
      )
      await engine.runReprioritization()
      const privacyItems = engine.getBacklogByDomain(UpstreamDomain.PRIVACY)
      expect(
        privacyItems.every((i) => i.domain === UpstreamDomain.PRIVACY),
      ).toBe(true)
    })

    it('getPriorityChanges returns change history', async () => {
      const engine = new ReprioritizationEngine()
      engine.loadFeedbackDict(makeFeedbackReport('change1', 'critical', 1.0))
      await engine.runReprioritization()
      const changes = engine.getPriorityChanges()
      expect(Array.isArray(changes)).toBe(true)
    })

    it('addExistingBacklog loads items into engine backlog', async () => {
      const engine = new ReprioritizationEngine()
      engine.addExistingBacklog([
        {
          itemId: 'existing1',
          domain: UpstreamDomain.CURATION,
          interventionType: 'priority_change' as any,
          title: 'Existing item',
          description: 'Test',
          priorityTier: PriorityTier.MEDIUM,
          priorityScore: 1.5,
          evidencePatternIds: [],
          rootCauseHypothesis: '',
          validationCriteria: [],
          createdAt: new Date().toISOString(),
          previousPriorityTier: null,
          reasonForChange: '',
        },
      ])
      const backlog = engine.getBacklog()
      expect(backlog.some((i) => i.itemId === 'existing1')).toBe(true)
    })
  })
})
