/**
 * @description Register directive nodes in mdast.
 * @see https://github.com/remarkjs/remark-directive?tab=readme-ov-file#types
 */
/// <reference types="mdast-util-directive" />

import type { Root } from 'mdast'

import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'

type BadgePreset = Record<string, { text: string; color: string }>
interface Config {
  badge: {
    defaultColor: string
    preset: BadgePreset
  }
}

/* video */
const VIDEO_PLATFORMS: Record<string, (id: string) => string> = {
  youtubeId: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  bilibiliId: (id) => `https://player.bilibili.com/player.html?bvid=${id}`,
  vimeoId: (id) => `https://player.vimeo.com/video/${id}`,
}

/* link */
const GITHUB_USERNAME_REGEXP = /^@[a-z0-9](?!.*--)[\w-]{0,37}[a-z0-9]$/i
const GITHUB_REPO_REGEXP = /^@?([a-z0-9](?!.*--)[\w-]{0,37}[a-z0-9])\/.*$/i
const LINK_STYLE = ['square', 'rounded', 'github'] as const
const TAB_ORG_REGEXP = /^org-(\w+)$/
const GITHUB_TAB = [
  'repositories',
  'projects',
  'packages',
  'stars',
  'sponsoring',
  'sponsors',
  'org-repositories',
  'org-projects',
  'org-packages',
  'org-sponsoring',
  'org-people',
]

/* badge */
const CONFIG: Config = {
  badge: {
    defaultColor: '#bebfc5',
    preset: {
      a: { text: 'ARTICLE', color: '#E9D66B|#fbf8cc' },
      v: { text: 'VIDEO', color: '#D473D4|#f1c0e8' },
      o: { text: 'OFFICIAL', color: '#4a8ce8|#a3c4f3' },
      f: { text: 'FEED', color: '#9568de|#cfbaf0' },
      t: { text: 'TOOL', color: '#FF9966|#ffcfd2' },
      w: { text: 'WEBSITE', color: '#8AB9F1|#90dbf4' },
      g: { text: 'GITHUB', color: '#74C365|#b9fbc0' },
    },
  },
}
const VALID_BADGES = new Set(Object.keys(CONFIG.badge.preset))

/**
 * In MDX/Markdown, supports regular
 * {@link https://github.com/remarkjs/remark-directive?tab=readme-ov-file#use remark-directive usage},
 * along with the following predefined directives:
 *
 *  - `::video`: enable consistent video embedding.
 *  - `:link`: link to GitHub users/repositories or other external URLs in Markdown/MDX. (Inspired by: https://github.com/antfu/markdown-it-magic-link)
 *  - `:badge`/`:badge-*`: customizable badge-like markers.
 */
