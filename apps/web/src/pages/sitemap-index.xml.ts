import type { APIRoute } from 'astro'

import { SITE } from '../config'

const BASE = SITE.website.replace(/\/$/, '')

/**
 * Sitemap index that points crawlers at the single generated sitemap.
 * Kept at the /sitemap-index.xml path referenced from <head> across the site.
 */
export const GET: APIRoute = async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
