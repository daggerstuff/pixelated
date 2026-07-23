import { describe, it, expect, beforeEach } from 'vitest'
import {
  EvidenceReportGenerator,
  REPORT_TEMPLATES,
  getEvidenceReportGenerator,
  resetEvidenceReportGenerator,
  type TemplateId,
} from '../services/EvidenceReportTemplates'
import {
  IRBExportService,
  getIRBExportService,
  resetIRBExportService,
} from '../services/IRBExportService'

describe('EvidenceReportTemplates', () => {
  describe('REPORT_TEMPLATES', () => {
    it('should have exactly 3 templates', () => {
      expect(REPORT_TEMPLATES).toHaveLength(3)
    })

    it('should include intervention-effectiveness-by-technique', () => {
      const t = REPORT_TEMPLATES.find(
        (x) => x.id === 'intervention-effectiveness-by-technique',
      )
      expect(t).toBeDefined()
      expect(t!.category).toBe('effectiveness')
      expect(t!.hypotheses).toHaveLength(3)
    })

    it('should include crisis-detection-accuracy-over-time', () => {
      const t = REPORT_TEMPLATES.find(
        (x) => x.id === 'crisis-detection-accuracy-over-time',
      )
      expect(t).toBeDefined()
      expect(t!.category).toBe('safety')
      expect(t!.hypotheses).toHaveLength(3)
    })

    it('should include therapeutic-alliance-correlation-with-outcome', () => {
      const t = REPORT_TEMPLATES.find(
        (x) => x.id === 'therapeutic-alliance-correlation-with-outcome',
      )
      expect(t).toBeDefined()
      expect(t!.category).toBe('alliance')
      expect(t!.hypotheses).toHaveLength(3)
    })

    it('should have HIPAA checklist for all templates', () => {
      for (const t of REPORT_TEMPLATES) {
        expect(t.hipaaChecklist.length).toBeGreaterThanOrEqual(8)
        expect(t.hipaaChecklist.every((item) => item.satisfied)).toBe(true)
      }
    })

    it('should have all hypotheses with required fields', () => {
      for (const t of REPORT_TEMPLATES) {
        for (const h of t.hypotheses) {
          expect(h.id).toBeTruthy()
          expect(h.statement).toBeTruthy()
          expect(h.variables.length).toBeGreaterThanOrEqual(2)
          expect(['positive', 'negative', 'neutral']).toContain(
            h.expectedDirection,
          )
          expect(h.nullHypothesis).toBeTruthy()
          expect(h.alternativeHypothesis).toBeTruthy()
        }
      }
    })
  })

  describe('EvidenceReportGenerator', () => {
    let generator: EvidenceReportGenerator

    beforeEach(() => {
      resetEvidenceReportGenerator()
      generator = getEvidenceReportGenerator()
    })

    it('should return all templates', () => {
      const templates = generator.getTemplates()
      expect(templates).toHaveLength(3)
    })

    it('should get template by id', () => {
      const t = generator.getTemplate('intervention-effectiveness-by-technique')
      expect(t).toBeDefined()
      expect(t!.id).toBe('intervention-effectiveness-by-technique')
    })

    it('should return undefined for unknown template id', () => {
      const t = generator.getTemplate('nonexistent' as TemplateId)
      expect(t).toBeUndefined()
    })

    it('should generate report from template', async () => {
      const result = await generator.generateFromTemplate(
        'intervention-effectiveness-by-technique',
      )
      expect(result.report).toBeDefined()
      expect(result.report.id).toBeTruthy()
      expect(result.report.title).toContain('Evidence Report')
      expect(result.report.findings).toHaveLength(3)
      expect(result.template.id).toBe('intervention-effectiveness-by-technique')
      expect(result.generatedAt).toBeTruthy()
    })

    it('should generate markdown from template', async () => {
      const result = await generator.generateFromTemplate(
        'crisis-detection-accuracy-over-time',
      )
      expect(result.markdown).toContain('# ')
      expect(result.markdown).toContain('## HIPAA Compliance Checklist')
      expect(result.markdown).toContain('## Hypothesis')
      expect(result.markdown).toContain('## Methodology')
      expect(result.markdown).toContain('## Findings')
      expect(result.markdown).toContain('## Conclusions')
      expect(result.markdown).toContain('## Limitations')
      expect(result.markdown).toContain('## Recommendations')
      expect(result.markdown).toContain('## References')
      expect(result.markdown).toContain('[x] Data minimization')
    })

    it('should throw for unknown template', async () => {
      await expect(
        generator.generateFromTemplate('nonexistent' as TemplateId),
      ).rejects.toThrow('Unknown template')
    })

    it('should generate from all templates', async () => {
      const results = await generator.generateAll()
      expect(results).toHaveLength(3)
      const ids = results.map((r) => r.template.id)
      expect(ids).toContain('intervention-effectiveness-by-technique')
      expect(ids).toContain('crisis-detection-accuracy-over-time')
      expect(ids).toContain('therapeutic-alliance-correlation-with-outcome')
    })

    it('should return HIPAA checklist for template', () => {
      const checklist = generator.getHipaaChecklist(
        'intervention-effectiveness-by-technique',
      )
      expect(checklist.length).toBeGreaterThanOrEqual(8)
      expect(checklist.every((item) => item.satisfied)).toBe(true)
    })

    it('should accept custom filters', async () => {
      const result = await generator.generateFromTemplate(
        'therapeutic-alliance-correlation-with-outcome',
        { customFilter: 'test-value' },
      )
      expect(result.report).toBeDefined()
    })

    it('should be a singleton', () => {
      resetEvidenceReportGenerator()
      const a = getEvidenceReportGenerator()
      const b = getEvidenceReportGenerator()
      expect(a).toBe(b)
    })
  })
})

