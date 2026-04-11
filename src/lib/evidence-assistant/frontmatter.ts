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
  }

  if (typeof value === 'string') {
    const bracketList = value.match(/^\[(.*)\]$/)
    const source = bracketList ? bracketList[1] : value
    return source
      .split(',')
      .map((tag) => normalizeString(tag))
      .filter((tag): tag is string => Boolean(tag))
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
  const trimmed = raw.trim()
  const frontmatterMatch = trimmed.match(/^---\n([\s\S]*?)\n---\n?/)

  if (!frontmatterMatch) {
    return {
      body: trimmed,
      title: inferTitle(trimmed) ?? 'Untitled',
      tags: [],
      category: undefined,
    }
  }

  try {
    const rawFrontmatter = frontmatterMatch[1] ?? ''
    const parsed: Record<string, unknown> = {}
    const lines = rawFrontmatter.split('\n')

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim()
      if (!line || line.startsWith('#')) continue

      const [rawKey, ...rest] = line.split(':')
      const key = rawKey?.trim()
      if (!key) continue

      const remainder = rest.join(':').trim()

      if (remainder.length === 0) {
        const values: string[] = []
        let cursor = index + 1
        while (cursor < lines.length) {
          const listLine = lines[cursor] ?? ''
          const listMatch = listLine.match(/^\s*-\s*(.+)\s*$/)
          if (!listMatch) break
          const listValue = normalizeString(listMatch[1]?.replace(/^["']|["']$/g, ''))
          if (listValue) values.push(listValue)
          cursor += 1
        }
        parsed[key] = values
        index = cursor - 1
        continue
      }

      parsed[key] = remainder.replace(/^["']|["']$/g, '')
    }

    const body = trimmed.slice(frontmatterMatch[0].length)
    const title = normalizeString(parsed.title) ?? inferTitle(body) ?? 'Untitled'
    const category =
      normalizeString(parsed.category) ?? normalizeString(parsed.series)

    return {
      body,
      title,
      tags: normalizeTags(parsed.tags),
      category,
    }
  } catch {
    const body = trimmed.slice(frontmatterMatch[0].length)
    return {
      body,
      title: inferTitle(body) ?? 'Untitled',
      tags: [],
      category: undefined,
    }
  }
}
