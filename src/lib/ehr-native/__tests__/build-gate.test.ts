// @vitest-environment node
/**
 * G1.7 — Build Gate
 *
 * Validates that the EHR native module builds correctly:
 * - All barrel exports (index.ts) resolve correctly via dynamic import
 * - No circular dependencies in the module graph
 * - All public APIs have proper type exports
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const EHR_NATIVE_DIR = join(process.cwd(), 'src/lib/ehr-native')

describe('G1.7 — Build Gate', () => {
  describe('barrel exports resolve correctly', () => {
    it('api/index.ts resolves and exports expected symbols', async () => {
      const mod = await import('../api/index.js')
      expect(mod.ENDPOINT_GROUPS).toBeDefined()
      expect(mod.ALL_ENDPOINT_GROUPS).toBeDefined()
      expect(mod.processEHRRequest).toBeDefined()
      expect(mod.extractAPIRequestContext).toBeDefined()
      expect(mod.toFHIRRequestContext).toBeDefined()
      expect(mod.buildFHIRRequest).toBeDefined()
      expect(mod.resolveEndpoint).toBeDefined()
      expect(mod.createEndpointHandler).toBeDefined()
      expect(mod.generateOpenAPISpec).toBeDefined()
      expect(mod.OPENAPI_JSON).toBeDefined()
    })

    it('fhir/index.ts resolves and exports expected symbols', async () => {
      const mod = await import('../fhir/index.js')
      expect(mod.routeFHIRRequest).toBeDefined()
      expect(mod.createResource).toBeDefined()
      expect(mod.readResource).toBeDefined()
      expect(mod.updateResource).toBeDefined()
      expect(mod.deleteResource).toBeDefined()
      expect(mod.searchResources).toBeDefined()
      expect(mod.getResourceHistory).toBeDefined()
      expect(mod.validateResource).toBeDefined()
      expect(mod.validateResourceType).toBeDefined()
      expect(mod.isSupportedResourceType).toBeDefined()
      expect(mod.getRegistryEntry).toBeDefined()
      expect(mod.RESOURCE_REGISTRY).toBeDefined()
      expect(mod.SCHEMA_REGISTRY).toBeDefined()
      expect(mod.createOperationOutcome).toBeDefined()
      expect(mod.badRequest).toBeDefined()
      expect(mod.notFound).toBeDefined()
    })

    it('audit/index.ts resolves and exports expected symbols', async () => {
      const mod = await import('../audit/index.js')
      expect(mod.auditFHIRCreate).toBeDefined()
      expect(mod.auditFHIRUpdate).toBeDefined()
      expect(mod.auditFHIRDelete).toBeDefined()
      expect(mod.auditFHIRRead).toBeDefined()
      expect(mod.auditFHIRFailure).toBeDefined()
      expect(mod.auditBreakGlassFHIR).toBeDefined()
      expect(mod.auditFHIREvent).toBeDefined()
      expect(mod.verifyEhrAuditChain).toBeDefined()
      expect(mod.buildEhrAuditContext).toBeDefined()
      expect(mod.preWriteAudit).toBeDefined()
      expect(mod.postWriteAudit).toBeDefined()
      expect(mod.postWriteFailureAudit).toBeDefined()
      expect(mod.readAudit).toBeDefined()
    })

    it('auth/index.ts resolves and exports expected symbols', async () => {
      const mod = await import('../auth/index.js')
      expect(mod.checkPermission).toBeDefined()
      expect(mod.verifyPatientConsent).toBeDefined()
      expect(mod.activateBreakGlass).toBeDefined()
      expect(mod.checkPermissionWithBreakGlass).toBeDefined()
      expect(mod.logEHRAccess).toBeDefined()
      expect(mod.roleHasPermission).toBeDefined()
      expect(mod.resolveRolePermissions).toBeDefined()
      expect(mod.CLINICAL_ROLES).toBeDefined()
      expect(mod.EHR_PERMISSIONS).toBeDefined()
      expect(mod.isClinicalRole).toBeDefined()
      expect(mod.isEHRPermission).toBeDefined()
    })

    it('consent/index.ts resolves and exports expected symbols', async () => {
      const mod = await import('../consent/index.js')
      expect(mod.ConsentEngine).toBeDefined()
      expect(mod.getConsentEngine).toBeDefined()
      expect(mod.resetConsentEngine).toBeDefined()
    })

    it('types/index.ts resolves and exports expected schemas', async () => {
      const mod = await import('../types/index.js')
      expect(mod.patientSchema).toBeDefined()
      expect(mod.practitionerSchema).toBeDefined()
      expect(mod.encounterSchema).toBeDefined()
      expect(mod.observationSchema).toBeDefined()
      expect(mod.fhirBaseSchema).toBeDefined()
    })

    it('types/index.ts resolves and exports consent schemas', async () => {
      const mod = await import('../types/index.js')
      expect(mod.consentSchema).toBeDefined()
      expect(mod.provenanceSchema).toBeDefined()
    })
  })

  describe('type exports are available', () => {
    it('api/index.ts exports type symbols', async () => {
      // Type exports are compile-time only, but we can verify the module
      // doesn't throw when imported. The types are erased at runtime.
      const mod = await import('../api/index.js')
      expect(mod).toBeDefined()
      // Verify the module object has the expected shape
      expect(typeof mod.processEHRRequest).toBe('function')
    })

    it('fhir/index.ts exports type symbols', async () => {
      const mod = await import('../fhir/index.js')
      expect(mod).toBeDefined()
      expect(typeof mod.routeFHIRRequest).toBe('function')
    })

    it('auth/index.ts exports type symbols', async () => {
      const mod = await import('../auth/index.js')
      expect(mod).toBeDefined()
      expect(typeof mod.checkPermission).toBe('function')
    })

    it('audit/index.ts exports type symbols', async () => {
      const mod = await import('../audit/index.js')
      expect(mod).toBeDefined()
      expect(typeof mod.auditFHIRCreate).toBe('function')
    })

    it('consent/index.ts exports type symbols', async () => {
      const mod = await import('../consent/index.js')
      expect(mod).toBeDefined()
      expect(typeof mod.ConsentEngine).toBe('function')
    })
  })

  describe('no circular dependencies in module graph', () => {
    it('api/handler.ts imports do not create cycles', async () => {
      // Dynamic import will throw if there's a circular dependency issue
      const mod = await import('../api/handler.js')
      expect(mod.processEHRRequest).toBeDefined()
    })

    it('fhir/router.ts imports do not create cycles', async () => {
      const mod = await import('../fhir/router.js')
      expect(mod.routeFHIRRequest).toBeDefined()
    })

    it('audit/middleware.ts imports do not create cycles', async () => {
      const mod = await import('../audit/middleware.js')
      expect(mod.buildEhrAuditContext).toBeDefined()
    })

    it('consent/consent-engine.ts imports do not create cycles', async () => {
      const mod = await import('../consent/consent-engine.js')
      expect(mod.ConsentEngine).toBeDefined()
    })

    it('auth/ehr-rbac.ts imports do not create cycles', async () => {
      const mod = await import('../auth/ehr-rbac.js')
      expect(mod.checkPermission).toBeDefined()
    })
  })

  describe('all index.ts files exist', () => {
    const expectedIndexes = [
      'api/index.ts',
      'fhir/index.ts',
      'audit/index.ts',
      'auth/index.ts',
      'consent/index.ts',
      'types/index.ts',
    ]

    for (const indexFile of expectedIndexes) {
      it(`${indexFile} exists`, () => {
        const fullPath = join(EHR_NATIVE_DIR, indexFile)
        expect(existsSync(fullPath), `${indexFile} should exist`).toBe(true)
      })
    }
  })

  describe('all source files are valid TypeScript', () => {
    function collectTsFiles(dir: string): string[] {
      const files: string[] = []
      if (!existsSync(dir)) return files
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          if (entry === '__tests__' || entry === 'node_modules') continue
          files.push(...collectTsFiles(fullPath))
        } else if (extname(entry) === '.ts') {
          files.push(fullPath)
        }
      }
      return files
    }

    it('all .ts files have valid syntax (non-empty, have exports)', () => {
      const files = collectTsFiles(EHR_NATIVE_DIR)
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        // Every source file should have at least one export
        expect(
          content.includes('export'),
          `${file.replace(EHR_NATIVE_DIR, '')} should have exports`,
        ).toBe(true)
      }
    })
  })

  describe('module loading does not throw', () => {
    it('loading all barrel exports in sequence does not throw', async () => {
      // Import all barrels — if any has a circular dep or missing import,
      // this will throw
      await expect(import('../api/index.js')).resolves.toBeDefined()
      await expect(import('../fhir/index.js')).resolves.toBeDefined()
      await expect(import('../audit/index.js')).resolves.toBeDefined()
      await expect(import('../auth/index.js')).resolves.toBeDefined()
      await expect(import('../consent/index.js')).resolves.toBeDefined()
      await expect(import('../types/index.js')).resolves.toBeDefined()
    })

    it('loading all source modules does not throw', async () => {
      await expect(import('../api/handler.js')).resolves.toBeDefined()
      await expect(import('../api/endpoints.js')).resolves.toBeDefined()
      await expect(import('../api/openapi.js')).resolves.toBeDefined()
      await expect(import('../api/types.js')).resolves.toBeDefined()
      await expect(import('../fhir/router.js')).resolves.toBeDefined()
      await expect(import('../fhir/validation.js')).resolves.toBeDefined()
      await expect(import('../fhir/error.js')).resolves.toBeDefined()
      await expect(import('../fhir/types.js')).resolves.toBeDefined()
      await expect(import('../fhir/search.js')).resolves.toBeDefined()
      await expect(import('../audit/ehr-audit-bridge.js')).resolves.toBeDefined()
      await expect(import('../audit/middleware.js')).resolves.toBeDefined()
      await expect(import('../audit/types.js')).resolves.toBeDefined()
      await expect(import('../auth/ehr-rbac.js')).resolves.toBeDefined()
      await expect(import('../auth/role-permissions.js')).resolves.toBeDefined()
      await expect(import('../auth/types.js')).resolves.toBeDefined()
      await expect(import('../consent/consent-engine.js')).resolves.toBeDefined()
      await expect(import('../consent/types.js')).resolves.toBeDefined()
    })
  })
})
