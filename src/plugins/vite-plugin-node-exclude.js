/**
 * Vite plugin to exclude Node.js specific modules from browser builds
 */
export default function nodeExcludePlugin() {
  const nodeModules = [
    'fs', 'path', 'os', 'crypto', 'http', 'https', 'stream', 'util',
    'events', 'buffer', 'process', 'child_process', 'net', 'tls',
    'node:fs', 'node:path', 'node:os', 'node:crypto', 'node:http',
    'node:https', 'node:stream', 'node:util', 'node:events',
    'node:buffer', 'node:process', 'node:child_process', 'node:net', 'node:tls'
  ];

  return {
    name: 'vite-plugin-node-exclude',
    resolveId(id) {
      // Exclude Node.js modules from browser builds
      if (nodeModules.includes(id)) {
        return { id, external: true };
      }
      return null;
    }
  };
}