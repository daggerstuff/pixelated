import { type AstroIntegration } from 'astro'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSearchIndexFile } from '../utils/search-indexer'
import { validatePath, sanitizeFilename, ALLOWED_DIRECTORIES } from '../utils/path-security'

interface SearchIntegrationOptions {
  // Collections to index
  collections?: string[]

  // Output path for search index
  indexPath?: string

  // Whether to add the index script to all pages
  autoInclude?: boolean

  // Generate the collection types automatically
  generateTypes?: boolean
}

const defaultOptions: SearchIntegrationOptions = {
  collections: ['blog', 'docs', 'guides'],
  indexPath: 'search-index.js',
  autoInclude: true,
  generateTypes: true,
}

/**
 * Astro integration for FlexSearch
 * Automatically builds a search index during the build process
 */
export default function flexsearchIntegration(
  options: SearchIntegrationOptions = {},
): AstroIntegration {
  const resolvedOptions = { ...defaultOptions, ...options }

  return {
    name: 'astro-flexsearch',
    hooks: {
      'astro:config:setup': ({ injectScript, logger }) => {
        logger.info('Setting up FlexSearch integration')

        // Inject search client initialization for browser - this is done in a way that's SSR-safe
        injectScript(
          'page',
          `
          // This code only runs in the browser
          // We need to initialize the search client with proper browser-only loads
          if (typeof window !== 'undefined') {
            // Import the search client
            import('../lib/search.js')
              .then(module => {
                // Make it available globally
                window.searchClient = module.searchClient;

                // Initialize search if data is available
                if (window.searchIndex && Array.isArray(window.searchIndex)) {
                  window.searchClient.importDocuments(window.searchIndex);
                }

                // Let other scripts know search is ready
                if (typeof window.initSearch === 'function') {
                  window.initSearch();
                }

                // Add a custom event for modules that need to know when search is ready
                window.dispatchEvent(new CustomEvent('search:ready'));
              })
              .catch(error => {
                console.error('Failed to initialize search:', error);
              });
          }
          `,
        )

        logger.info('FlexSearch client injected for browser usage')
      },

      'astro:build:done': async ({ dir, pages, logger }) => {
        try {
          logger.info('Building search index...')

          // Generate the search index JavaScript file
          const searchIndexJs = await createSearchIndexFile()

          // Write the file to the output directory
          const outDir = path.resolve(dir.pathname)
          const indexFilename = sanitizeFilename(resolvedOptions.indexPath || 'search-index.js')
          const indexPath = validatePath(indexFilename, outDir)

          await fs.writeFile(indexPath, searchIndexJs, 'utf-8')

          // Log success
          logger.info(
            `Search index generated with ${pages.length} pages at ${indexPath}`,
          )

          // If auto-include is enabled, add the script tag to all HTML pages
          if (resolvedOptions.autoInclude) {
            logger.info('Adding search index script to HTML pages...')

            // Scan the output directory for HTML files
            const htmlFiles = await scanDirectory(outDir, '.html')

            // Add the script tag to each HTML file
            let modifiedFiles = 0

            for (const htmlFile of htmlFiles) {
              try {
                let html = await fs.readFile(htmlFile, 'utf-8')
                const scriptTag = `<script src="/${resolvedOptions.indexPath}" defer></script>`

                // Check if the script is already included
                if (!html.includes(scriptTag)) {
                  // Add the script tag before the closing </head> tag
                  html = html.replace('</head>', `${scriptTag}\n</head>`)
                  await fs.writeFile(htmlFile, html, 'utf-8')
                  modifiedFiles++
                }
              } catch (error: unknown) {
                logger.error(
                  `Failed to modify HTML file: ${htmlFile} - ${error instanceof Error ? String(error) : String(error)}`,
                )
              }
            }

            logger.info(
              `Added search index script to ${modifiedFiles} HTML files`,
            )
          }
        } catch (error: unknown) {
          logger.error(
            `Failed to build search index: ${error instanceof Error ? String(error) : String(error)}`,
          )
        }
      },
    },
  }
}

/**
 * Recursively scan a directory for files with a specific extension
 */
async function scanDirectory(
  dir: string,
  extension: string,
): Promise<string[]> {
  const files: string[] = []

  try {
    // Validate directory path
    const validatedDir = validatePath(dir, ALLOWED_DIRECTORIES.PROJECT_ROOT)
    const entries = await fs.readdir(validatedDir, { withFileTypes: true })

    for (const entry of entries) {
      const sanitizedName = sanitizeFilename(entry.name)
      const fullPath = validatePath(sanitizedName, validatedDir)

      if (entry.isDirectory()) {
        const subDirFiles = await scanDirectory(fullPath, extension)
        files.push(...subDirFiles)
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath)
      }
    }
  } catch (error: unknown) {
    console.error(`Failed to scan directory ${dir}:`, error)
  }

  return files
}
