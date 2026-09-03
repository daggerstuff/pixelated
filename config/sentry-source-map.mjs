import path from 'node:path'

const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//

/**
 * Normalize sourcemap source entries before uploading them to Sentry.
 *
 * Astro emits virtual script ids such as
 * `Component.astro?astro&type=script&index=0&lang.ts`. Those ids are valid in
 * Vite's module graph but are not filesystem paths, so Sentry's source upload
 * resolver can fail while preparing debug-id artifacts.
 *
 * @param {string} source
 * @returns {string}
 */
export function rewriteSentrySource(source) {
  if (!source) return source

  const protocolMatch = source.match(PROTOCOL_REGEX)
  const protocol = protocolMatch?.[0].slice(0, -3)
  const sourceWithoutProtocol = source.replace(PROTOCOL_REGEX, '')
  const sourceWithoutVirtualRoot =
    protocol && protocol !== 'file'
      ? sourceWithoutProtocol.replace(/^\/+/, '')
      : sourceWithoutProtocol
  const sourceWithoutQuery = sourceWithoutVirtualRoot
    .split('?')[0]
    .split('#')[0]
  const normalizedSource = path.normalize(sourceWithoutQuery)
  const relativeSource = path.isAbsolute(normalizedSource)
    ? path.relative(process.cwd(), normalizedSource)
    : normalizedSource

  return relativeSource.replace(/\\/g, '/')
}