describe('IRBExportService', () => {
  let generator: EvidenceReportGenerator
  let irbService: IRBExportService

  beforeEach(() => {
    resetEvidenceReportGenerator()
    resetIRBExportService()
    generator = getEvidenceReportGenerator()
    irbService = getIRBExportService()
  })

  it('should generate IRB export package', async () => {
    const generated = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const pkg = irbService.generatePackage(generated)
    expect(pkg.packageId).toMatch(/^irb-export-/)
    expect(pkg.generatedAt).toBeTruthy()
    expect(pkg.report).toBeDefined()
    expect(pkg.template).toBeDefined()
    expect(pkg.methodology).toBeDefined()
    expect(pkg.anonymizedDataset).toBeDefined()
    expect(pkg.auditLog).toBeDefined()
    expect(pkg.hipaaCompliance).toBeDefined()
    expect(pkg.checksum).toMatch(/^irb-/)
  })

  it('should generate methodology with required fields', async () => {
    const generated = await generator.generateFromTemplate(
      'crisis-detection-accuracy-over-time',
    )
    const pkg = irbService.generatePackage(generated)
    const m = pkg.methodology
    expect(m.studyDesign).toBeTruthy()
    expect(m.dataSources.length).toBeGreaterThanOrEqual(3)
    expect(m.inclusionCriteria.length).toBeGreaterThanOrEqual(3)
    expect(m.exclusionCriteria.length).toBeGreaterThanOrEqual(3)
    expect(m.sampleSize).toBeGreaterThan(0)
    expect(m.statisticalMethods.length).toBeGreaterThanOrEqual(3)
    expect(m.anonymizationMethods.length).toBeGreaterThanOrEqual(3)
    expect(m.privacyProtections.length).toBeGreaterThanOrEqual(3)
    expect(m.irbConsiderations.length).toBeGreaterThanOrEqual(3)
  })

  it('should generate anonymized dataset with variables', async () => {
    const generated = await generator.generateFromTemplate(
      'therapeutic-alliance-correlation-with-outcome',
    )
    const pkg = irbService.generatePackage(generated)
    const ds = pkg.anonymizedDataset
    expect(ds.recordCount).toBeGreaterThan(0)
    expect(ds.variableCount).toBeGreaterThan(0)
    expect(ds.variables.length).toBeGreaterThan(0)
    expect(ds.kAnonymity).toBeGreaterThanOrEqual(5)
    expect(ds.differentialPrivacyEpsilon).toBeGreaterThan(0)
    expect(ds.suppressionRate).toBeGreaterThanOrEqual(0)
    expect(ds.variables.every((v) => v.anonymized)).toBe(true)
  })

  it('should generate audit log structure', async () => {
    const generated = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const pkg = irbService.generatePackage(generated)
    expect(pkg.auditLog.retentionPeriod).toContain('7 years')
    expect(pkg.auditLog.accessRestrictedTo.length).toBeGreaterThan(0)
    expect(pkg.auditLog.queryCount).toBeGreaterThanOrEqual(0)
  })

  it('should generate HIPAA compliance summary', async () => {
    const generated = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const pkg = irbService.generatePackage(generated)
    const hc = pkg.hipaaCompliance
    expect(hc.checklist.length).toBeGreaterThanOrEqual(8)
    expect(hc.overallPassed).toBe(true)
    expect(hc.safeHarborMethod).toContain('Safe Harbor')
    expect(hc.deidentificationDate).toBeTruthy()
  })

  it('should export as JSON', async () => {
    const generated = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const pkg = irbService.generatePackage(generated)
    const json = irbService.exportAsJson(pkg)
    expect(json).toContain(pkg.packageId)
    expect(json).toContain('methodology')
    expect(json).toContain('anonymizedDataset')
    const parsed = JSON.parse(json)
    expect(parsed.packageId).toBe(pkg.packageId)
  })

  it('should export as markdown', async () => {
    const generated = await generator.generateFromTemplate(
      'crisis-detection-accuracy-over-time',
    )
    const pkg = irbService.generatePackage(generated)
    const md = irbService.exportAsMarkdown(pkg)
    expect(md).toContain('# IRB Export Package')
    expect(md).toContain('## 1. Methodology')
    expect(md).toContain('## 2. Anonymized Dataset')
    expect(md).toContain('## 3. Audit Log')
    expect(md).toContain('## 4. HIPAA Compliance Summary')
    expect(md).toContain(pkg.packageId)
    expect(md).toContain('Safe Harbor')
  })

  it('should generate consistent checksum for same inputs', async () => {
    const generated1 = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const generated2 = await generator.generateFromTemplate(
      'intervention-effectiveness-by-technique',
    )
    const pkg1 = irbService.generatePackage(generated1)
    const pkg2 = irbService.generatePackage(generated2)
    expect(pkg1.checksum).toBe(pkg2.checksum)
  })

  it('should be a singleton', () => {
    resetIRBExportService()
    const a = getIRBExportService()
    const b = getIRBExportService()
    expect(a).toBe(b)
  })
})
