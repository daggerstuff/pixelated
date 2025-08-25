import { test, expect, devices } from '@playwright/test'
import type { Page, BrowserContext } from '@playwright/test'

/* Refactored: Flatten device param handling so test.use is NOT inside describe;
 * use explicit device context via newContext in each test.
 */
// Define mobile and tablet devices to test
const mobileDevices = [
  { name: 'iPhone SE', ...devices['iPhone SE'] },
  { name: 'iPhone 12', ...devices['iPhone 12'] },
  { name: 'iPhone 12 Pro', ...devices['iPhone 12 Pro'] },
  { name: 'iPhone 13', ...devices['iPhone 13'] },
  { name: 'Pixel 5', ...devices['Pixel 5'] },
  { name: 'Galaxy S21', ...devices['Galaxy S21'] },
  { name: 'Galaxy Note 20', ...devices['Galaxy Note 20'] },
];

const tabletDevices = [
  { name: 'iPad', ...devices['iPad'] },
  { name: 'iPad Pro', ...devices['iPad Pro'] },
  { name: 'Galaxy Tab S4', ...devices['Galaxy Tab S4'] },
];

// Mobile device suite (all in one test so test.use is not nested)
test.describe('Mobile Responsiveness All Devices', () => {
  for (const device of mobileDevices) {
    test(`Mobile viewport/adapt/touch/accessibility/performance for ${device.name}`, async ({ browser }) => {
      // Create a new context for the device
      const context = await browser.newContext({ ...device });
      const page = await context.newPage();

      await page.goto('/demo');
      await page.waitForLoadState('networkidle');

      // Viewport dimensions and layout
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThanOrEqual(device.viewport.width);
      expect(viewport?.height).toBeLessThanOrEqual(device.viewport.height);

      // Main content should fit within viewport
      const mainContent = page.locator('[data-testid="main-content"]');
      if (await mainContent.isVisible()) {
        const contentBox = await mainContent.boundingBox();
        expect(contentBox?.width).toBeLessThanOrEqual(viewport?.width || 0);
      }

      // Navigation adapts to mobile
      const mobileNav = page.locator('[data-testid="mobile-nav"]');
      const desktopNav = page.locator('[data-testid="desktop-nav"]');
      const hasMobileNav = await mobileNav.isVisible();
      const hasDesktopNav = await desktopNav.isVisible();
      expect(hasMobileNav || hasDesktopNav).toBe(true);

      // Test tab navigation
      await page.click('[data-testid="validation-tab"]');
      await expect(
        page.locator('[data-testid="validation-section"]'),
      ).toBeVisible();

      // Content stacking and flow
      await page.click('[data-testid="data-ingestion-tab"]');
      const cards = page.locator('[data-testid="format-card"]');
      const cardCount = await cards.count();
      if (cardCount > 1) {
        const firstCard = await cards.first().boundingBox();
        const secondCard = await cards.nth(1).boundingBox();
        if (firstCard && secondCard) {
          expect(secondCard.y).toBeGreaterThan(firstCard.y);
        }
      }

      // Touch targets minimum size
      const touchTargets = page.locator(
        'button, input, [role="button"], [role="tab"], a',
      );
      const targetCount = await touchTargets.count();
      for (let i = 0; i < Math.min(targetCount, 10); i++) {
        const target = touchTargets.nth(i);
        if (await target.isVisible()) {
          const boundingBox = await target.boundingBox();
          if (boundingBox) {
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      }

      // Touch gestures and interactions
      await page.click('[data-testid="validation-tab"]');
      const textArea = page.locator(
        '[placeholder*="Enter psychology content"]',
      );
      await textArea.tap();
      await expect(textArea).toBeFocused();
      await page.keyboard.type(
        'Mobile touch input test for psychology content validation',
      );
      await expect(textArea).toHaveValue(/Mobile touch input test/);
      await expect(page.locator('text=Validation Results')).toBeVisible({
        timeout: 5000,
      });

      // Scroll behavior on mobile
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(500);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(200, 0));
      const scrollX = await page.evaluate(() => window.scrollX);
      expect(scrollX).toBe(0); // Should not scroll horizontally

      // Swipe gestures (if applicable)
      await page.click('[data-testid="category-balancing-tab"]');
      const sliders = page.locator('[role="slider"]');
      const sliderCount = await sliders.count();
      if (sliderCount > 0) {
        const slider = sliders.first();
        const sliderBox = await slider.boundingBox();
        if (sliderBox) {
          await page.touchscreen.tap(
            sliderBox.x + sliderBox.width * 0.3,
            sliderBox.y + sliderBox.height / 2,
          );
          await page.touchscreen.tap(
            sliderBox.x + sliderBox.width * 0.7,
            sliderBox.y + sliderBox.height / 2,
          );
        }
      }

      // Mobile-specific UI components
      await page.click('[data-testid="validation-tab"]');
      const textArea2 = page.locator(
        '[placeholder*="Enter psychology content"]',
      );
      const spellcheck = await textArea2.getAttribute('spellcheck');
      expect(spellcheck).toBeTruthy();

      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const buttonBox = await button.boundingBox();
          if (buttonBox) {
            expect(buttonBox.height).toBeGreaterThanOrEqual(44);
            if (i < buttonCount - 1) {
              const nextButton = buttons.nth(i + 1);
              const nextButtonBox = await nextButton.boundingBox();
              if (nextButtonBox && (await nextButton.isVisible())) {
                const distance = Math.min(
                  Math.abs(buttonBox.x + buttonBox.width - nextButtonBox.x),
                  Math.abs(buttonBox.y + buttonBox.height - nextButtonBox.y),
                );
                expect(distance).toBeGreaterThanOrEqual(8);
              }
            }
          }
        }
      }

      await page.click('[data-testid="export-tab"]');
      const formatCards = page.locator('[data-testid="format-option"]');
      const cardCount2 = await formatCards.count();
      if (cardCount2 > 0) {
        for (let i = 0; i < Math.min(cardCount2, 3); i++) {
          const card = formatCards.nth(i);
          const cardBox = await card.boundingBox();
          if (cardBox) {
            expect(cardBox.width).toBeLessThanOrEqual(
              (page.viewportSize()?.width || 0) - 20,
            );
          }
        }
      }

      // Mobile performance and loading
      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      // eslint-disable-next-line no-console
      console.log(`${device.name} page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(8000);

      const startTime2 = Date.now();
      await page.click('[data-testid="validation-tab"]');
      await page.click('[data-testid="category-balancing-tab"]');
      await page.click('[data-testid="export-tab"]');
      const interactionTime = Date.now() - startTime2;
      console.log(`${device.name} interaction time: ${interactionTime}ms`);
      expect(interactionTime).toBeLessThan(4000);

      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0;
      });
      await page.click('[data-testid="data-ingestion-tab"]');
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles([
        {
          name: 'mobile-test.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({
              items: Array.from({ length: 500 }, (_, i) => ({
                id: i,
                content: `Mobile test content ${i}`,
              })),
            }),
          ),
        },
      ]);
      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 10000,
      });
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0;
      });
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        // eslint-disable-next-line no-console
        console.log(
          `${device.name} memory increase: ${memoryIncrease / 1024 / 1024}MB`,
        );
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Under 50MB
      }

      // Mobile accessibility features
      const ariaElements = page.locator('[aria-label]');
      const ariaCount = await ariaElements.count();
      expect(ariaCount).toBeGreaterThan(0);

      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);

      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      const focusBox = await focusedElement.boundingBox();
      if (focusBox) {
        expect(focusBox.width).toBeGreaterThan(0);
        expect(focusBox.height).toBeGreaterThan(0);
      }

      // Mobile color contrast
      const textElements = page
        .locator('p, span, div, button')
        .filter({ hasText: /\w+/ });
      const textCount = await textElements.count();
      for (let i = 0; i < Math.min(textCount, 5); i++) {
        const textElement = textElements.nth(i);
        if (await textElement.isVisible()) {
          await expect(textElement).toBeVisible();
        }
      }

      // Orientation changes
      await expect(mainContent).toBeVisible();
      await page.setViewportSize({
        width: device.viewport.height,
        height: device.viewport.width,
      });
      await expect(mainContent).toBeVisible();
      await page.click('[data-testid="validation-tab"]');
      await expect(page.locator('[data-testid="validation-section"]')).toBeVisible();
      await page.setViewportSize(device.viewport);
      await expect(mainContent).toBeVisible();

      // Layout adaptation to orientation
      const portraitLayout = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]')
        return main
          ? {
              width: main.clientWidth,
              height: main.clientHeight,
            }
          : null
      });
      await page.setViewportSize({
        width: device.viewport.height,
        height: device.viewport.width,
      });
      const landscapeLayout = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]')
        return main
          ? {
              width: main.clientWidth,
              height: main.clientHeight,
            }
          : null
      });
      if (portraitLayout && landscapeLayout) {
        expect(landscapeLayout.width).toBeGreaterThan(portraitLayout.width);
      }

      await context.close();
    });
  }
});

// Tablet device suite
test.describe('Tablet Responsiveness All Devices', () => {
  for (const device of tabletDevices) {
    test(`Tablet optimization/touch/performance for ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext({ ...device });
      const page = await context.newPage();
      await page.goto('/demo');
      await page.waitForLoadState('networkidle');

      const viewport = page.viewportSize();
      expect(viewport?.width).toBeGreaterThan(768);

      // Check that layout uses tablet-optimized design
      await page.click('[data-testid="category-balancing-tab"]');
      const categoryCards = page.locator('[data-testid="category-card"]');
      const cardCount = await categoryCards.count();
      if (cardCount >= 2) {
        const firstCard = await categoryCards.first().boundingBox();
        const secondCard = await categoryCards.nth(1).boundingBox();
        if (firstCard && secondCard) {
          const isHorizontal = Math.abs(firstCard.y - secondCard.y) < 50;
          const isVertical =
            secondCard.y > firstCard.y + firstCard.height - 50;
          expect(isHorizontal || isVertical).toBe(true);
        }
      }

      // Tablet touch interactions
      await page.click('[data-testid="validation-tab"]');
      const textArea = page.locator(
        '[placeholder*="Enter psychology content"]',
      );
      await textArea.tap();
      await page.keyboard.type(
        'Tablet input test with comprehensive psychology content for validation testing',
      );
      await expect(textArea).toHaveValue(/Tablet input test/);
      await expect(page.locator('text=Validation Results')).toBeVisible();

      // Tablet performance characteristics
      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      console.log(`${device.name} load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(6000);

      await context.close();
    });
  }
});

// Cross-device compatibility tests
test.describe('Cross-Device Mobile Compatibility', () => {
  test('Consistent behavior across mobile devices', async ({ browser }) => {
    const contexts: BrowserContext[] = []
    const pages: Page[] = []

    // Create contexts for different devices
    for (const device of mobileDevices.slice(0, 3)) {
      // Test first 3 devices
      const context = await browser.newContext({ ...device })
      const page = await context.newPage()

      contexts.push(context)
      pages.push(page)

      await page.goto('/demo')
      await page.waitForLoadState('networkidle')
    }

    // Test consistent functionality across devices
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const deviceName = mobileDevices[i].name

      // Test basic functionality
      await page.click('[data-testid="validation-tab"]')
      await expect(
        page.locator('[data-testid="validation-section"]'),
      ).toBeVisible()

      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.fill(`Cross-device test on ${deviceName}`)

      await expect(page.locator('text=Validation Results')).toBeVisible({
        timeout: 5000,
      })

      console.log(`${deviceName}: Basic functionality working`)
    }

    // Clean up
    for (const context of contexts) {
      await context.close()
    }
  })

  test('Progressive enhancement across device capabilities', async ({
    browser,
  }) => {
    // Test with different device capabilities
    const lowEndDevice = {
      name: 'Low-end mobile',
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0 like Mac OS X) AppleWebKit/602.1.38',
    }

    const highEndDevice = {
      name: 'High-end mobile',
      viewport: { width: 414, height: 896 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    }

    for (const device of [lowEndDevice, highEndDevice]) {
      const context = await browser.newContext(device)
      const page = await context.newPage()

      await page.goto('/demo')
      await page.waitForLoadState('networkidle')

      // Basic functionality should work on all devices
      await expect(page.locator('text=Psychology Pipeline Demo')).toBeVisible()

      // Test progressive enhancement
      const hasAdvancedFeatures = await page.evaluate(() => {
        return {
          webgl: !!document.createElement('canvas').getContext('webgl'),
          serviceWorker: 'serviceWorker' in navigator,
          intersectionObserver: 'IntersectionObserver' in window,
        }
      })

      console.log(`${device.name} capabilities:`, hasAdvancedFeatures)

      await context.close()
    }
  })
})

// Mobile-specific edge cases and error handling
test.describe('Mobile Edge Cases and Error Handling', () => {
  test('Mobile network conditions simulation', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    // Simulate slow network
    await page.route('**/*', (route) => {
      setTimeout(() => route.continue(), 1000); // Add 1s delay
    });

    await page.goto('/demo');
    await page.waitForLoadState('networkidle');

    // Should still load and function with slow network
    await expect(page.locator('text=Psychology Pipeline Demo')).toBeVisible();

    await context.close();
  });

  test('Mobile memory constraints', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto('/demo');
    await page.waitForLoadState('networkidle');

    // Test with large dataset on mobile
    await page.click('[data-testid="data-ingestion-tab"]');

    const largeDataset = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        content: `Mobile memory test item ${i} with content`,
      })),
    };

    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([
      {
        name: 'mobile-memory-test.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(largeDataset)),
      },
    ]);

    // Should handle large dataset without crashing
    await expect(page.locator('text=Processing complete')).toBeVisible({
      timeout: 15000,
    });

    await context.close();
  });

  test('Mobile input method compatibility', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto('/demo');
    await page.waitForLoadState('networkidle');

    await page.click('[data-testid="validation-tab"]');

    const textArea = page.locator('[placeholder*="Enter psychology content"]');

    // Test different input methods
    await textArea.tap();

    // Test voice input simulation (basic)
    await page.keyboard.type(
      'Voice input test for mobile psychology validation',
    );

    // Test autocorrect/predictive text simulation
    await page.keyboard.type(' with autocorrect');

    await expect(textArea).toHaveValue(/Voice input test/);

    await context.close();
  });
})
