import { readFileSync, existsSync } from 'fs'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

export default defineTool({
  description: 'Reads the contents of a file.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file to read'),
  }),
  async execute({ path }) {
    try {
      if (!existsSync(path)) {
        return `File not found: ${path}`
      }
      const content = readFileSync(path, 'utf-8')
      return `## ${path}\n\n${content}`
    } catch (e: any) {
      return `Error reading file: ${e.message}`
    }
  },
})
