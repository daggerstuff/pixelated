/**
 * Remark plugin for generating OpenGraph images
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
  depth?: number
}

// Simple chalk implementation for logging
const chalk = {
  blue: (text: string) => text,
  green: (text: string) => text,
  yellow: (text: string) => text,
  red: (text: string) => text,
  bold: (text: string) => text,
}

export function remarkGenerateOgImage() {
  return (tree: Root, file: any) => {
    // Simple implementation - just log the processing
    console.log(chalk.blue('Processing OG image generation for:'), file?.path || 'unknown file')
    
    // Add metadata for OG image generation
    if (file?.data) {
      file.data.ogImage = {
        title: extractTitle(tree),
        description: extractDescription(tree),
      }
    }
    
    return tree
  }
}

function extractTitle(tree: Root): string {
  // Extract title from heading
  let title = 'Default Title'
  
  function walk(node: any) {
    if (node.type === 'heading' && node.depth === 1) {
      if (node.children && node.children[0] && node.children[0].value) {
        title = node.children[0].value
      }
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  
  walk(tree)
  return title
}

function extractDescription(tree: Root): string {
  // Extract first paragraph as description
  let description = 'Default description'
  let foundFirstParagraph = false
  
  function walk(node: any) {
    if (node.type === 'paragraph' && !foundFirstParagraph) {
      if (node.children && node.children[0] && node.children[0].value) {
        description = node.children[0].value.substring(0, 160)
        foundFirstParagraph = true
      }
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  
  walk(tree)
  return description
}

export default remarkGenerateOgImage