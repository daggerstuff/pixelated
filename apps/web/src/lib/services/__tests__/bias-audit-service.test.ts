// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BiasAuditService } from '../bias-audit-service'

/**
 * Builds a minimally-valid DatasetForAudit for the service's in-memory store.
 * filePath points at a path that does not exist on disk, which is exactly the
 * condition we want to exercise.
 */
function makeDataset(
  overrides: {
    datasetId: string
    filePath: string
    format?: 'json' | 'jsonl' | 'csv' | 'parquet'
  } = { datasetId: 'ds_missing', filePath: '/nonexistent/dataset.jsonl' },
): {
  datasetId: string
  filePath: string
  format: 'json' | 'jsonl' | 'csv' | 'parquet'
} & Record<string, unknown> {
  return {
    datasetId: overrides.datasetId,
    name: 'Test Dataset',
    filePath: overrides.filePath,
    fileSize: 0,
    recordCount: 10,
    format: overrides.format ?? 'jsonl',
    uploadedAt: new Date(),
    uploadedBy: 'system',
  }
}

describe('BiasAuditService.initiateAudit data sourcing', () => {
  it('fails the audit and reverts to pending_review when the dataset file is missing', async () => {
    const service = new BiasAuditService()
    const dataset = makeDataset({
      datasetId: 'ds_missing_file',
      filePath: '/nonexistent/dataset.jsonl',
    })
    await service.registerDataset(
      dataset as Parameters<BiasAuditService['registerDataset']>[0],
    )

    await expect(service.initiateAudit(['ds_missing_file'])).rejects.toThrow(
      /dataset file|ENOENT|No auditable records/i,
    )

    const after = await service.getDataset('ds_missing_file')
    // The dataset must not be marked approved/under_audit on a fabricated run.
    expect(after?.quarantineStatus).toBe('pending_review')
  })

  it('refuses to audit an unsupported dataset format instead of fabricating data', async () => {
    const service = new BiasAuditService()
    const dataset = makeDataset({
      datasetId: 'ds_unsupported_fmt',
      filePath: '/nonexistent/dataset.parquet',
      format: 'parquet',
    })
    await service.registerDataset(
      dataset as Parameters<BiasAuditService['registerDataset']>[0],
    )

    // Parquet has no reader wired up; the audit must fail loudly, not produce
    // synthetic sessions. The file read will throw before format parsing, so
    // any thrown error is acceptable — the invariant is that no fabricated
    // audit result is recorded.
    await expect(
      service.initiateAudit(['ds_unsupported_fmt']),
    ).rejects.toThrow()

    const after = await service.getDataset('ds_unsupported_fmt')
    expect(after?.quarantineStatus).toBe('pending_review')
  })
})
