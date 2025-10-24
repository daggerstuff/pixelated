/**
 * Astro plugins and remark plugins for enhanced markdown processing
 */

import type { AstroIntegration } from 'astro'

// Simple rehype heading IDs implementation
function rehypeHeadingIds() {
  return (tree: any) => {
    // Simple implementation - add IDs to headings
    function walk(node: any) {
      if (node.type === 'heading' && node.children) {
        const text = node.children
          .map((child: any) => child.value || '')
          .join('')
        if (text) {
          node.data = node.data || {}
          node.data.hProperties = node.data.hProperties || {}
          node.data.hProperties.id = text.toLowerCase().replace(/\s+/g, '-')
        }
      }
      if (node.children) {
        node.children.forEach(walk)
      }
    }
    walk(tree)
    return tree
  }
}

// Simple plugin to add heading IDs to markdown
export function rehypeHeadingIdsPlugin(): AstroIntegration {
  return {
    name: 'rehype-heading-ids',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          markdown: {
            rehypePlugins: [rehypeHeadingIds],
          },
        })
      },
    },
  }
}

// Placeholder for unist-util-visit functionality
export function visit(tree: any, type: string, callback: (node: any) => void) {
  if (!tree || !tree.children) return

  for (const child of tree.children) {
    if (child.type === type) {
      callback(child)
    }
    // Recursively visit children
    if (child.children) {
      visit(child, type, callback)
    }
  }
}

export default {
  rehypeHeadingIdsPlugin,
  visit,
}
