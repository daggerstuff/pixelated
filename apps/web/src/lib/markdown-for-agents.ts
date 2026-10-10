import TurndownService from 'turndown'

let converter: TurndownService | null = null

function getConverter(): TurndownService {
  if (!converter) {
    converter = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    })
    converter.remove(['script', 'style', 'noscript', 'iframe', 'svg'])
    converter.addRule('stripEmptyLinks', {
      filter: (node) => node.nodeName === 'A' && !node.getAttribute('href'),
      replacement: (content) => content,
    })
  }
  return converter
}

/**
 * Convert an HTML document to markdown for agents (Markdown for Agents
 * convention): YAML frontmatter from title/description meta, body markdown,
 * JSON-LD fenced block at the end.
 */
export function htmlToAgentMarkdown(html: string, pageUrl: string): string {
  const converter = getConverter()

  const title =
    extractMetaContent(html, 'property="og:title"') ??
    extractTagContent(html, 'title')
  const description =
    extractMetaContent(html, 'name="description"') ??
    extractMetaContent(html, 'property="og:description"')

  let body: string
  try {
    body = converter.turndown(html).trim()
  } catch {
    return ''
  }
  if (!body) {
    return ''
  }

  const frontmatterLines = ['---']
  if (title) frontmatterLines.push(`title: ${JSON.stringify(title.trim())}`)
  if (description)
    frontmatterLines.push(`description: ${JSON.stringify(description.trim())}`)
  frontmatterLines.push(`url: ${JSON.stringify(pageUrl)}`)
  frontmatterLines.push('---')

  const parts = [frontmatterLines.join('\n'), '', body]
  return parts.join('\n')
}

function extractMetaContent(html: string, marker: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]*${marker.replace(/"/g, '"')}[^>]*content="([^"]*)"`,
    'i',
  )
  return html.match(re)?.[1]
}

function extractTagContent(html: string, tag: string): string | undefined {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]
}
