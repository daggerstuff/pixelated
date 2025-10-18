/**
 * Remark plugin for calculating reading time
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
}

// Simple implementation for reading time calculation
export function remarkReadingTime() {
  return (tree: Root, file: any) => {
    // Calculate reading time based on word count
    const textContent = extractText(tree)
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length
    const readingTime = Math.ceil(wordCount / 200) // Average reading speed: 200 words per minute
    
    // Store reading time in file data for later use
    if (file?.data) {
      file.data.readingTime = readingTime
      file.data.wordCount = wordCount
    }
    
    return tree
  }
}

function extractText(tree: Root): string {
  let text = ''
  
  function walk(node: any) {
    if (node.type === 'text' && node.value) {
      text += node.value + ' '
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  
  walk(tree)
  return text.trim()
}

export default remarkReadingTime