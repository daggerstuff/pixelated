import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Security Scanning Configuration', () => {
  describe('GitHub Workflow Configuration', () => {
    it('should have proper security scanning workflow configuration', () => {
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-scanning.yml',
      )

      expect(fs.existsSync(workflowPath)).toBe(true)

      const workflowContent = fs.readFileSync(workflowPath, 'utf8')

      // Check for required workflow components
      expect(workflowContent).toContain('name: Security Scanning')
      expect(workflowContent).toContain('trivy-action')
      expect(workflowContent).toContain('checkov-action')
      expect(workflowContent).toContain('sarif')
    })

    it('should have security baseline configuration', () => {
      const baselinePath = path.join(process.cwd(), 'security-baseline.json')

      expect(fs.existsSync(baselinePath)).toBe(true)

      const baselineContent = fs.readFileSync(baselinePath, 'utf8')
      const baseline = JSON.parse(baselineContent) as unknown

      expect(baseline.version).toBeDefined()
      expect(baseline.baseline).toBeDefined()
      expect(baseline.baseline.security_policies).toBeDefined()
    })

    it('should have security library with core functions', () => {
      const securityLibPath = path.join(process.cwd(), 'src/lib/security')

      expect(fs.existsSync(securityLibPath)).toBe(true)

      // Check for key security files
      const securityFiles = fs.readdirSync(securityLibPath)
      expect(securityFiles.some((file) => file.includes('index'))).toBe(true)
    })

    it('should have proper CodeQL configuration', () => {
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-scanning.yml',
      )

      const workflowContent = fs.readFileSync(workflowPath, 'utf8')

      // Check for security scanning components
      expect(workflowContent).toContain('security-scan')
      expect(workflowContent).toContain('ubuntu-latest')
    })

    it('should have proper dependency scanning', () => {
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-scanning.yml',
      )

      const workflowContent = fs.readFileSync(workflowPath, 'utf8')

      // Check for dependency scanning
      expect(workflowContent).toContain('dependency-check')
      expect(workflowContent).toContain('pnpm audit')
    })
  })
})
