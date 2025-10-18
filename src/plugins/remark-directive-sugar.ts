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
  data?: any
}

interface DirectiveNode extends Node {
  type: 'textDirective' | 'leafDirective' | 'containerDirective'
  name: string
  attributes?: Record<string, string>
}

// Simple visit function implementation - local version
function visit(tree: Node, test: string | ((node: Node) => boolean), callback: (node: Node) => void) {
  const testFn = typeof test === 'string' ? (node: Node) => node.type === test : test
  
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
    visit(tree, (node: any) => {
      // Process directive nodes
      if (node.type && node.type.includes('Directive')) {
        const directiveNode = node as DirectiveNode
        
        // Handle different directive types
        switch (directiveNode.name) {
          case 'note':
            // Transform note directives
            if (directiveNode.children) {
              directiveNode.type = 'paragraph'
              directiveNode.data = {
                hName: 'div',
                hProperties: {
                  className: ['note', 'directive-note'],
                },
              }
            }
            break
            
          case 'warning':
            // Transform warning directives
            if (directiveNode.children) {
              directiveNode.type = 'paragraph'
              directiveNode.data = {
                hName: 'div',
                hProperties: {
                  className: ['warning', 'directive-warning'],
                },
              }
            }
            break
            
          case 'tip':
            // Transform tip directives
            if (directiveNode.children) {
              directiveNode.type = 'paragraph'
              directiveNode.data = {
                hName: 'div',
                hProperties: {
                  className: ['tip', 'directive-tip'],
                },
              }
            }
            break
        }
      }
    })
  }
}

export default remarkDirectiveSugar