import { initToolbar } from '@21st-extension/toolbar'

const stagewiseConfig = {
  plugins: [],
}

function setupStagewise() {
  // Only initialize once and only in development mode
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    initToolbar(stagewiseConfig)
  }
}

setupStagewise()
