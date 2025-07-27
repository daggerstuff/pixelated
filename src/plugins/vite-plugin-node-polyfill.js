/**
 * Vite plugin to provide Node.js polyfills for browser environment
 */
export default function nodePolyfillPlugin() {
  return {
    name: 'vite-plugin-node-polyfill',
    config(config) {
      // Add Node.js polyfills for browser builds
      config.define = config.define || {};
      config.define.global = 'globalThis';
      config.define.process = 'process';
    },
    configResolved(resolvedConfig) {
      // Ensure polyfills are available in browser context
      if (resolvedConfig.command === 'build' && !resolvedConfig.build.ssr) {
        resolvedConfig.define = resolvedConfig.define || {};
        resolvedConfig.define.global = 'globalThis';
      }
    }
  };
}