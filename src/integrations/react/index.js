/**
 * For integration with Astro components using React components
 * Modified version to handle ESM compatibility issues
 */
export default function createReactIntegration() {
  return {
    name: '@astrojs/react',
    hooks: {
      'astro:config:setup': async ({ addRenderer }) => {
        // Check React version before adding renderer
        const isReactV18 = await hasReactV18()
        const needsV17 = await needsV17Patch()

        addRenderer({
          name: '@astrojs/react',
          serverEntrypoint:
            isReactV18 && !needsV17
              ? './src/integrations/react/server.js'
              : './src/integrations/react/server-v17.js',
          clientEntrypoint:
            isReactV18 && !needsV17
              ? './src/integrations/react/client.js'
              : './src/integrations/react/client-v17.js',
          jsxImportSource: 'react',
          jsxTransformOptions: async () => {
            return {
              jsx: 'react/jsx-runtime',
              development: process.env.NODE_ENV !== 'production',
            }
          },
        })
      },
    },
  }
}

/**
 * Client-side version detection utility using dynamic imports
 */
async function hasReactV18() {
  try {
    // Check if we can access React 18 APIs using dynamic import
    const React = await import('react')
    return !!React.default.useId
  } catch (error) {
    console.warn('Error checking React version:', error)
    return false
  }
}

/**
 * Detect if we need compatibility patches using dynamic imports
 */
async function needsV17Patch() {
  try {
    // Try to access ReactDOM.createRoot - existence indicates React 18
    const ReactDOM = await import('react-dom')
    return !ReactDOM.default.createRoot
  } catch (error) {
    console.warn('Error checking ReactDOM version:', error)
    return false
  }
}
