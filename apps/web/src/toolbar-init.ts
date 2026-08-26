// Development toolbar initialization - optional dependency
function setupStagewise(): void {
  // Only initialize once and only in development mode
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    try {
      // Optional development dependency - may not exist
      const { initToolbar } = require('@21st-extension/toolbar') as {
        initToolbar: (config: { plugins: unknown[] }) => void
      }
      const stagewiseConfig: { plugins: unknown[] } = {
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
