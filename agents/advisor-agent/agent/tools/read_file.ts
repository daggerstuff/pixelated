import { readFileSync, existsSync } from 'fs'
import path from 'node:path'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

export default defineTool({
  description: 'Reads the contents of a file.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file to read'),
  }),
  async execute({ path: requestedPath }) {
    try {
      const projectRoot = process.cwd()
      const resolvedPath = path.resolve(projectRoot, requestedPath)

      // Prevent path traversal: the resolved path must stay inside the
      // workspace root, so relative segments and absolute paths cannot
      // reach files outside the project.
      if (
        resolvedPath !== projectRoot &&
        !resolvedPath.startsWith(projectRoot + path.sep)
      ) {
        return `Error reading file: path escapes the workspace root: ${requestedPath}`
      }

      if (!existsSync(resolvedPath)) {
        return `File not found: ${requestedPath}`
      }
      const content = readFileSync(resolvedPath, 'utf-8')
      return `## ${resolvedPath}\n\n${content}`
    } catch (e: any) {
      return `Error reading file: ${e.message}`
    }
  },
})
