// @vitest-environment node
import * as fs from 'fs'
import * as path from 'path'

import { describe, it, expect } from 'vitest'

describe('Security Scanning Configuration', () => {
  describe('GitHub Workflow Configuration', () => {
    it('should have proper security scanning workflow configuration', () => {
      const fastWorkflowPath = path.join(
        process.cwd(),
        '.github/workflows/security.yml',
      )
      const deepWorkflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-deep.yml',
      )

      expect(fs.existsSync(fastWorkflowPath)).toBe(true)
      expect(fs.existsSync(deepWorkflowPath)).toBe(true)

      const fastWorkflowContent = fs.readFileSync(fastWorkflowPath, 'utf8')
      const deepWorkflowContent = fs.readFileSync(deepWorkflowPath, 'utf8')

      expect(fastWorkflowContent).toContain('name: Security Scanning')
      expect(deepWorkflowContent).toContain('trivy-action')
      expect(deepWorkflowContent).toContain('checkov-action')
      expect(deepWorkflowContent).toContain('sarif')
    })

    it('should have security baseline configuration', () => {
      const baselinePath = path.join(process.cwd(), 'security-baseline.json')

      expect(fs.existsSync(baselinePath)).toBe(true)

      const baselineContent = fs.readFileSync(baselinePath, 'utf8')
      const baseline = JSON.parse(baselineContent) as {
        version: unknown
        baseline: { security_policies: unknown }
      }

      expect(baseline.version).toBeDefined()
      expect(baseline.baseline).toBeDefined()
      expect(baseline.baseline.security_policies).toBeDefined()
    })

    it('should have security library with core functions', () => {
      const securityLibPath = path.join(
        process.cwd(),
        'apps/web/src/lib/security',
      )

      expect(fs.existsSync(securityLibPath)).toBe(true)

      // Check for key security files
      const securityFiles = fs.readdirSync(securityLibPath)
      expect(securityFiles.some((file) => file.includes('index'))).toBe(true)
    })

    it('should have proper CodeQL configuration', () => {
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-deep.yml',
      )

      const workflowContent = fs.readFileSync(workflowPath, 'utf8')

      expect(workflowContent).toContain('codeql-analysis')
      expect(workflowContent).toMatch(/ubuntu-\w+/)
    })

    it('should have proper dependency scanning', () => {
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security.yml',
      )

      const workflowContent = fs.readFileSync(workflowPath, 'utf8')

      expect(workflowContent).toContain('dependency-check')
      expect(workflowContent).toContain('pnpm audit')
    })
  })
})
