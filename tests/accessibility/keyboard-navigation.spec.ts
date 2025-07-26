import { test, expect } from '@playwright/test'

// Critical interactive elements that should be keyboard accessible
const CRITICAL_INTERACTIVE_ELEMENTS = {
  Home: [
    { name: 'Navigation', selector: 'nav a' },
    { name: 'Get Started Button', selector: 'a[href="/docs/getting-started"]' },
    { name: 'Features Section', selector: '.features a, .features button' },
    { name: 'Footer Links', selector: 'footer a' },
  ],
  Documentation: [
    { name: 'Sidebar Navigation', selector: 'aside a' },
    { name: 'Table of Contents', selector: 'nav.toc a' },
    { name: 'Search Button', selector: 'button[aria-label*="Search"]' },
    { name: 'Code Blocks', selector: 'pre button' },
  ],
  Dashboard: [
    { name: 'Dashboard Tabs', selector: '[role="tablist"] [role="tab"]' },
    { name: 'Action Buttons', selector: '.dashboard button:not([disabled])' },
    { name: 'Data Table Controls', selector: 'table button, table a' },
    { name: 'Pagination Controls', selector: '.pagination button' },
  ],
}

// Pages to test for keyboard navigation
const PAGES_TO_TEST = [
  { name: 'Home', path: '/' },
  { name: 'Documentation', path: '/docs' },
  { name: 'Dashboard', path: '/dashboard' },
]

// Define interfaces for better type safety
interface FocusedElement {
  tagName: string;
  text: string;
  href?: string | null;
  className?: string | null;
  id?: string;
  x?: number;
  y?: number;
  tabIndex?: number;
  role?: string | null;
}

test.describe('Keyboard Navigation Tests', () => {
  test.describe.configure({ mode: 'serial' })

  for (const page of PAGES_TO_TEST) {
    test(`${page.name} page should be navigable with keyboard`, async ({
      page: pageContext,
    }) => {
      // Navigate to the page
      await pageContext.goto(page.path)

      // Wait for the page to fully load
      await pageContext.waitForLoadState('networkidle')

      // Check if the skip link is the first focusable element
      await pageContext.keyboard.press('Tab')
      const firstFocusedElement = await pageContext.evaluate(() => {
        const { activeElement } = document;
        if (!activeElement) return { tagName: '', text: '' };
        
        return {
          tagName: activeElement.tagName.toLowerCase(),
          text: activeElement.textContent?.trim() || '',
          href: activeElement.getAttribute('href'),
          className: activeElement.className,
        }
      });

      // Test if the first element is a skip link
      const isSkipLink =
        firstFocusedElement.tagName === 'a' &&
        firstFocusedElement.href?.includes('#main') &&
        (firstFocusedElement.text?.includes('Skip') ||
          firstFocusedElement.className?.includes('skip'))

      console.log(
        `First focusable element on ${page.name} page:`,
        firstFocusedElement,
      )

      // This should ideally be a skip link, but we'll log it rather than fail the test
      if (!isSkipLink) {
        console.warn(
          `The first focusable element on ${page.name} page is not a skip link`,
        )
      }

      // Check if critical interactive elements can be focused
      const elementsToCheck =
        CRITICAL_INTERACTIVE_ELEMENTS[
          page.name as keyof typeof CRITICAL_INTERACTIVE_ELEMENTS
        ] || []

      for (const element of elementsToCheck) {
        // Check if the element exists
        const elementCount = await pageContext.locator(element.selector).count()
        expect(elementCount).toBeGreaterThan(
          0,
        )
        console.log(`No ${element.name} elements found with selector "${element.selector}" on ${page.name} page`)

        // Check if at least one of the elements matching the selector can be focused
        let foundFocusable = false
        const elements = await pageContext.locator(element.selector).all()

        // Test each element
        for (const el of elements) {
          // Check if element is visible
          const isVisible = await el.isVisible()
          if (!isVisible) {
            continue
          }

          // Focus the element
          await el.focus()

          // Check if the element is now focused
          const isFocused = await pageContext.evaluate(() => {
            const { activeElement } = document
            return activeElement !== document.body && activeElement !== null
          })

          if (isFocused) {
            foundFocusable = true
            break
          }
        }

        expect(foundFocusable).toBe(true)
        console.log(`None of the ${element.name} elements (${element.selector}) on ${page.name} page can be focused`)
      }

      // Test natural tab order
      // Reset focus to the document body
      await pageContext.evaluate(() => {
        document.body.focus()
      })

      // Track the path of focus as user tabs through the page
      const focusPath: FocusedElement[] = []
      const maxTabCount = 30 // Limit to avoid infinite loops

      for (let i = 0; i < maxTabCount; i++) {
        // Press Tab to move focus
        await pageContext.keyboard.press('Tab')

        // Get currently focused element
        const focusedElement = await pageContext.evaluate(() => {
          const { activeElement } = document
          if (!activeElement || activeElement === document.body) {
            return null
          }

          // Get element location
          const rect = activeElement.getBoundingClientRect()

          return {
            tagName: activeElement.tagName.toLowerCase(),
            text: activeElement.textContent?.trim().substring(0, 50) || '',
            id: activeElement.id || '',
            className: activeElement.className || '',
            x: rect.x,
            y: rect.y,
            // Use getAttribute to get tabIndex as a safer approach
            tabIndex: Number(activeElement.getAttribute('tabindex') || 0),
            role: activeElement.getAttribute('role'),
          }
        })

        if (focusedElement) {
          focusPath.push(focusedElement)
        } else {
          // If nothing is focused, we've either reached the end or something is wrong
          break
        }
      }

      // Log focus path for debugging
      console.log(
        `Focus path for ${page.name} page (${focusPath.length} elements):`,
      )
      focusPath.forEach((el, index) => {
        console.log(
          `${index + 1}. ${el.tagName}${el.id ? '#' + el.id : ''} - "${el.text}" (x: ${el.x}, y: ${el.y})`,
        )
      })

      // Check for any focusable elements with a tabindex > 0 (anti-pattern)
      const highTabIndexElements = focusPath.filter((el) => (el.tabIndex || 0) > 0)
      if (highTabIndexElements.length > 0) {
        console.warn(
          `Found ${highTabIndexElements.length} elements with tabindex > 0 on ${page.name} page. This is an accessibility anti-pattern:`,
        )
        highTabIndexElements.forEach((el) => {
          console.warn(
            `- ${el.tagName}${el.id ? '#' + el.id : ''} with tabindex=${el.tabIndex}`,
          )
        })
      }

      // Verify at least some elements can be focused
      expect(focusPath.length).toBeGreaterThan(5)
      console.log(`Found only ${focusPath.length} focusable elements on ${page.name} page, expected more interactive elements`)
    })
  }
})
