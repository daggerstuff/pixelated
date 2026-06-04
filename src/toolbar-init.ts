// Development toolbar initialization - optional dependency
function setupStagewise() {
  // Only initialize once and only in development mode
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    try {
      // Optional development dependency - may not exist
      const toolbarModule: { initToolbar?: (config: unknown) => void } = require('@21st-extension/toolbar')
      if (typeof toolbarModule.initToolbar === 'function') {
        const stagewiseConfig = {
          plugins: [],
        }
        toolbarModule.initToolbar(stagewiseConfig)
      }
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
