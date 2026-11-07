export interface VNode {
  type: string | object
  props?: Record<string, any>
  children?: string | VNode | Array<string | VNode>
}

/**
 * Slugify a string
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean)
    .join('-')
}

/**
 * Get URL from paths
 */
export function getUrl(...paths: string[]): string {
  return paths.join('/')
}

/**
 * Unescape HTML entities in a given virtual DOM node's children.
 * Recursively processes nested children to ensure all entities are properly unescaped.
 */
export function unescapeHTML(
  node: VNode | null | undefined,
): VNode | null | undefined {
  if (!node) {
    return node
  }

  const { children } = node

  if (!children) {
    return node
  } else if (typeof children === 'string') {
    return {
      ...node,
      children: children
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x3D;/g, '=')
        .replace(/&amp;/g, '&'),
    }
  } else if (Array.isArray(children)) {
    return {
      ...node,
      children: children
        .map((child) =>
          typeof child === 'object' ? unescapeHTML(child) : child,
        )
        .filter(
          (child): child is string | VNode =>
            child !== null && child !== undefined,
        ),
    }
  } else if (typeof children === 'object') {
    return {
      ...node,
      children: unescapeHTML(children) ?? undefined,
    }
  }

  return node
}
