// Define a basic FlexSearch integration
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Default options for flexsearch integration
const defaultOptions = {
  collections: [], // Which content collections to index
  indexPath: 'search-index.js', // Path to output the search index
  autoInclude: true, // Whether to automatically include all documents in collections
}

// The main integration function
export default function flexsearchIntegration(options = {}) {
  const resolvedOptions = { ...defaultOptions, ...options }

  return {
    name: 'astro-flexsearch',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        logger.info('[astro-flexsearch] Setting up FlexSearch integration')

        // Inject the client-side search component
        injectRoute({
          pattern: '/search-index',
          entrypoint: 'src/integrations/search-endpoint.js',
        })
      },

      'astro:build:done': async ({ dir, logger }) => {
        logger.info(
          '[astro-flexsearch] FlexSearch client injected for browser usage',
        )

        // In a full implementation, this would generate a search index,
        // but for now we'll just create an empty index file
        const outFile = path.join(fileURLToPath(dir), resolvedOptions.indexPath)

        // Create a minimal search index
        const indexContent = `export default {
          index: {},
          store: {},
          search: function(query) { return []; }
        };`

        await fs.writeFile(outFile, indexContent, 'utf-8')
      },
    },
  }
}
