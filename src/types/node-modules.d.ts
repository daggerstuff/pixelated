// Type declarations for third-party modules without type definitions

declare module 'unist-util-visit' {
  import type { Node, Visitor } from 'unist'
  export function visit<T extends Node>(
    tree: T,
    test: string | ((node: Node) => boolean),
    visitor: Visitor<T>,
  ): void
  export function visit<T extends Node>(tree: T, visitor: Visitor<T>): void
}

declare module '@astrojs/markdown-remark' {
  import type { Plugin } from 'unified'
  export const rehypeHeadingIds: Plugin
}

// types module