function remarkDirectiveSugar() {
  /**
   * @param {import('mdast').Root} tree
   *   Tree.
   * @param {import('vfile').VFile} file
   *   File.
   */
  return (tree: Root, file: VFile) => {
    visit(tree, (node) => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const data = node.data || (node.data = {})
        const attributes = node.attributes || {}
        const { children } = node

        if (node.name === 'video') {
          /* ::video */
          if (node.type === 'textDirective') {
            file.fail(
              'Unexpected `:video` text directive. Use double colons (`::`) for an `video` leaf directive.',
              node,
            )
          }

          if (node.type === 'containerDirective') {
            file.fail(
              'Unexpected `:::video` container directive. Use double colons (`::`) for an `video` leaf directive.',
              node,
            )
          }

          // handle attributes
          let src = ''
          const { youtubeId, bilibiliId, vimeoId, iframeSrc } = attributes

          if (!youtubeId && !bilibiliId && !vimeoId && !iframeSrc) {
            file.fail(
              'Invalid `video` directive. Unexpectedly missing one of the following: `youtubeId`, `bilibiliId`, `iframeSrc`.',
              node,
            )
          } else {
            for (const [key, id] of Object.entries({
              youtubeId,
              bilibiliId,
              vimeoId,
            })) {
              if (id) {
                const platformFn = VIDEO_PLATFORMS[key]
                if (platformFn) {
                  src = platformFn(id)
                  break
                }
              }
            }
            if (!src && iframeSrc) {
              src = iframeSrc
            }
          }

          // nested in div（otherwise, the transform style won't apply）
          data.hName = 'div'
          data.hProperties = {
            class: 'sugar-video',
            style: `${attributes['noScale'] && 'margin: 1rem 0'}`,
          }
          data.hChildren = [
            {
              type: 'element',
              tagName: 'iframe',
              properties: {
                style: `${attributes['noScale'] && 'transform: none'}`,
                src,
                title: attributes['title'] || 'Video Player',
                loading: 'lazy',
                allow:
                  'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                allowFullScreen: true,
              },
              children: [],
            },
          ]
        } else if (node.name === 'link') {
          /* :link */
          if (node.type === 'leafDirective') {
            file.fail(
              'Unexpected `::link` text directive. Use single colon (`:`) for an `link` text directive.',
              node,
            )
          }

          if (node.type === 'containerDirective') {
            file.fail(
              'Unexpected `:::link` container directive. Use single colon (`:`) for an `link` text directive.',
              node,
            )
          }

          let _resolvedText = ''
          let _resolvedStyle = ''
          let _resolvedTab = ''
          let isOrg = false

          const { id, link, tab, style } = attributes

          // check label
          if (children.length > 0 && children[0]?.type === 'text') {
            _resolvedText = children[0].value
          } else if (!id) {
            file.fail(
              'Invalid `link` directive. The text in the `[]` of `:link[]{}` is required if `id` attribute is not specified.',
              node,
            )
          }

          // check type
          if (style && (LINK_STYLE as readonly string[]).includes(style)) {
            _resolvedStyle = style as typeof _resolvedStyle
          } else if (
            style &&
            !(LINK_STYLE as readonly string[]).includes(style)
          ) {
            file.fail(
              'Invalid `link` directive. The `style` must be one of "square", "rounded", or "github".',
              node,
            )
          }

          // check tab
          if (tab && !GITHUB_TAB.includes(tab)) {
            file.fail(
              'Invalid `link` directive. The `tab` must be one of the following: "repositories", "projects", "packages", "stars", "sponsoring", "sponsors", "org-repositories", "org-projects", "org-packages", "org-sponsoring", or "org-people".',
              node,
            )
          } else if (tab) {
            const match = tab.match(TAB_ORG_REGEXP)
            if (match && match[1]) {
              isOrg = true
              _resolvedTab = match[1]
            } else {
              _resolvedTab = tab
            }
          }

          // handle
          if (!id && link) {
            // non github scope
            _resolvedStyle = _resolvedStyle || 'square'
          } else if (id) {
            // github scope
            if (id.match(GITHUB_USERNAME_REGEXP)) {

              _resolvedStyle = _resolvedStyle || 'rounded'
              _resolvedText = _resolvedText || id.substring(1)
            } else if (id.match(GITHUB_REPO_REGEXP)) {

              _resolvedStyle = _resolvedStyle || 'rounded'
              _resolvedText = _resolvedText || id.substring(1)
            }
          }
        } else if (node.name === 'badge') {
          /* :badge */
          if (node.type === 'textDirective') {
            file.fail(
              'Unexpected `:badge` text directive. Use single colon (`:`) for an `badge` text directive.',
              node,
            )
          }

          if (node.type === 'containerDirective') {
            file.fail(
              'Unexpected `:::badge` container directive. Use single colon (`:`) for an `badge` text directive.',
              node,
            )
          }

          let resolvedBadgeText = ''
          let resolvedBadgeColor = ''

          const { id: badgeId } = attributes

          if (badgeId && VALID_BADGES.has(badgeId)) {
            const badge = CONFIG.badge.preset[badgeId]
            if (badge) {
              resolvedBadgeText = badge.text
              resolvedBadgeColor = badge.color
            }
          } else if (!badgeId) {
            file.fail(
              'Invalid `badge` directive. The text in the `[]` of `:badge[]{}` is required if `id` attribute is not specified.',
              node,
            )
          }

          data.hName = 'span'
          data.hProperties = {
            class: 'sugar-badge',
            style: `background-color: ${resolvedBadgeColor};`,
          }
          data.hChildren = [
            {
              type: 'text',
              value: resolvedBadgeText,
            },
          ]
        }
      }
    })
  }
}

export default remarkDirectiveSugar
