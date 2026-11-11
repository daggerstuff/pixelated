export const CANONICAL_HOST = 'pixelatedempathy.com'

export function canonicalHostRedirect(url: URL): URL | null {
  if (!url.hostname.startsWith('www.')) {
    return null
  }
  const target = new URL(url.toString())
  target.hostname = CANONICAL_HOST
  target.port = ''
  target.protocol = 'https:'
  return target
}
