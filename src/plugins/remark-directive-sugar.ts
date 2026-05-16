/**
 * Remark plugin for directive sugar processing
 */

// Simple type definitions for mdast
interface Root {
  type: 'root'
  children: Node[]
}

interface Node {
  type: string
  children?: Node[]
  value?: string
  name?: string
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

interface DirectiveNode extends Node {
  name: string
  attributes?: Record<string, string>
}

const isDirectiveNode = (node: Node): node is DirectiveNode =>
  (node.type === 'textDirective' ||
    node.type === 'leafDirective' ||
    node.type === 'containerDirective') &&
  typeof node.name === 'string'

// Simple visit function implementation - local version
function visit(
  tree: Node,
  test: string | ((node: Node) => boolean),
  callback: (node: Node) => void,
) {
  const testFn =
    typeof test === 'string' ? (node: Node) => node.type === test : test

  function walk(node: Node) {
    if (testFn(node)) {
      callback(node)
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }

  walk(tree)
}

export function remarkDirectiveSugar() {
  return (tree: Root) => {
    visit(
      tree,
      () => true,
      (node: Node) => {
        // Process directive nodes
        if (isDirectiveNode(node)) {
          // Handle different directive types
          switch (node.name) {
            case 'note':
              // Transform note directives
              if (node.children) {
                node.type = 'paragraph'
                node.data = {
                  hName: 'div',
                  hProperties: {
                    className: ['note', 'directive-note'],
                  },
                }
              }
              break

            case 'warning':
              // Transform warning directives
              if (node.children) {
                node.type = 'paragraph'
                node.data = {
                  hName: 'div',
                  hProperties: {
                    className: ['warning', 'directive-warning'],
                  },
                }
              }
              break

            case 'tip':
              // Transform tip directives
              if (node.children) {
                node.type = 'paragraph'
                node.data = {
                  hName: 'div',
                  hProperties: {
                    className: ['tip', 'directive-tip'],
                  },
                }
              }
              break
          }
        }
      },
    )
  }
}

export default remarkDirectiveSugar
