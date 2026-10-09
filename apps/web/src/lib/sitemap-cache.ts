import { SITE } from '../config'

const SITE_ORIGIN = SITE.website.replace(/\/$/, '')

let cached: { xml: string; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

/** Fetches (and briefly caches) this site's own sitemap for MCP tools. */
export async function getSitemapXml(): Promise<string> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.xml
  }
  const response = await fetch(`${SITE_ORIGIN}/sitemap.xml`)
  const xml = await response.text()
  cached = { xml, fetchedAt: Date.now() }
  return xml
}
