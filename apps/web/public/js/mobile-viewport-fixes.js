// Mobile viewport fixes script
import { initMobileViewportFixes } from '../scripts/mobile-viewport.js'

document.addEventListener('astro:page-load', () => {
  initMobileViewportFixes()
})
