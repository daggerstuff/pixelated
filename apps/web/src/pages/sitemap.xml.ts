import type { APIRoute } from 'astro'

import { SITE } from '../config'
import { getContentSlug } from '../utils/blog'

const BASE = SITE.website.replace(/\/$/, '')

interface SitemapEntry {
  loc: string
  lastmod?: string
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function urlEntry({ loc, lastmod }: SitemapEntry): string {
  return `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
}

// Mirrors the slug resolution in pages/blog/[...slug].astro
async function getBlogUrls(): Promise<SitemapEntry[]> {
  const { getCollection } = await import('astro:content')
  const blog = await getCollection('blog')
  return blog
    .filter((item) => !item.data.draft)
    .map((item) => {
      const slug = getContentSlug(item)
      const lastmod =
        (item.data.lastModDate && item.data.lastModDate !== ''
          ? new Date(item.data.lastModDate).toISOString()
          : undefined) ??
        (item.data.pubDate
          ? new Date(item.data.pubDate).toISOString()
          : undefined)
      return { loc: `${BASE}/blog/${slug}`, lastmod }
    })
}

// Mirrors the slug resolution in pages/docs/[...slug].astro
async function getDocsUrls(): Promise<SitemapEntry[]> {
  const { getCollection } = await import('astro:content')
  const docs = await getCollection('docs')
  return docs
    .filter((item) => !item.data.draft)
    .map((item) => {
      const slug = getContentSlug(item)
      const lastmod =
        item.data.lastModDate && item.data.lastModDate !== ''
          ? new Date(item.data.lastModDate).toISOString()
          : undefined
      return { loc: `${BASE}/docs/${slug}`, lastmod }
    })
}

// Mirrors the slug resolution in pages/changelog/[slug].astro
async function getChangelogUrls(): Promise<SitemapEntry[]> {
  const { getCollection } = await import('astro:content')
  const changelog = await getCollection('changelog')
  return changelog.map((item) => {
    const slug = getContentSlug(item)
    const lastmod = item.data.pubDate
      ? new Date(item.data.pubDate).toISOString()
      : undefined
    return { loc: `${BASE}/changelog/${slug}`, lastmod }
  })
}

// Public content-bearing pages. App areas (dashboard, portal, admin, ...)
// and middleware-gated internal pages are deliberately excluded and blocked
// in robots.txt.
const STATIC_PATHS = [
  '',
  'about',
  'accessibility',
  'blog',
  'book',
  'careers',
  'changelog',
  'company',
  'contact',
  'cookie-policy',
  'demo-hub',
  'docs',
  'docs/getting-started',
  'docs/developer',
  'features',
  'mental-health-demo',
  'privacy',
  'projects',
  'research',
  'security',
  'team',
  'terms',
  'trust',
]

export const GET: APIRoute = async () => {
  const [blog, docs, changelog] = await Promise.all([
    getBlogUrls(),
    getDocsUrls(),
    getChangelogUrls(),
  ])

  const urls: SitemapEntry[] = [
    ...STATIC_PATHS.map((path) => ({ loc: `${BASE}/${path}` })),
    ...blog,
    ...docs,
    ...changelog,
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlEntry).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
