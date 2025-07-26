import axe from 'axe-core'
import type { AxeResults, RunOptions, Result } from 'axe-core'
import type { Page } from '@playwright/test'

// Impact levels from most severe to least severe
const IMPACT_LEVELS = ['critical', 'serious', 'moderate', 'minor'] as const
type ImpactLevel = (typeof IMPACT_LEVELS)[number]

// Types for the enhanced violations
export interface EnhancedViolation {
  id: string
  impact: string
  description: string
  helpUrl: string
  nodes: Array<{ html: string }>
  wcagCriteria?: string[]
}

interface Image {
  src: string
  id: string
  class: string
}

interface FormField {
  tagName: string
  type: string
  id: string
  name: string
  placeholder: string
}

interface InteractiveElement {
  tagName: string
  id: string
  class: string
  href: string
  innerHtml: string
}

interface TabIndexElement {
  tagName: string
  id: string
  tabindex: string
}

interface RoleElement {
  tagName: string
  role: string
  id: string
}

interface HeadingElement {
  level: number
  text: string
  id: string
}

// WCAG to axe-core rule mapping
const WCAG_MAP: Record<string, string[]> = {
  'aria-hidden-focusable': ['2.4.3'],
  'aria-roles': ['4.1.2'],
  'aria-required-attr': ['4.1.2'],
  'aria-required-children': ['1.3.1'],
  'aria-required-parent': ['1.3.1'],
  'aria-valid-attr': ['4.1.2'],
  'aria-valid-attr-value': ['4.1.2'],
  'button-name': ['4.1.2'],
  'document-title': ['2.4.2'],
  'frame-title': ['4.1.2'],
  'image-alt': ['1.1.1'],
  'input-button-name': ['4.1.2'],
  'input-image-alt': ['1.1.1'],
  'label': ['3.3.2'],
  'link-name': ['4.1.2'],
  // Add more mappings as needed
}

/**
 * Enhances axe-core violations with additional information like WCAG criteria
 */
export function enhanceViolations(violations: Result[]): EnhancedViolation[] {
  return violations.map((violation) => {
    return {
      id: violation.id,
      impact: violation.impact || 'minor',
      description: violation.description,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({ html: node.html })),
      wcagCriteria: WCAG_MAP[violation.id],
    }
  })
}

/**
 * Filters violations based on minimum impact level
 */
export function filterViolationsByImpact(
  violations: EnhancedViolation[],
  minimumImpact: string,
): EnhancedViolation[] {
  // If no minimum impact specified, return all violations
  if (!minimumImpact) {
    return violations
  }

  // Find the index of the minimum impact in our ordered array
  const minimumImpactIndex = IMPACT_LEVELS.indexOf(minimumImpact as ImpactLevel)

  // Filter violations that have an equal or more severe impact
  return violations.filter((violation) => {
    const violationImpactIndex = IMPACT_LEVELS.indexOf(
      violation.impact as ImpactLevel,
    )
    // Lower index means more severe
    return violationImpactIndex <= minimumImpactIndex
  })
}

/**
 * Formats violations for a text report
 */
export function formatViolationsForReport(
  violations: EnhancedViolation[],
): string {
  if (violations.length === 0) {
    return 'No accessibility violations found.'
  }

  let report = `Found ${violations.length} accessibility violations:\n\n`

  violations.forEach((violation, index) => {
    report += `${index + 1}. ${violation.description} (${violation.impact})\n`
    report += `   Rule: ${violation.id}\n`

    if (violation.wcagCriteria && violation.wcagCriteria.length > 0) {
      report += `   WCAG: ${violation.wcagCriteria.join(', ')}\n`
    }

    report += `   Help: ${violation.helpUrl}\n`

    if (violation.nodes.length > 0) {
      report += `   Affected elements (${violation.nodes.length}):\n`
      violation.nodes.forEach((node, nodeIndex) => {
        if (nodeIndex < 3) {
          // Limit to 3 nodes to keep report manageable
          report += `     - ${node.html}\n`
        }
      })

      if (violation.nodes.length > 3) {
        report += `     ... and ${violation.nodes.length - 3} more\n`
      }
    }

    report += '\n'
  })

  return report
}

/**
 * Checks the accessibility of a container element using axe-core
 */
export async function checkAccessibilityViolations(
  container: Element,
  options: {
    impactLevel?: string
    rules?: { [key: string]: { enabled: boolean } }
  } = {},
): Promise<EnhancedViolation[]> {
  const { impactLevel = 'minor', rules = {} } = options

  // Configure axe options
  const axeOptions: RunOptions = {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
    rules,
  }

  // Run axe analysis
  const results = (await axe.run(
    container as unknown as Element,
    axeOptions as unknown as RunOptions,
  )) as unknown as AxeResults

  // Enhance violations with WCAG criteria
  const enhancedViolations = enhanceViolations(results.violations)

  // Filter by impact level
  return filterViolationsByImpact(enhancedViolations, impactLevel)
}

