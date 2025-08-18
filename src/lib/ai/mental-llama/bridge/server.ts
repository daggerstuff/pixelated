// Conditional module export for Python bridge
export async function createMentalLLaMAPythonBridge(scriptPath?: string): void {
  // Only import server implementation when actually in a Node.js environment
  if (
    typeof process !== 'undefined' &&
    process.versions?.node &&
    typeof window === 'undefined'
  ) {
    try {
      // Server environment - use real implementation with dynamic import to avoid bundling
      const modulePath = [
        '..',
        '..',
        '..',
        'server-only',
        'MentalLLaMAPythonBridge',
      ].join('/')
      const module = await import(/* @vite-ignore */ modulePath)
      return new module.MentalLLaMAPythonBridge(scriptPath)
    } catch (error: unknown) {
      console.warn(
        'Failed to load server-side Python bridge, using stub:',
        error,
      )
      // Fallback to stub if server import fails
      const { MentalLLaMAPythonBridge } = await import('./browser-stub')
      return new MentalLLaMAPythonBridge()
    }
  } else {
    // Browser environment - use stub
    const { MentalLLaMAPythonBridge } = await import('./browser-stub')
    return new MentalLLaMAPythonBridge()
  }
}
