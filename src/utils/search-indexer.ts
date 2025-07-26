import type { SearchDocument } from '../lib/search'
import fs from 'node:fs/promises'
import path from 'node:path'

interface CollectionEntry {
  id: string
  slug: string
  data: {
    title?: string
    tags?: string[]
    category?: string
  }
  body: string
}

// Mock implementation instead of using astro:content
async function getCollection(
  collectionName: string,
): Promise<CollectionEntry[]> {
  try {
    const contentDir = path.join(
      process.cwd(),
      'src',
      'content',
      collectionName,
    )

    // Check if directory exists
    try {
      await fs.access(contentDir)
    } catch {
      console.log(`Collection directory not found: ${contentDir}`)
      return []
    }

    // Read all files in the directory
    const files = await fs.readdir(contentDir, { withFileTypes: true })
    const entries = []

    for (const file of files) {
      if (
        !file.isFile() ||
        (!file.name.endsWith('.md') && !file.name.endsWith('.mdx'))
      ) {
        continue
      }

      try {
        const filePath = path.join(contentDir, file.name)
        const content = await fs.readFile(filePath, 'utf-8')

        // Simple frontmatter extraction
        const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/)
        const frontmatter = frontmatterMatch ? frontmatterMatch[1] : ''

        // Extract title, tags, etc from frontmatter
        const titleMatch = frontmatter
          ? frontmatter.match(/title:\s*["']?(.*?)["']?\n/)
          : null
        const tagsMatch = frontmatter
          ? frontmatter.match(/tags:\s*\[(.*?)\]/)
          : null
        const categoryMatch = frontmatter
          ? frontmatter.match(/category:\s*["']?(.*?)["']?\n/)
          : null

        const title =
          titleMatch?.[1]?.trim() || file.name.replace(/\.(md|mdx)$/, '')
        const tags = tagsMatch?.[1]
          ? tagsMatch[1]
              .split(',')
              .map((tag) => tag.trim().replace(/["']/g, ''))
          : []
        const category = categoryMatch?.[1]?.trim() || collectionName

        // Remove frontmatter and get body content
        const body = content.replace(/---\n[\s\S]*?\n---/, '').trim()

        // Create slug from filename
        const slug = file.name.replace(/\.(md|mdx)$/, '')

        entries.push({
          id: slug,
          slug,
          data: { title, tags, category },
          body,
        })
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
      }
    }

    return entries
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error)
    return []
  }
}

/**
 * Type defining content that can be indexed
 */
export interface IndexableContent {
  id: string
  slug: string
  title: string
  content: string
  url: string
  tags?: string[]
  category?: string
  publishDate?: Date
  updatedDate?: Date
}

/**
 * Builds a search index from collections during the Astro build process
 * @param collections Names of collections to index
 * @returns Array of search documents for client-side indexing
 */
export async function buildSearchIndex(
  collections: string[] = ['blog', 'docs', 'guides'],
): Promise<SearchDocument[]> {
  const documents: SearchDocument[] = []

  try {
    // Process each content collection
    for (const collectionName of collections) {
      try {
        const entries = await getCollection(collectionName)

        if (!entries || entries.length === 0) {
          console.log(`No entries found for collection: ${collectionName}`)
          continue
        }

        console.log(`Indexing ${entries.length} entries from ${collectionName}`)

        // Convert entries to search documents
        const docs = entries.map((entry) => {
          const { id, slug, data, body } = entry
          const url = `/${collectionName}/${slug}/`

          // Extract metadata from entry
          const title = data.title || ''
          const tags = data.tags || []
          const category = data.category || collectionName

          // Create unique ID for document
          const documentId = `${collectionName}_${id}`

          return {
            id: documentId,
            title,
            content: body || '',
            url,
            tags,
            category,
          }
        })

        documents.push(...docs)
      } catch (error) {
        console.error(`Failed to index collection ${collectionName}:`, error)
      }
    }

    // Process pages with frontmatter that should be indexed
    // TODO: Add support for indexing static pages

    console.log(`Total indexed documents: ${documents.length}`)
    return documents
  } catch (error) {
    console.error('Failed to build search index:', error)
    return []
  }
}

/**
 * Process content to create a clean searchable text
 * Handles Markdown/MDX content
 * @param content Raw content
 * @returns Cleaned content
 */
export function processContent(content: string): string {
  if (!content) {
    return ''
  }

  // Remove frontmatter
  content = content.replace(/---[\s\S]*?---/, '')

  // Remove HTML tags
  content = content.replace(/<[^>]*>/g, ' ')

  // Remove Markdown syntax
  content = content
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Code blocks
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1') // Images
    .replace(/(?:^|\n)#{1,6}\s+(.*)/g, '$1') // Headings
    .replace(/\*\*([^*]*)\*\*/g, '$1') // Bold
    .replace(/\*([^*]*)\*/g, '$1') // Italic
    .replace(/~~([^~]*)~~/g, '$1') // Strikethrough
    .replace(/>\s+(.*)/g, '$1') // Blockquotes
    .replace(/\n\s*[-*+]\s+/g, '\n') // Lists
    .replace(/\n\s*\d+\.\s+/g, '\n') // Numbered lists

  // Remove extra whitespace
  content = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

  return content
}

/**
 * Create a search index file during build
 * This function is called from the Astro integration
 */
export async function createSearchIndexFile(): Promise<string> {
  const documents = await buildSearchIndex()

  // Create a serialized JSON string of the search documents
  const indexJson = JSON.stringify(documents)

  // Create JavaScript that sets the index in a global variable
  return `
// Auto-generated search index
// Do not edit directly
window.searchIndex = ${indexJson};

// Helper to initialize search with this index
window.initSearch = () => {
  if (typeof window.searchClient !== 'undefined' && window.searchIndex) {
    window.searchClient.importDocuments(window.searchIndex);
    console.log('Search index initialized with', window.searchIndex.length, 'documents');

    // Dispatch event to notify components that search is ready
    window.dispatchEvent(new CustomEvent('search:ready', {
      detail: {
        size: window.searchIndex.length
      }
    }));
  }
};

// Initialize search when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initSearch);
} else {
  window.initSearch();
}
`
}
