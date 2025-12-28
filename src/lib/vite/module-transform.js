/**
 * Vite plugin to help with ESM/CommonJS interoperability issues
 */
export function modulesTransformPlugin() {
  return {
    name: 'vite-plugin-module-transform',
    enforce: 'pre',

    // Transform CommonJS to ESM
    transform(code, id) {
      // Handle only specific files that cause issues
      if (
        id.includes('node_modules/react/index.js') ||
        id.includes('node_modules/react-dom/index.js')
      ) {
        // Replace CommonJS export with ESM export
        let transformed = code.replace(
          /module\.exports\s*=\s*require\(['"](.*)['"]\)/g,
          "import * as _temp from '$1'; export default _temp.default || _temp;",
        )

        // Replace other CommonJS patterns
        transformed = transformed.replace(
          /require\(['"](.*)['"]\)/g,
          "await import('$1').then(m => m.default || m)",
        )

        return {
          code: transformed,
          map: null,
        }
      }

      return null
    },

    // Handle virtual modules
    resolveId(id) {
      if (id === 'virtual:react-compat') {
        return '\0react-compat'
      }
      return null
    },

    // Load virtual modules
    load(id) {
      if (id === '\0react-compat') {
        return `
          import * as React from 'react';
          export default React;
          export const {
            useState,
            useEffect,
            useContext,
            useReducer,
            useCallback,
            useMemo,
            useRef,
            useLayoutEffect,
            createElement,
            Fragment,
            Component,
          } = React;
        `
      }
      return null
    },
  }
}
