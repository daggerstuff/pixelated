/**
 * Vite plugin to mark Node.js modules as external dependencies
 */
export default function externalNodePlugin() {
  const nodeBuiltins = [
    'fs', 'fs/promises', 'path', 'os', 'http', 'https', 'util', 'crypto',
    'child_process', 'stream', 'events', 'buffer', 'process', 'net', 'tls',
    'zlib', 'worker_threads', 'diagnostics_channel', 'inspector', 'readline',
    'async_hooks', 'node:fs', 'node:fs/promises', 'node:path', 'node:os',
    'node:http', 'node:https', 'node:util', 'node:crypto', 'node:child_process',
    'node:stream', 'node:events', 'node:buffer', 'node:process', 'node:net',
    'node:tls', 'node:zlib', 'node:worker_threads', 'node:diagnostics_channel',
    'node:inspector', 'node:readline', 'node:async_hooks'
  ];

  return {
    name: 'vite-plugin-external-node',
    config(config) {
      // Mark Node.js built-ins as external for SSR builds
      config.build = config.build || {};
      config.build.rollupOptions = config.build.rollupOptions || {};
      
      const existingExternal = config.build.rollupOptions.external || [];
      const externalFn = typeof existingExternal === 'function' 
        ? existingExternal 
        : (id) => Array.isArray(existingExternal) ? existingExternal.includes(id) : existingExternal === id;

      config.build.rollupOptions.external = (id) => {
        return nodeBuiltins.includes(id) || externalFn(id);
      };
    }
  };
}