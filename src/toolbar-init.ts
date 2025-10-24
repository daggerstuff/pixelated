// Development toolbar initialization - optional dependency
function setupStagewise() {
  // Only initialize once and only in development mode
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    try {
      // Optional development dependency - may not exist
      const { initToolbar } = require('@21st-extension/toolbar')
      const stagewiseConfig = {
        plugins: [],
      }
      initToolbar(stagewiseConfig)
    } catch (error: unknown) {
      // Toolbar not available, continue without it
      console.debug(
        'Development toolbar not available, continuing without it',
        String(error),
      )
    }
  }
}

setupStagewise()
