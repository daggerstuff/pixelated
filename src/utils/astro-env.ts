/**
 * Safe production-mode check for Astro SSR contexts where `import.meta.env`
 * may be undefined at runtime (e.g. `astro preview` after build).
 */
export function isAstroProduction(): boolean {
  return import.meta.env?.PROD ?? process.env.NODE_ENV === 'production'
}
