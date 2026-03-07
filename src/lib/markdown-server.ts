/**
 * Server-side Markdown utility functions for parsing and rendering Markdown
 * using the full remark/rehype pipeline.
 */

import { remark } from 'remark'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

/**
 * Parse and render Markdown to HTML using the full remark/rehype pipeline.
 * This function is intended for server-side use only.
 * @param content Markdown content
 * @returns Rendered HTML
 */
export async function renderMarkdown(content: string): Promise<string> {
  if (!content) {
    return ''
  }

  const result = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeKatex)
    .use(rehypeExternalLinks, {
      target: '_blank',
      rel: ['nofollow', 'noopener'],
    })
    .use(rehypeAutolinkHeadings)
    .use(rehypeStringify)
    .process(content)

  return String(result)
}

export default {
  renderMarkdown,
}
