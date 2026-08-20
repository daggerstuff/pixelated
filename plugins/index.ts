// Type definitions for plugin arrays
type RemarkPlugin = (...args: unknown[]) => unknown
type RehypePlugin = (...args: unknown[]) => unknown
type RemarkPlugins = Array<RemarkPlugin | [RemarkPlugin, unknown]>
type RehypePlugins = Array<RehypePlugin | [RehypePlugin, unknown]>
import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import rehypeCallouts from 'rehype-callouts'
import type { CreateProperties } from 'rehype-external-links'
import rehypeExternalLinks from 'rehype-external-links'
import remarkImgattr from 'remark-imgattr'
import { visit } from 'unist-util-visit'

import { UI } from '../src/config'
import remarkReadingTime from './remark-reading-time'

export const remarkPlugins: RemarkPlugins = [
  // https://github.com/OliverSpeir/remark-imgattr
  remarkImgattr,
  remarkReadingTime,
]

export const rehypePlugins: RehypePlugins = [
  // https://docs.astro.build/en/guides/markdown-content/#heading-ids-and-plugins
  rehypeHeadingIds,
  // https://github.com/lin-stephanie/rehype-callouts
  [
    rehypeCallouts,
    {
      theme: 'vitepress',
    },
  ],
  // https://github.com/rehypejs/rehype-external-links
  [
    rehypeExternalLinks,
    {
      rel: UI.externalLink.newTab ? 'noopener noreferrer' : [],
      content: (el: Parameters<CreateProperties>[0]) => {
        if (!UI.externalLink.newTab || !UI.externalLink.showNewTabIcon) {
          return null
        }

        let hasImage = false
        visit(el, 'element', (childNode) => {
          if (childNode.tagName === 'img') {
            hasImage = true
            return false
          }
          return undefined
        })
        if (hasImage) {
          return null
        }

        return {
          type: 'text',
          value: '',
        }
      },
      contentProperties: (el: Parameters<CreateProperties>[0]) => {
        if (!UI.externalLink.newTab || !UI.externalLink.showNewTabIcon) {
          return null
        }

        let hasImage = false
        visit(el, 'element', (childNode) => {
          if (childNode.tagName === 'img') {
            hasImage = true
            return false
          }
          return undefined
        })
        if (hasImage) {
          return null
        }

        return {
          'u-i-lucide-external-link': true,
          'className': ['new-tab-icon'],
          'aria-hidden': 'true',
        }
      },
      properties: (el: Parameters<CreateProperties>[0]) => {
        const props: Record<string, unknown> = {}
        const href = el.properties?.['href']

        if (!href || typeof href !== 'string') {
          return props
        }

        if (UI.externalLink.newTab) {
          props['target'] = '_blank'
          props['ariaLabel'] = 'Open in new tab'
          if (
            UI.externalLink.cursorType.length > 0 &&
            UI.externalLink.cursorType !== 'pointer'
          ) {
            props['className'] = Array.isArray(el.properties?.['className'])
              ? [...el.properties['className'], 'external-link-cursor']
              : ['external-link-cursor']
          }
        }

        return props
      },
    },
  ],
]
