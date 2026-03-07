/**
 * Vite plugin to handle flexsearch imports in SSR context
 * This prevents "document is not defined" errors during build
 */
export default function vitePluginFlexsearchSSR() {
  const virtualModuleId = 'virtual:flexsearch-stub'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  // Check if we're in a server-side environment
  const isSSR = process.env.SSR === 'true' || !globalThis.window

  // Specific paths to intercept - being explicit is better than using includes
  const flexsearchPaths = [
    'flexsearch',
    'flexsearch/dist/module/document',
    'flexsearch/dist/module/index',
    'flexsearch/dist/flexsearch.min.js',
    'flexsearch/dist/module/lang',
    'flexsearch/lang',
  ]

  return {
    name: 'vite-plugin-flexsearch-ssr',
    enforce: 'pre', // Run this plugin before other plugins

    resolveId(id, importer, options) {
      // Handle exact path matches
      if (isSSR && flexsearchPaths.includes(id)) {
        console.log(`[flexsearch-ssr] Intercepting direct import: ${id}`)
        return resolvedVirtualModuleId
      }

      // Check for node_modules paths (handles both ESM and CJS resolution)
      if (isSSR && id.includes('/node_modules/flexsearch/')) {
        console.log(`[flexsearch-ssr] Intercepting node_modules import: ${id}`)
        return resolvedVirtualModuleId
      }

      // Handle relative imports from flexsearch
      if (
        isSSR &&
        importer &&
        (importer.includes('flexsearch') ||
          importer.includes('node_modules/flexsearch'))
      ) {
        console.log(
          `[flexsearch-ssr] Intercepting relative import from flexsearch: ${id} (imported by ${importer})`,
        )
        return resolvedVirtualModuleId
      }

      // Handle dynamic imports (handles import() patterns)
      if (
        isSSR &&
        options &&
        options.dynamicImport &&
        (id.includes('flexsearch') || id === 'flexsearch')
      ) {
        console.log(`[flexsearch-ssr] Intercepting dynamic import: ${id}`)
        return resolvedVirtualModuleId
      }

      // Handle the virtual module ID
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        // Return a more complete stub implementation of flexsearch for SSR
        return `
          // SSR-safe stub for all flexsearch imports

          // Export a default object with all commonly used FlexSearch methods
          const stubMethods = {
            add: () => {},
            search: () => [],
            remove: () => {},
            update: () => {},
            clear: () => {},
            where: () => {},
            find: () => [],
            index: () => {},
            encode: () => ''
          };

          // Main Document class
          class DocumentStub {
            constructor() {
              return Object.assign(this, stubMethods);
            }
          }

          // Main Index class
          class IndexStub {
            constructor() {
              return Object.assign(this, stubMethods);
            }
          }

          // Main export
          const flexsearchStub = {
            Document: function() {
              return new DocumentStub();
            },
            Index: function() {
              return new IndexStub();
            },
            create: function() {
              return new IndexStub();
            },
            registerLanguage: () => {},
            registerEncoder: () => {},
            registerMatcher: () => {},
            registerFilter: () => {},
            registerAsync: () => {}
          };

          // Export as default for standard imports
          export default flexsearchStub;

          // Also export as named exports for destructured imports
          export const Document = DocumentStub;
          export const Index = IndexStub;
          export const create = flexsearchStub.create;
          export const registerLanguage = flexsearchStub.registerLanguage;
          export const registerEncoder = flexsearchStub.registerEncoder;
          export const registerMatcher = flexsearchStub.registerMatcher;
          export const registerFilter = flexsearchStub.registerFilter;
        `
      }
    },
  }
}
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = 'a0db6a53-f0a3-5748-899c-6016b824b882'))
  } catch (error) {
    // Intentionally empty - silencing Sentry debug errors
  }
})()
//# debugId=a0db6a53-f0a3-5748-899c-6016b824b882