/**
 * Checks if an element is accessible to screen readers
 */
export function isAccessibleToScreenReaders(element: Element): boolean {
  // Check if element is hidden from screen readers
  if (element.getAttribute('aria-hidden') === 'true') {
    return false
  }

  // Check for role="presentation" or role="none"
  const role = element.getAttribute('role')
  if (role === 'presentation' || role === 'none') {
    return false
  }

  // Check for zero-width or invisible text
  const styles = window.getComputedStyle(element)
  if (
    styles.fontSize === '0px' ||
    styles.width === '0px' ||
    styles.height === '0px' ||
    styles.opacity === '0' ||
    styles.display === 'none' ||
    styles.visibility === 'hidden'
  ) {
    return false
  }

  // Special checks for images
  if (element.tagName.toLowerCase() === 'img') {
    const alt = element.getAttribute('alt')
    // If alt is null or empty and not presentation, it's not accessible
    if (
      (!alt || alt.trim() === '') &&
      role !== 'presentation' &&
      role !== 'none'
    ) {
      return false
    }
  }

  // Check for interactive elements without accessible name
  if (
    (element.tagName.toLowerCase() === 'button' ||
      element.tagName.toLowerCase() === 'a' ||
      (element.hasAttribute('role') &&
        ['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab'].includes(
          element.getAttribute('role') || '',
        ))) &&
    !element.hasAttribute('aria-label') &&
    !element.hasAttribute('aria-labelledby') &&
    (element.textContent || '').trim() === ''
  ) {
    return false
  }

  return true
}

/**
 * Checks color contrast of an element
 */
export function checkColorContrast(element: Element): {
  passes: boolean
  ratio?: number
  required: number
  fontSize: string
  fontWeight: string
} {
  const styles = window.getComputedStyle(element)
  const fontSize = parseInt(styles.fontSize, 10)
  const { fontWeight } = styles

  // Determine if this is large text
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= '700')

  // Required contrast ratio based on text size
  const required = isLargeText ? 3.0 : 4.5

  // Get colors
  const foreground = styles.color
  const background = styles.backgroundColor

  // Parse colors to RGB
  const fgRgb = parseRgb(foreground)
  const bgRgb = parseRgb(background)

  // If we can't parse the colors, we can't determine contrast
  if (!fgRgb || !bgRgb) {
    return {
      passes: false,
      required,
      fontSize: styles.fontSize,
      fontWeight,
    }
  }

  // Calculate contrast ratio
  const ratio = calculateContrastRatio(bgRgb, fgRgb)

  return {
    passes: ratio >= required,
    ratio,
    required,
    fontSize: styles.fontSize,
    fontWeight,
  }
}

/**
 * Checks for screen reader issues on a page
 */
