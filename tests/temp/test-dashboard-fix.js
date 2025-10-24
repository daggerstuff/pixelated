import { chromium } from 'playwright'

async function testDashboard() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  console.log('Navigating to dashboard...')
  await page.goto('http://localhost:4321/dashboard')

  console.log('Current URL:', page.url())

  // Check if we have the sidebar elements
  const sidebar = await page.locator('.sidebar, .dashboard-sidebar').count()
  console.log('Sidebar elements found:', sidebar)

  if (sidebar > 0) {
    console.log('✅ Test PASSED: Sidebar elements are present')
  } else {
    console.log('❌ Test FAILED: No sidebar elements found')
  }

  await browser.close()
  process.exit(sidebar > 0 ? 0 : 1)
}

testDashboard().catch((error) => {
  console.error('Test error:', error)
  process.exit(1)
})
