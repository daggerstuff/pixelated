/**
 * Safe production-mode check for Astro SSR contexts where `import.meta.env`
 * may be undefined at runtime (e.g. `astro preview` after build).
 */
export function isAstroProduction(): boolean {
  if (import.meta.env?.PROD != null) {
    return import.meta.env.PROD
  }

  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return false
  }

  // Preview and production SSR builds should filter drafts by default.
  return true
}
