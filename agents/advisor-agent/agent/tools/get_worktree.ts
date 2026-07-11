import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { execSync } from 'child_process'

export default defineTool({
  description: 'Gets the current git status and diff for the workspace.',
  inputSchema: z.object({}),
  async execute() {
    try {
      const status =
        execSync('git status --porcelain', { encoding: 'utf-8' }) || '(clean)'
      const diff =
        execSync('git diff HEAD --no-color', { encoding: 'utf-8' }) || '(none)'
      return `## git status\n${status}\n\n## git diff HEAD\n${diff}`
    } catch (e: any) {
      return `Error getting worktree: ${e.message}`
    }
  },
})
