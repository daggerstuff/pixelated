/**
 * Safe production-mode check for Astro SSR contexts where `import.meta.env`
 * may be undefined at runtime (e.g. `astro preview` after build).
 */
export function isAstroProduction(): boolean {
  if (import.meta.env?.PROD != null) {
    return import.meta.env.PROD
  }

  const nodeEnv =
    typeof process !== 'undefined' ? process.env?.['NODE_ENV'] : undefined
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return false
  }

  // Only treat an explicit 'production' NODE_ENV as production. Unknown or
  // absent values default to non-production so browser/non-Node runtimes and
  // staging/preview instances are not falsely treated as production.
  return nodeEnv === 'production'
}
