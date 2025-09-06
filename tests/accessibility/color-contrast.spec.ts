import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Important pages to test for color contrast issues
const PAGES_TO_TEST = [
  { name: 'Home', path: '/' },
  { name: 'Documentation', path: '/docs' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Authentication', path: '/login' },
  { name: 'Accessibility Statement', path: '/accessibility' },
]

// Critical UI components that need good contrast
const CRITICAL_COMPONENTS = [
  '.navbar', // Navigation
  'main h1, main h2, main h3, main h4, main h5, main h6', // Headings
  '.btn, button, [role="button"]', // Buttons and button-like elements
  'a', // Links
  'input, select, textarea', // Form controls
  '.form-label, label', // Form labels
  '.alert, [role="alert"]', // Alerts and notifications
  '.card', // Card elements
  '[class*="text-"], [class*="text"]', // Text elements with text-* classes
  '[class*="notice"], [class*="message"]', // Notification/message elements
  'footer', // Footer content
  'thead, tbody, td, th', // Table elements
  '.tabs, [role="tablist"]', // Tab interfaces
  '.pagination', // Pagination controls
]

// Define interfaces for better type safety
interface ContrastInfo {
  element: string;
  textContent: string;
  fontSize: string;
  fontWeight: string;
  fgColor: string;
  bgColor: string;
  contrastRatio?: number;
  requiredRatio?: number;
  hasValidContrast: boolean;
  skip: boolean;
}

interface HoverContrastInfo {
  color: string;
  bgColor: string;
  contrastRatio?: number;
  hasValidContrast: boolean;
  skip: boolean;
  states: Record<string, any>;
}

interface FocusContrastInfo extends HoverContrastInfo {
  hasFocusOutline: boolean;
  focusOutlineColor: string | null;
  outlineContrastRatio?: number;
  outlineHasValidContrast: boolean;
}

test.describe('Color Contrast Accessibility Tests', () => {
  for (const page of PAGES_TO_TEST) {
    test(`${page.name} page should have sufficient color contrast`, async ({
      page: pageContext,
    }) => {
      await pageContext.goto(page.path)

      // Wait for page to load fully
      await pageContext.waitForLoadState('networkidle')

      // Run axe analysis focusing on color contrast
      const axeResults = await new AxeBuilder({ page: pageContext })
        .withTags(['wcag2aa']) // Level AA requires 4.5:1 contrast for normal text, 3:1 for large text
        .include(['color-contrast'])
        .analyze()

      // Check if there are any color contrast violations
      const contrastViolations = axeResults.violations.filter(
        (violation) => violation.id === 'color-contrast',
      )

      if (contrastViolations.length > 0) {
        console.warn(
          `Found ${contrastViolations.length} color contrast violations on ${page.name} page:`,
        )

        contrastViolations.forEach((violation: any) => {
          console.warn(`${violation.description}:`)
          violation.nodes.forEach((node: any, i: number) => {
            console.warn(`  ${i + 1}. ${node.html}`)

            if (node.any) {
              const contrastData = node.any.find(
                (check: any) => check.id === 'color-contrast',
              )
              if (contrastData && contrastData.data) {
                console.warn(`     Foreground: ${contrastData.data.fgColor}`)
                console.warn(`     Background: ${contrastData.data.bgColor}`)
                console.warn(
                  `     Contrast ratio: ${contrastData.data.contrastRatio}:1 (required: ${contrastData.data.expectedContrastRatio}:1)`,
                )
                console.warn(`     Element: ${node.target}`)
              }
            }
          })
        })
      }

      expect(contrastViolations.length).toBe(0)
      console.log(`Found ${contrastViolations.length} color contrast violations on ${page.name} page`)

      // Manual check of critical components
      for (const selector of CRITICAL_COMPONENTS) {
        const elements = await pageContext.$$(selector)

        // Skip empty selectors
        if (elements.length === 0) {
          continue
        }

        // Check each element
        for (const element of elements) {
          // Skip invisible elements
          const isVisible = await element.isVisible()
          if (!isVisible) {
            continue
          }

          // Get styling information
          const contrastInfo = await pageContext.evaluate((el) => {
            const style = window.getComputedStyle(el)
            const bgColor = style.backgroundColor
            const { color, fontSize, fontWeight } = style
            const textContent = (el.textContent || '').trim().substring(0, 50)

            // Parse RGB components and calculate contrast ratio
            function parseRgb(colorString: string) {
              // Handle 'rgb(r, g, b)' format
              const rgbMatch = colorString.match(
                /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i,
              )
              if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
                return [
                  parseInt(rgbMatch[1], 10),
                  parseInt(rgbMatch[2], 10),
                  parseInt(rgbMatch[3], 10),
                ]
              }

              // Handle 'rgba(r, g, b, a)' format
              const rgbaMatch = colorString.match(
                /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/i,
              )
              if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
                return [
                  parseInt(rgbaMatch[1], 10),
                  parseInt(rgbaMatch[2], 10),
                  parseInt(rgbaMatch[3], 10),
                ]
              }

              return null
            }

            function calculateLuminance(rgb: number[] | null) {
              if (!rgb) {
                return 0
              }
              const r = rgb[0]
              const g = rgb[1]
              const b = rgb[2]

              const sRGB = [r, g, b].map((v) => {
                if (v === undefined) {
                  return 0
                }
                const val = v / 255
                return val <= 0.03928
                  ? val / 12.92
                  : Math.pow((val + 0.055) / 1.055, 2.4)
              })

              if (sRGB[0] === undefined || sRGB[1] === undefined || sRGB[2] === undefined) {
                return 0
              }

              return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
            }

            function calculateContrastRatio(bg: number[] | null, fg: number[] | null) {
              if (!bg || !fg) {
                return 0
              }

              const bgLuminance = calculateLuminance(bg)
              const fgLuminance = calculateLuminance(fg)

              const lighter = Math.max(bgLuminance, fgLuminance)
              const darker = Math.min(bgLuminance, fgLuminance)

              return (lighter + 0.05) / (darker + 0.05)
            }

            const bgRgb = parseRgb(bgColor)
            const fgRgb = parseRgb(color)

            // Skip elements with transparent backgrounds or those we can't parse
            if (!bgRgb || !fgRgb) {
              return { hasValidContrast: true, skip: true } as ContrastInfo
            }

            const contrastRatio = calculateContrastRatio(bgRgb, fgRgb)

            // Determine required contrast ratio based on text size
            // 4.5:1 for normal text, 3:1 for large text
            const fontSizeNum = parseFloat(fontSize)
            const isBold = parseInt(fontWeight) >= 700
            const isLargeText =
              fontSizeNum >= 18 || (fontSizeNum >= 14 && isBold)

            const requiredRatio = isLargeText ? 3.0 : 4.5

            return {
              element: el.tagName.toLowerCase(),
              textContent,
              fontSize,
              fontWeight,
              fgColor: color,
              bgColor: bgColor,
              contrastRatio,
              requiredRatio,
              hasValidContrast: contrastRatio >= requiredRatio,
              skip: false,
            } as ContrastInfo
          }, element)

          // Skip elements we couldn't analyze
          if (contrastInfo.skip) {
            continue
          }

          // Log detailed info for failing elements
          if (!contrastInfo.hasValidContrast) {
            console.warn(`Contrast issue found in ${page.name} page:`)
            console.warn(
              `  Element: <${contrastInfo.element}> with text "${contrastInfo.textContent}"`,
            )
            console.warn(`  Foreground color: ${contrastInfo.fgColor}`)
            console.warn(`  Background color: ${contrastInfo.bgColor}`)
            console.warn(
              `  Font size: ${contrastInfo.fontSize}, weight: ${contrastInfo.fontWeight}`,
            )
            console.warn(
              `  Contrast ratio: ${contrastInfo.contrastRatio?.toFixed(2)}:1 (required: ${contrastInfo.requiredRatio}:1)`,
            )
          }

          expect(contrastInfo.hasValidContrast).toBe(true)
          console.log(`Insufficient contrast ratio (${contrastInfo.contrastRatio?.toFixed(2)}:1) for element with text "${contrastInfo.textContent}"`)
        }
      }
    })
  }

  // Test for hover and focus states
  test('Interactive elements should have sufficient contrast in hover and focus states', async ({
    page,
  }) => {
    // For testing hover states, we'll go to the component page that should have all UI elements
    await page.goto('/docs')
    await page.waitForLoadState('networkidle')

    // Test hover states on links
    const links = await page.$$('a:not([role])') // Regular links, not those with other roles

    for (const link of links.slice(0, 5)) {
      // Test first 5 links to avoid too many tests
      const isVisible = await link.isVisible()
      if (!isVisible) {
        continue
      }

      // Check contrast in normal state
      const normalContrast = await page.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          color: style.color,
          bgColor: style.backgroundColor,
        }
      }, link)

      // Hover over the link
      await link.hover()

      // Wait a bit for any transitions to complete
      await page.waitForTimeout(300)

      // Check contrast in hover state
      const hoverContrast = await page.evaluate((el) => {
        function parseRgb(colorString: string) {
          const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i)
          if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
            return [
              parseInt(rgbMatch[1], 10),
              parseInt(rgbMatch[2], 10),
              parseInt(rgbMatch[3], 10),
            ]
          }

          const rgbaMatch = colorString.match(
            /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i,
          )
          if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
            return [
              parseInt(rgbaMatch[1], 10),
              parseInt(rgbaMatch[2], 10),
              parseInt(rgbaMatch[3], 10),
            ]
          }

          return null
        }

        function calculateLuminance(rgb: number[] | null) {
          if (!rgb) {
            return 0
          }
          const r = rgb[0]
          const g = rgb[1]
          const b = rgb[2]

          const sRGB = [r, g, b].map((v) => {
            if (v === undefined) {
              return 0
            }
            const val = v / 255
            return val <= 0.03928
              ? val / 12.92
              : Math.pow((val + 0.055) / 1.055, 2.4)
          })

          if (sRGB[0] === undefined || sRGB[1] === undefined || sRGB[2] === undefined) {
            return 0
          }

          return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
        }

        function calculateContrastRatio(bg: number[] | null, fg: number[] | null) {
          if (!bg || !fg) {
            return 0
          }
          const bgLuminance = calculateLuminance(bg)
          const fgLuminance = calculateLuminance(fg)

          const lighter = Math.max(bgLuminance, fgLuminance)
          const darker = Math.min(bgLuminance, fgLuminance)

          return (lighter + 0.05) / (darker + 0.05)
        }

        const style = window.getComputedStyle(el)
        const bgRgb = parseRgb(style.backgroundColor)
        const fgRgb = parseRgb(style.color)

        // Skip elements with transparent backgrounds or those we can't parse
        if (!bgRgb || !fgRgb) {
          return { 
            hasValidContrast: true, 
            skip: true, 
            states: {},
            color: style.color,
            bgColor: style.backgroundColor
          } as HoverContrastInfo
        }

        const contrastRatio = calculateContrastRatio(bgRgb, fgRgb)
        const requiredRatio = 4.5 // For normal text

        return {
          color: style.color,
          bgColor: style.backgroundColor,
          contrastRatio,
          hasValidContrast: contrastRatio >= requiredRatio,
          skip: false,
          states: {}
        } as HoverContrastInfo
      }, link)

      // If the colors changed, check if the contrast is still sufficient
      if (
        normalContrast.color !== hoverContrast.color ||
        normalContrast.bgColor !== hoverContrast.bgColor
      ) {
        if (!hoverContrast.skip && !hoverContrast.hasValidContrast) {
          console.warn(`Hover state contrast issue found for link:`)
          console.warn(
            `  Normal state - Foreground: ${normalContrast.color}, Background: ${normalContrast.bgColor}`,
          )
          console.warn(
            `  Hover state - Foreground: ${hoverContrast.color}, Background: ${hoverContrast.bgColor}`,
          )
          console.warn(
            `  Contrast ratio: ${hoverContrast.contrastRatio?.toFixed(2)}:1 (required: 4.5:1)`,
          )
        }

        expect(hoverContrast.skip || hoverContrast.hasValidContrast).toBe(true)
        console.log(`Link has insufficient contrast ratio (${hoverContrast.contrastRatio?.toFixed(2)}:1) in hover state`)
      }
    }

    // Test focus states on buttons
    const buttons = await page.$$(
      'button:not([disabled]):not([aria-hidden="true"])',
    )

    for (const button of buttons.slice(0, 5)) {
      // Test first 5 buttons to avoid too many tests
      const isVisible = await button.isVisible()
      if (!isVisible) {
        continue
      }

      // Focus the button
      await button.focus()

      // Wait a bit for any transitions to complete
      await page.waitForTimeout(300)

      // Check contrast in focus state
      const focusContrast = await page.evaluate((el) => {
        function parseRgb(colorString: string) {
          const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i)
          if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
            return [
              parseInt(rgbMatch[1], 10),
              parseInt(rgbMatch[2], 10),
              parseInt(rgbMatch[3], 10),
            ]
          }

          const rgbaMatch = colorString.match(
            /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i,
          )
          if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
            return [
              parseInt(rgbaMatch[1], 10),
              parseInt(rgbaMatch[2], 10),
              parseInt(rgbaMatch[3], 10),
            ]
          }

          return null
        }

        function calculateLuminance(rgb: number[] | null) {
          if (!rgb) {
            return 0
          }
          const r = rgb[0]
          const g = rgb[1]
          const b = rgb[2]

          const sRGB = [r, g, b].map((v) => {
            if (v === undefined) {
              return 0
            }
            const val = v / 255
            return val <= 0.03928
              ? val / 12.92
              : Math.pow((val + 0.055) / 1.055, 2.4)
          })

          if (sRGB[0] === undefined || sRGB[1] === undefined || sRGB[2] === undefined) {
            return 0
          }

          return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
        }

        function calculateContrastRatio(bg: number[] | null, fg: number[] | null) {
          if (!bg || !fg) {
            return 0
          }
          const bgLuminance = calculateLuminance(bg)
          const fgLuminance = calculateLuminance(fg)

          const lighter = Math.max(bgLuminance, fgLuminance)
          const darker = Math.min(bgLuminance, fgLuminance)

          return (lighter + 0.05) / (darker + 0.05)
        }

        const style = window.getComputedStyle(el)
        const bgRgb = parseRgb(style.backgroundColor)
        const fgRgb = parseRgb(style.color)

        // Skip elements with transparent backgrounds or those we can't parse
        if (!bgRgb || !fgRgb) {
          return { 
            hasValidContrast: true, 
            skip: true,
            states: {},
            color: style.color,
            bgColor: style.backgroundColor,
            hasFocusOutline: false,
            focusOutlineColor: null,
            outlineHasValidContrast: true
          } as FocusContrastInfo
        }

        const contrastRatio = calculateContrastRatio(bgRgb, fgRgb)
        const requiredRatio = 4.5 // For normal text

        // Check if there's a focus outline with sufficient contrast
        const hasFocusOutline =
          style.outlineWidth !== '0px' && style.outlineStyle !== 'none'
        const focusOutlineColor = hasFocusOutline ? style.outlineColor : null

        // Calculate contrast ratio for the focus outline if present
        let outlineContrastRatio: number | undefined = undefined;
        let outlineHasValidContrast = true

        if (hasFocusOutline && focusOutlineColor) {
          const outlineRgb = parseRgb(focusOutlineColor)
          if (outlineRgb) {
            outlineContrastRatio = calculateContrastRatio(bgRgb, outlineRgb) || 0
            if (outlineContrastRatio !== undefined) {
              outlineHasValidContrast = outlineContrastRatio >= 3.0 // Focus indicator should have at least 3:1
            }
          }
        }

        return {
          color: style.color,
          bgColor: style.backgroundColor,
          contrastRatio,
          hasValidContrast: contrastRatio >= requiredRatio,
          hasFocusOutline,
          focusOutlineColor,
          outlineContrastRatio,
          outlineHasValidContrast,
          skip: false,
          states: {}
        } as FocusContrastInfo
      }, button)

      // Check focus outline contrast
      if (
        !focusContrast.skip &&
        focusContrast.hasFocusOutline &&
        !focusContrast.outlineHasValidContrast
      ) {
        console.warn(`Focus outline contrast issue found for button:`)
        console.warn(
          `  Foreground: ${focusContrast.color}, Background: ${focusContrast.bgColor}`,
        )
        console.warn(`  Outline color: ${focusContrast.focusOutlineColor}`)
        console.warn(
          `  Outline contrast ratio: ${focusContrast.outlineContrastRatio?.toFixed(2)}:1 (required: 3:1)`,
        )

        expect(focusContrast.outlineHasValidContrast).toBe(true)
      }

      // Check text contrast in focused state
      if (!focusContrast.skip && !focusContrast.hasValidContrast) {
        console.warn(`Focus state text contrast issue found for button:`)
        console.warn(
          `  Foreground: ${focusContrast.color}, Background: ${focusContrast.bgColor}`,
        )
        console.warn(
          `  Contrast ratio: ${focusContrast.contrastRatio?.toFixed(2)}:1 (required: 4.5:1)`,
        )

        expect(focusContrast.hasValidContrast).toBe(true)
      }
    }
  })

  // Test for contrast in dark mode if supported
  test('Dark mode should maintain sufficient color contrast', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check if dark mode is supported (look for a theme toggle button or dark mode class)
    const hasDarkModeToggle = await page.$$(
      '[aria-label*="dark mode"], [aria-label*="theme"], button:has-text("dark"), .theme-toggle, .dark-mode-toggle',
    )

    if (hasDarkModeToggle.length === 0) {
      console.warn(
        'Dark mode toggle button not found. Skipping dark mode contrast test.',
      )
      return
    }

    // Click the dark mode toggle
    if (hasDarkModeToggle[0]) {
      await hasDarkModeToggle[0].click()
    }

    // Wait for theme change to take effect
    await page.waitForTimeout(500)

    // Run the axe analysis with focus on color contrast
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['color-contrast'])
      .analyze()

    // Check if there are any color contrast violations in dark mode
    const contrastViolations = axeResults.violations.filter(
      (violation) => violation.id === 'color-contrast',
    )

    if (contrastViolations.length > 0) {
      console.warn(
        `Found ${contrastViolations.length} color contrast violations in dark mode:`,
      )

      contrastViolations.forEach((violation: any) => {
        console.warn(`${violation.description}:`)
        violation.nodes.forEach((node: any, i: number) => {
          console.warn(`  ${i + 1}. ${node.html}`)

          if (node.any) {
            const contrastData = node.any.find(
              (check: any) => check.id === 'color-contrast',
            )
            if (contrastData && contrastData.data) {
              console.warn(`     Foreground: ${contrastData.data.fgColor}`)
              console.warn(`     Background: ${contrastData.data.bgColor}`)
              console.warn(
                `     Contrast ratio: ${contrastData.data.contrastRatio}:1 (required: ${contrastData.data.expectedContrastRatio}:1)`,
              )
              console.warn(`     Element: ${node.target}`)
            }
          }
        })
      })
    }

    expect(contrastViolations.length).toBe(0)
    console.log(`Found ${contrastViolations.length} color contrast violations in dark mode`)
  })
})
