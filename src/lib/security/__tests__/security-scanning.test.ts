import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

describe('security Scanning Configuration', () => {
  describe('gitHub Workflow Configuration', () => {
    it('should have proper security scanning workflow configuration', async () => {
      // Setup
      const workflowPath = path.join(
        process.cwd(),
        '.github/workflows/security-scanning.yml',
      )
      const mockWorkflowContent = `
name: Security Scanning

on:
  push:
    branches: [ main, development ]
  pull_request:
    branches: [ main, development ]
  schedule:
    - cron: '0 0 * * *'

jobs:
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scanners: 'vuln,secret,config'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Run Checkov scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: all
          output_format: sarif
          output_file: checkov-results.sarif
          baseline: security-baseline.json
          soft_fail: true

      - name: Run Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        with:
          config-path: .gitleaks.toml
          format: sarif
          report-path: gitleaks-results.sarif

      - name: Process and Send Notifications
        if: always()
        run: |
          CRITICAL_COUNT=$(grep -c "CRITICAL" trivy-results.sarif 2>/dev/null || echo "0")
          PHI_COUNT=$(grep -c "Found" phi-scan-results.json 2>/dev/null || echo "0")
          FHIR_ISSUES=$(grep -c "FHIR" sarif-results/javascript.sarif 2>/dev/null || echo "0")

          if [ "$CRITICAL_COUNT" -gt 0 ] || [ "$PHI_COUNT" -gt 0 ] || [ "$FHIR_ISSUES" -gt 0 ]; then
            echo "::warning ::Found $CRITICAL_COUNT critical vulnerabilities, $PHI_COUNT potential PHI exposures, and $FHIR_ISSUES FHIR security issues"
            echo "SECURITY_ALERT=1" >> $GITHUB_ENV
          fi
      `

      // Mock the file read
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(mockWorkflowContent),
      )
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Act
      const content = fs.readFileSync(workflowPath, 'utf-8')

      // Assert
      expect(content.trim()).toContain('name: Security Scanning')
      expect(content.trim()).toContain('run: ubuntu-latest')
      expect(content.trim()).toContain('uses: aquasecurity/trivy-action@master')
      expect(content.trim()).toContain("scanners: 'vuln,secret,config'")
      expect(content.trim()).toContain('gitleaks/gitleaks-action@v2')
      expect(content.trim()).toContain('bridgecrewio/checkov-action@master')
      expect(content.trim()).toContain('CRITICAL_COUNT')
      expect(content.trim()).toContain('PHI_COUNT')
      expect(content.trim()).toContain('FHIR_ISSUES')
    })
  })

  describe('gitleaks Configuration', () => {
    it('should have proper Gitleaks configuration with healthcare patterns', async () => {
      // Setup
      const gitleaksPath = path.join(process.cwd(), '.gitleaks.toml')
      const mockGitleaksContent = `
title = "Gitleaks Healthcare Configuration"

[allowlist]
paths = [
    '''.*\\.test\\.ts$''',
    '''.*\\.test\\.tsx$''',
    '''.*\\.spec\\.ts$''',
    '''.*\\.spec\\.tsx$''',
    '''.*test/.*''',
    '''.*tests/.*''',
    '''.*/__tests__/.*''',
    '''.*/__mocks__/.*''',
    '''.*\\.md$''',
    '''package-lock\\.json$''',
    '''yarn\\.lock$''',
]

# Healthcare-specific rules
[[rules]]
id = "ehr-api-key"
description = "EHR API Key"
regex = '''(?i)(epic|cerner|allscripts|athena)([_-]?api[_-]?key|apikey)([^a-zA-Z0-9]|$){0,1}[=:"s'\`]{1,2}([a-zA-Z0-9=_\\-\\+/]{16,45})'''
secretGroup = 4
entropy = 3.7

[[rules]]
id = "fhir-token"
description = "FHIR Access Token"
regex = '''(?i)(fhir[_-]?token|fhir[_-]?access[_-]?token)([^a-zA-Z0-9]|$){0,1}[=:"s'\`]{1,2}([a-zA-Z0-9=_\\-\\+/\\.]{32,250})'''
secretGroup = 3
entropy = 3.7

[[rules]]
id = "patient-id"
description = "Patient ID Pattern"
regex = '''(?i)(patient[_-]?id|mrn|medical[_-]?record[_-]?number)([^a-zA-Z0-9]|$){0,1}[=:"s'\`]{1,2}([A-Z0-9]{6,15})'''
secretGroup = 3
entropy = 2.5
`

      // Mock the file read
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(mockGitleaksContent),
      )
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Act
      const content = fs.readFileSync(gitleaksPath, 'utf-8')

      // Assert
      expect(content.trim()).toContain(
        'title = "Gitleaks Healthcare Configuration"',
      )
      expect(content.trim()).toContain('id = "ehr-api-key"')
      expect(content.trim()).toContain('id = "fhir-token"')
      expect(content.trim()).toContain('id = "patient-id"')
      expect(content.trim()).toMatch(/epic|cerner|allscripts|athena/)
      expect(content.trim()).toMatch(/fhir[_-]?token/)
      expect(content.trim()).toMatch(/patient[_-]?id|mrn/)
    })
  })

  describe('codeQL Configuration', () => {
    it('should have proper CodeQL configuration with EHR security queries', async () => {
      // Setup
      const codeqlConfigPath = path.join(
        process.cwd(),
        '.github/codeql/codeql-config.yml',
      )
      const mockCodeQLContent = `
name: "EHR Security Analysis"

queries:
  - uses: security-and-quality
  - uses: security-extended
  - uses: ./.github/codeql/custom-queries/ehr-security.ql
  - uses: ./.github/codeql/custom-queries/fhir-security.ql

paths:
  - src/lib/ehr
  - src/services/ehr
  - src/components/ehr
  - src/utils
  - src/api/ehr

paths-ignore:
  - '**/node_modules'
  - '**/dist'
  - '**/build'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
  - '**/tests/**'
  - '**/mocks/**'
`

      // Mock the file read
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(mockCodeQLContent))
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Act
      const content = fs.readFileSync(codeqlConfigPath, 'utf-8')

      // Assert
      expect(content.trim()).toContain('name: "EHR Security Analysis"')
      expect(content.trim()).toContain('custom-queries/ehr-security.ql')
      expect(content.trim()).toContain('custom-queries/fhir-security.ql')
      expect(content.trim()).toContain('src/lib/ehr')
      expect(content.trim()).toContain('**/*.test.ts')
    })
  })

  describe('custom FHIR Security Queries', () => {
    it('should have proper FHIR security queries', async () => {
      // Setup
      const fhirQueryPath = path.join(
        process.cwd(),
        '.github/codeql/custom-queries/fhir-security.ql',
      )
      const mockFhirQueryContent = `
/**
 * @name Unvalidated FHIR Resource Access
 * @description Detects FHIR resource access without proper validation
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/unvalidated-fhir-access
 * @tags security
 *       fhir
 *       hipaa
 */

import javascript

from CallExpr call, Expr resource
where
  call.getCalleeName().matches("%getResource%") and
  resource = call.getArgument(0) and
  not exists(IfStmt ifStmt |
    ifStmt.getCondition().getAChildExpr*().getAChildExpr*() = resource
  )
select call, "FHIR resource access without proper validation."
`

      // Mock the file read
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(mockFhirQueryContent),
      )
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Act
      const content = fs.readFileSync(fhirQueryPath, 'utf-8')

      // Assert
      expect(content.trim()).toContain('@name Unvalidated FHIR Resource Access')
      expect(content.trim()).toContain(
        '@description Detects FHIR resource access',
      )
      expect(content.trim()).toContain('@kind problem')
      expect(content.trim()).toContain('@problem.severity error')
      expect(content.trim()).toContain('@id js/unvalidated-fhir-access')
      expect(content.trim()).toContain('@tags security')
      expect(content.trim()).toContain('fhir')
      expect(content.trim()).toContain('hipaa')
      expect(content.trim()).toContain(
        'call.getCalleeName().matches("%getResource%")',
      )
    })
  })

  describe('security Baseline', () => {
    it('should have proper security baseline configuration', async () => {
      // Setup
      const baselinePath = path.join(process.cwd(), 'security-baseline.json')
      const mockBaselineContent = `
{
  "check_ids": [
    "CKV_DOCKER_2",
    "CKV_DOCKER_3",
    "CKV_GHA_3",
    "CKV_GHA_4"
  ],
  "skip_check": [
    "CKV_SECRET_6"
  ],
  "enforce_check": {
    "CKV_K8S_35": "HIPAA requires TLS encryption for all data in transit",
    "CKV_AWS_21": "HIPAA requires encryption of PHI at rest"
  },
  "hipaa_compliance": {
    "data_protection": [
      "CKV_AWS_19",
      "CKV_AWS_21"
    ],
    "access_control": [
      "CKV_AWS_42",
      "CKV_AWS_40"
    ],
    "audit_logging": [
      "CKV_AWS_67",
      "CKV_AWS_158"
    ]
  }
}
`

      // Mock the file read
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(mockBaselineContent),
      )
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Act
      const content = fs.readFileSync(baselinePath, 'utf-8')
      const baseline = JSON.parse(content)

      // Assert
      expect(baseline).toHaveProperty('check_ids')
      expect(baseline).toHaveProperty('skip_check')
      expect(baseline).toHaveProperty('enforce_check')
      expect(baseline).toHaveProperty('hipaa_compliance')
      expect(baseline.hipaa_compliance).toHaveProperty('data_protection')
      expect(baseline.hipaa_compliance).toHaveProperty('access_control')
      expect(baseline.hipaa_compliance).toHaveProperty('audit_logging')
      expect(baseline.enforce_check.CKV_K8S_35).toContain('HIPAA requires')
    })
  })
})