export async function checkScreenReaderIssues(page: Page): Promise<{
  hasIssues: boolean
  issues: Array<{
    type: string
    description: string
    element: string
  }>
}> {
  const issues: Array<{
    type: string
    description: string
    element: string
  }> = []

  // Check for images without alt text
  const imagesWithoutAlt = await page.$$eval(
    'img:not([alt])',
    (images: Element[]) => {
      return images.map((img) => ({
        src: (img as HTMLImageElement).getAttribute('src') || '',
        id: img.id || '',
        class: img.className || '',
      }))
    },
  )

  imagesWithoutAlt.forEach((img: Image) => {
    issues.push({
      type: 'missing-alt',
      description: 'Image is missing alt text',
      element: `<img src="${img.src}" id="${img.id}" class="${img.class}">`,
    })
  })

  // Check for form controls without labels
  const formsWithoutLabels = await page.$$eval(
    'input:not([type="hidden"]):not([aria-label]):not([aria-labelledby]), select:not([aria-label]):not([aria-labelledby]), textarea:not([aria-label]):not([aria-labelledby])',
    (elements: Element[]) => {
      return elements
        .filter((el) => {
          const { id } = el
          if (!id) {
            return true
          } // No ID means no label can be associated

          // Check if there's a label with a matching 'for' attribute
          const hasLabelFor =
            document.querySelector(`label[for="${id}"]`) !== null
          return !hasLabelFor
        })
        .map((el) => ({
          tagName: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          id: el.id || '',
          name: el.getAttribute('name') || '',
          placeholder: el.getAttribute('placeholder') || '',
        }))
    },
  )

  formsWithoutLabels.forEach((field: FormField) => {
    issues.push({
      type: 'missing-label',
      description: 'Form control has no accessible label',
      element: `<${field.tagName}${field.type ? ' type="' + field.type + '"' : ''} id="${field.id}" name="${field.name}" placeholder="${field.placeholder}">`,
    })
  })

  // Check for interactive elements without accessible names
  const emptyInteractives = await page.$$eval(
    'button:not([aria-label]):not([aria-labelledby]), a:not([aria-label]):not([aria-labelledby])',
    (elements: Element[]) => {
      return elements
        .filter((el) => {
          // Empty text content
          const textContent = el.textContent?.trim() || ''
          if (textContent !== '') {
            return false
          }

          // No title attribute
          if (el.hasAttribute('title')) {
            return false
          }

          // Check for child img with alt text
          const img = el.querySelector('img[alt]:not([alt=""])')
          if (img) {
            return false
          }

          return true
        })
        .map((el) => ({
          tagName: el.tagName.toLowerCase(),
          id: el.id || '',
          class: el.className || '',
          href: el.getAttribute('href') || '',
          innerHtml: el.innerHTML,
        }))
    },
  )

  emptyInteractives.forEach((el: InteractiveElement) => {
    issues.push({
      type: 'empty-interactive',
      description: `${el.tagName} has no accessible name`,
      element: `<${el.tagName} id="${el.id}" class="${el.class}"${el.href ? ' href="' + el.href + '"' : ''}>${el.innerHtml}</${el.tagName}>`,
    })
  })

  // Check for positive tabindex
  const positiveTabIndex = await page.$$eval(
    '[tabindex]:not([tabindex="-1"]):not([tabindex="0"])',
    (elements: Element[]) => {
      return elements.map((el) => ({
        tagName: el.tagName.toLowerCase(),
        id: el.id || '',
        tabindex: el.getAttribute('tabindex') || '',
      }))
    },
  )

  positiveTabIndex.forEach((el: TabIndexElement) => {
    issues.push({
      type: 'positive-tabindex',
      description: `Element has tabindex=${el.tabindex}, which disrupts natural tab order`,
      element: `<${el.tagName} tabindex="${el.tabindex}" id="${el.id}">`,
    })
  })

  // Check ARIA roles
  const incorrectRoles = await page.$$eval('[role]', (elements: Element[]) => {
    const validRoles = [
      'alert',
      'alertdialog',
      'application',
      'article',
      'banner',
      'button',
      'cell',
      'checkbox',
      'columnheader',
      'combobox',
      'complementary',
      'contentinfo',
      'definition',
      'dialog',
      'directory',
      'document',
      'feed',
      'figure',
      'form',
      'grid',
      'gridcell',
      'group',
      'heading',
      'img',
      'link',
      'list',
      'listbox',
      'listitem',
      'log',
      'main',
      'marquee',
      'math',
      'menu',
      'menubar',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'navigation',
      'none',
      'note',
      'option',
      'presentation',
      'progressbar',
      'radio',
      'radiogroup',
      'region',
      'row',
      'rowgroup',
      'rowheader',
      'scrollbar',
      'search',
      'searchbox',
      'separator',
      'slider',
      'spinbutton',
      'status',
      'switch',
      'tab',
      'table',
      'tablist',
      'tabpanel',
      'term',
      'textbox',
      'timer',
      'toolbar',
      'tooltip',
      'tree',
      'treegrid',
      'treeitem',
    ]

    return elements
      .filter((el) => {
        const role = el.getAttribute('role')
        return role && !validRoles.includes(role)
      })
      .map((el) => ({
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        id: el.id || '',
      }))
  })

  incorrectRoles.forEach((el: RoleElement) => {
    issues.push({
      type: 'incorrect-role',
      description: `Element has potentially incorrect role="${el.role}" for tag <${el.tagName}>`,
      element: `<${el.tagName} role="${el.role}" id="${el.id}">`,
    })
  })

  // Check heading hierarchy
  const headingHierarchy = await page.$$eval(
    'h1, h2, h3, h4, h5, h6',
    (elements: Element[]) => {
      return elements.map((el) => ({
        level: parseInt(el.tagName.substring(1), 10),
        text: el.textContent?.trim() || '',
        id: el.id || '',
      }))
    },
  )

  let previousLevel = 0

  headingHierarchy.forEach((heading: HeadingElement, index: number) => {
    // First heading should ideally be h1
    if (index === 0 && heading.level !== 1) {
      issues.push({
        type: 'heading-hierarchy',
        description: `Page doesn't start with an h1 heading (found h${heading.level} "${heading.text}")`,
        element: `<h${heading.level} id="${heading.id}">${heading.text}</h${heading.level}>`,
      })
    }

    // Heading levels shouldn't skip (e.g., h1 to h3)
    if (heading.level > previousLevel + 1 && index > 0) {
      issues.push({
        type: 'heading-hierarchy',
        description: `Heading level skipped from h${previousLevel} to h${heading.level} ("${heading.text}")`,
        element: `<h${heading.level} id="${heading.id}">${heading.text}</h${heading.level}>`,
      })
    }

    previousLevel = heading.level
  })

  return {
    hasIssues: issues.length > 0,
    issues,
  }
}

