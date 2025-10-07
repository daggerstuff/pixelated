import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Impact levels from most severe to least severe
const IMPACT_LEVELS = ['critical', 'serious', 'moderate', 'minor']

// Pages to test for accessibility
const CRITICAL_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Documentation', path: '/docs' },
  { name: 'API', path: '/api' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Accessibility Statement', path: '/accessibility' },
]

// WCAG to axe-core rule mapping
const WCAG_MAPPING: Record<string, string[]> = {
  // Perceivable
  'aria-hidden-focus': ['1.3.1', '4.1.2'],
  'aria-input-field-name': ['1.3.1', '4.1.2'],
  'color-contrast': ['1.4.3'],
  'document-title': ['2.4.2'],
  'image-alt': ['1.1.1'],
  'link-name': ['2.4.4', '4.1.2'],
  'list': ['1.3.1'],
  'meta-viewport': ['1.4.4'],
  'table-fake-caption': ['1.3.1'],

  // Operable
  'button-name': ['2.4.4', '4.1.2'],
  'frame-title': ['2.4.1', '4.1.2'],
  'html-has-lang': ['3.1.1'],
  'html-lang-valid': ['3.1.1'],
  'keyboard': ['2.1.1'],
  'tabindex': ['2.4.3'],

  // Understandable
  'definition-list': ['1.3.1'],
  'dlitem': ['1.3.1'],
  'duplicate-id': ['4.1.1'],
  'label': ['1.3.1', '3.3.2', '4.1.2'],
  'landmark-one-main': ['1.3.1', '2.4.1'],

  // Robust
  'aria-allowed-attr': ['4.1.2'],
  'aria-required-attr': ['4.1.2'],
  'aria-required-children': ['1.3.1', '4.1.2'],
  'aria-required-parent': ['1.3.1', '4.1.2'],
  'aria-roles': ['1.3.1', '4.1.2'],
  'aria-valid-attr': ['4.1.2'],
  'aria-valid-attr-value': ['4.1.2'],
}

// Enhanced violation interface
interface EnhancedViolation {
  id: string
  impact: string
  description: string
  helpUrl: string
  nodes: Array<{ html: string }>
  wcagCriteria?: string[]
}

// Format violations with WCAG criteria
function enhanceViolations(violations: any[]): EnhancedViolation[] {
  return violations.map((violation) => {
    const enhanced = violation as EnhancedViolation
    enhanced.wcagCriteria = WCAG_MAPPING[violation.id] || []
    return enhanced
  })
}

// Filter violations by impact level
function filterViolationsByImpact(
  violations: EnhancedViolation[],
  minimumImpact: string,
): EnhancedViolation[] {
  const minimumImpactIndex = IMPACT_LEVELS.indexOf(minimumImpact)
  if (minimumImpactIndex === -1) {
    return violations
  }

  return violations.filter((violation) => {
    if (!violation.impact) {
      return false
    }
    const violationImpactIndex = IMPACT_LEVELS.indexOf(violation.impact)
    return violationImpactIndex <= minimumImpactIndex
  })
}

// Generate a human-readable report of violations
function formatViolationsForReport(violations: EnhancedViolation[]): string {
  if (violations.length === 0) {
    return 'No accessibility violations found.'
  }

  const report = violations
    .map((violation) => {
      const wcagInfo = violation.wcagCriteria?.length
        ? `(WCAG ${violation.wcagCriteria.join(', ')})`
        : ''

      const nodeInfo = violation.nodes
        .map((node, i) => {
          return `\n  ${i + 1}) ${node.html}`
        })
        .join('')

      return [
        `${violation.impact.toUpperCase()}: ${violation.id} ${wcagInfo}`,
        `  Description: ${violation.description}`,
        `  Help: ${violation.helpUrl}`,
        `  Elements:${nodeInfo}`,
      ].join('\n')
    })
    .join('\n\n')

  return `Found ${violations.length} accessibility violation(s):\n\n${report}`
}

test.describe('Accessibility Tests - Critical Pages', () => {
  // Test each critical page for accessibility
  for (const page of CRITICAL_PAGES) {
    test(`${page.name} page should not have critical accessibility violations`, async ({
      page: pageContext,
    }) => {
      await pageContext.goto(page.path)

      // Wait for the page to be fully loaded
      await pageContext.waitForLoadState('networkidle')

      // Run axe on the page
      const axeResults = await new AxeBuilder({ page: pageContext })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Enhance violations with WCAG criteria
      const enhancedViolations = enhanceViolations(axeResults.violations)

      // Filter for critical violations
      const criticalViolations = filterViolationsByImpact(
        enhancedViolations,
        'critical',
      )

      // Generate violation report
      if (criticalViolations.length > 0) {
        console.log(formatViolationsForReport(criticalViolations))
      }

      // Assert no critical violations
      expect(criticalViolations.length).toBe(0)
    })

    test(`${page.name} page should not have serious accessibility violations`, async ({
      page: pageContext,
    }) => {
      await pageContext.goto(page.path)

      // Wait for the page to be fully loaded
      await pageContext.waitForLoadState('networkidle')

      // Run axe on the page
      const axeResults = await new AxeBuilder({ page: pageContext })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Enhance violations with WCAG criteria
      const enhancedViolations = enhanceViolations(axeResults.violations)

      // Filter for serious violations
      const seriousViolations = filterViolationsByImpact(
        enhancedViolations,
        'serious',
      )

      // Generate violation report
      if (seriousViolations.length > 0) {
        console.log(formatViolationsForReport(seriousViolations))
      }

      // Assert no serious violations
      expect(seriousViolations.length).toBe(0)
    })

    test(`${page.name} page should report moderate and minor accessibility issues`, async ({
      page: pageContext,
    }) => {
      await pageContext.goto(page.path)

      // Wait for the page to be fully loaded
      await pageContext.waitForLoadState('networkidle')

      // Run axe on the page
      const axeResults = await new AxeBuilder({ page: pageContext })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Enhance violations with WCAG criteria
      const enhancedViolations = enhanceViolations(axeResults.violations)

      // Filter for moderate and minor violations
      const moderateViolations = filterViolationsByImpact(
        enhancedViolations,
        'moderate',
      ).filter((v) => v.impact === 'moderate')
      const minorViolations = filterViolationsByImpact(
        enhancedViolations,
        'minor',
      ).filter((v) => v.impact === 'minor')

      // Log moderate and minor violations (these don't fail the tests)
      if (moderateViolations.length > 0) {
        console.log(
          `\n==== MODERATE ISSUES (${moderateViolations.length}) ====`,
        )
        console.log(formatViolationsForReport(moderateViolations))
      }

      if (minorViolations.length > 0) {
        console.log(`\n==== MINOR ISSUES (${minorViolations.length}) ====`)
        console.log(formatViolationsForReport(minorViolations))
      }

      // This test always passes, it's just for reporting
      expect(true).toBe(true)
    })
  }
})
