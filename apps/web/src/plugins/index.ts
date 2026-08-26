/**
 * Astro plugins and remark plugins for enhanced markdown processing
 */

import type { AstroIntegration } from 'astro'

// Minimal AST node type for rehype/remark processing
interface AstNode {
  type: string
  children?: AstNode[]
  value?: string
  data?: Record<string, unknown>
}

function hasChildren(node: AstNode): node is AstNode & { children: AstNode[] } {
  return Array.isArray(node.children) && node.children.length > 0
}

// Simple rehype heading IDs implementation
function rehypeHeadingIds() {
  return (tree: AstNode) => {
    // Simple implementation - add IDs to headings
    function walk(node: AstNode) {
      if (node.type === 'heading' && hasChildren(node)) {
        const text = node.children
          .map((child: AstNode) => child.value ?? '')
          .join('')
        if (text) {
          node.data = node.data ?? {}
          const hProperties =
            (node.data['hProperties'] as Record<string, string>) ?? {}
          hProperties['id'] = text.toLowerCase().replace(/\s+/g, '-')
          node.data['hProperties'] = hProperties
        }
      }
      if (hasChildren(node)) {
        for (const child of node.children) {
          walk(child)
        }
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
export function visit(
  tree: AstNode,
  type: string,
  callback: (node: AstNode) => void,
) {
  if (!hasChildren(tree)) return

  for (const child of tree.children) {
    if (child.type === type) {
      callback(child)
    }
    // Recursively visit children
    if (hasChildren(child)) {
      visit(child, type, callback)
    }
  }
}

export default {
  rehypeHeadingIdsPlugin,
  visit,
}