/**
 * Checks the heading hierarchy of a page
 */
export async function checkHeadingHierarchy(page: Page): Promise<{
  isValid: boolean
  issues: Array<{ type: string; description: string; element: string }>
}> {
  const issues: Array<{ type: string; description: string; element: string }> =
    []

  // Get all headings
  const headings = await page.$$eval(
    'h1, h2, h3, h4, h5, h6',
    (elements: Element[]) => {
      return elements.map((el) => ({
        level: parseInt(el.tagName.substring(1), 10),
        text: el.textContent?.trim() || '',
        id: el.id || '',
      }))
    },
  )

  // No headings found
  if (headings.length === 0) {
    issues.push({
      type: 'heading-hierarchy',
      description: 'No headings found on the page',
      element: 'document',
    })
    return { isValid: false, issues }
  }

  // Check if the first heading is h1
  if (headings[0].level !== 1) {
    issues.push({
      type: 'heading-hierarchy',
      description: `Page should start with an h1, but starts with h${headings[0].level}`,
      element: `<h${headings[0].level} id="${headings[0].id}">${headings[0].text}</h${headings[0].level}>`,
    })
  }

  // Check for skipped levels
  let previousLevel = headings[0].level

  for (let i = 1; i < headings.length; i++) {
    const heading = headings[i]

    // Can't skip levels (e.g., h1 to h3)
    if (heading.level > previousLevel + 1) {
      issues.push({
        type: 'heading-hierarchy',
        description: `Heading level skipped from h${previousLevel} to h${heading.level}`,
        element: `<h${heading.level} id="${heading.id}">${heading.text}</h${heading.level}>`,
      })
    }

    previousLevel = heading.level
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}

// Helper function to parse RGB color strings
function parseRgb(color: string): [number, number, number] | null {
  // Handle 'rgb(r, g, b)' format
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ]
  }

  // Handle 'rgba(r, g, b, a)' format
  const rgbaMatch = color.match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/i,
  )
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10),
    ]
  }

  // Could add more formats like hex (#RRGGBB) if needed

  return null
}

// Calculate contrast ratio between two RGB colors
function calculateContrastRatio(
  background: [number, number, number],
  foreground: [number, number, number],
): number {
  const bgLuminance = calculateRelativeLuminance(background)
  const fgLuminance = calculateRelativeLuminance(foreground)

  const lighter = Math.max(bgLuminance, fgLuminance)
  const darker = Math.min(bgLuminance, fgLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

// Calculate relative luminance of an RGB color
function calculateRelativeLuminance([r, g, b]: [
  number,
  number,
  number,
]): number {
  // Convert RGB to relative luminance
  const [R, G, B] = [r, g, b].map((val) => {
    val /= 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  // Formula based on WCAG 2.0
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export const accessibilityMatchers = {
  toHaveNoViolations: async (container: Element) => {
    const violations = await checkAccessibilityViolations(container)

    if (violations.length === 0) {
      return {
        pass: true,
        message: () => 'Expected the HTML to have accessibility violations',
      }
    }

    return {
      pass: false,
      message: () => formatViolationsForReport(violations),
    }
  },

  toHaveProperColorContrast: (element: Element) => {
    const contrastCheck = checkColorContrast(element)

    if (contrastCheck.passes) {
      return {
        pass: true,
        message: () =>
          `Expected element to fail color contrast check, but it passed with ratio ${contrastCheck.ratio}:1 (required ${contrastCheck.required}:1)`,
      }
    }

    return {
      pass: false,
      message: () =>
        `Color contrast check failed. Ratio: ${contrastCheck.ratio}:1, Required: ${contrastCheck.required}:1 for ${contrastCheck.fontSize} text with weight ${contrastCheck.fontWeight}`,
    }
  },

  toBeAccessibleToScreenReaders: (element: Element) => {
    const isAccessible = isAccessibleToScreenReaders(element)

    if (isAccessible) {
      return {
        pass: true,
        message: () =>
          'Expected element not to be accessible to screen readers, but it is',
      }
    }

    return {
      pass: false,
      message: () => 'Element is not accessible to screen readers',
    }
  },

  toHaveValidHeadingStructure: async (page: Page) => {
    const headingCheck = await checkHeadingHierarchy(page)

    if (headingCheck.isValid) {
      return {
        pass: true,
        message: () =>
          'Expected page to have invalid heading structure, but it has valid heading hierarchy',
      }
    }

    return {
      pass: false,
      message: () =>
        'Page has invalid heading structure:\n' +
        headingCheck.issues.map((issue) => issue.description).join('\n'),
    }
  },
}
