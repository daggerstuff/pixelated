import path from 'path'

export default function rewriteLoggerImportPlugin() {
  return {
    name: 'rewrite-logger-import',
    enforce: 'pre',
    resolveId(source, _importer) {
      try {
        if (!source) return null;
        const relPattern = /^(?:\.\.\/)+lib\/logging\/build-safe-logger$/;
        if (relPattern.test(source)) {
          return path.resolve(process.cwd(), 'src/lib/logging/build-safe-logger.ts');
        }
        return null;
      } catch {
        return null;
      }
    },
    transform(code, id) {
      try {
        if (!id || /node_modules/.test(id)) return null;
        if (!/(\.ts|\.tsx|\.js|\.jsx|\.mjs)$/.test(id)) return null;

        const patternFrom = /from\s+['"](?:\.\.\/)+lib\/logging\/build-safe-logger['"]/g;
        const patternDyn = /import\(\s*['"](?:\.\.\/)+lib\/logging\/build-safe-logger['"]\s*\)/g;

        let transformed = code;
        transformed = transformed.replace(patternFrom, "from '@/lib/logging/build-safe-logger'");
        transformed = transformed.replace(patternDyn, "import('@/lib/logging/build-safe-logger')");

        if (transformed === code) return null;
        return { code: transformed, map: null };
      } catch {
       // Fail open: do not block the build on plugin transform errors
       // Optionally log error for debugging
       // console.error('Transform error in rewrite-logger-import plugin');
       return null;
     }
    },
  };
}


