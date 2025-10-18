/**
 * Remark plugin for image container processing
 */

// Simple type definitions for mdast
interface Root {
  type: 'root'
  children: Node[]
}

interface Paragraph {
  type: 'paragraph'
  children: PhrasingContent[]
}

interface PhrasingContent {
  type: string
  url?: string
  alt?: string
  value?: string
  children?: Node[]
}

// Simple type definitions for mdast
interface Node {
  type: string
  children?: Node[]
  value?: string
  url?: string
  alt?: string
  data?: any
}

interface ImageNode extends Node {
  type: 'image'
  url: string
  alt?: string
}

interface ParagraphNode extends Node {
  type: 'paragraph'
  children: Node[]
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

export function remarkImageContainer() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: any) => {
      const paragraph = node as ParagraphNode
      
      // Check if paragraph contains only images
      if (paragraph.children && paragraph.children.length > 0) {
        const hasOnlyImages = paragraph.children.every((child: any) => child.type === 'image')
        
        if (hasOnlyImages) {
          // Transform paragraph to image container
          paragraph.data = {
            hName: 'div',
            hProperties: {
              className: ['image-container'],
            },
          }
        }
      }
    })
  }
}

export default remarkImageContainer