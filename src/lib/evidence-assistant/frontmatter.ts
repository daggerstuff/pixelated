import matter from 'gray-matter'

export interface ParsedEvidenceFrontmatter {
  body: string
  title: string
  tags: string[]
  category?: string
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((tag): tag is string => Boolean(tag))
      .map((tag) => tag.toLowerCase())
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => normalizeString(tag))
      .filter((tag): tag is string => Boolean(tag))
      .map((tag) => tag.toLowerCase())
  }

  return []
}

function inferTitle(markdownBody: string): string | undefined {
  return markdownBody
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))
    ?.replace(/^#\s+/, '')
}

export function parseEvidenceFrontmatter(
  raw: string,
): ParsedEvidenceFrontmatter {
  try {
    const parsed = matter(raw)
    const data = parsed.data as Record<string, unknown>
    const title =
      normalizeString(data.title) ?? inferTitle(parsed.content) ?? 'Untitled'
    const category =
      normalizeString(data.category) ?? normalizeString(data.series)

    return {
      body: parsed.content,
      title,
      tags: normalizeTags(data.tags),
      category,
    }
  } catch {
    const trimmed = raw.trim()
    const frontmatterMatch = trimmed.match(/^---\n[\s\S]*?\n---\n?/)
    const body = frontmatterMatch
      ? trimmed.slice(frontmatterMatch[0].length)
      : trimmed

    return {
      body,
      title: inferTitle(body) ?? 'Untitled',
      tags: [],
      category: undefined,
    }
  }
}
