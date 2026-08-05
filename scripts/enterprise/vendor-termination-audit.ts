/**
 * Vendor Termination Audit Log
 *
 * Records vendor termination events to an append-only JSONL audit log,
 * satisfying VRA-1.11 (PIX-4129) acceptance criteria.
 *
 * Usage:
 *   pnpm tsx scripts/enterprise/vendor-termination-audit.ts \
 *     --vendor "OpenAI" \
 *     --reason "Contract ended" \
 *     --initiated-by "compliance@pixelated.dev" \
 *     --data-deletion-confirmed \
 *     --deletion-certificate-url "https://..."
 *
 * The audit log is stored at `docs/reference/enterprise/audit/vendor-termination.jsonl`
 * and is append-only. Each entry includes:
 *  - Timestamp (ISO 8601)
 *  - Vendor name
 *  - Termination reason
 *  - Initiated by (email)
 *  - Data deletion confirmed (boolean)
 *  - Deletion certificate URL (optional)
 *  - PHI migration confirmed (boolean, for BAA vendors)
 *  - BAA terminated (boolean, for BAA vendors)
 *  - Compliance notified (boolean)
 *  - HHS notification required (boolean, for breach-risk cases)
 *  - Notes
 */

import { readFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AUDIT_LOG_PATH = join(__dirname, '..', '..', 'docs', 'reference', 'enterprise', 'audit', 'vendor-termination.jsonl')

interface VendorTerminationEntry {
  timestamp: string
  vendor: string
  reason: string
  initiated_by: string
  data_deletion_confirmed: boolean
  deletion_certificate_url?: string
  phi_migration_confirmed: boolean
  baa_terminated: boolean
  compliance_notified: boolean
  hhs_notification_required: boolean
  notes?: string
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {}
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_')
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        parsed[key] = next
        i++
      } else {
        parsed[key] = true
      }
    }
  }
  return parsed
}

function appendAuditEntry(entry: VendorTerminationEntry): void {
  const dir = dirname(AUDIT_LOG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const line = JSON.stringify(entry) + '\n'
  const fd = createWriteStream(AUDIT_LOG_PATH, { flags: existsSync(AUDIT_LOG_PATH) ? 'a' : 'w' })
  fd.write(line)
  fd.end()
}

function queryLog(filter?: string): VendorTerminationEntry[] {
  if (!existsSync(AUDIT_LOG_PATH)) {
    return []
  }
  const lines = readFileSync(AUDIT_LOG_PATH, 'utf-8').trim().split('\n').filter(Boolean)
  const entries = lines.map((line) => JSON.parse(line) as VendorTerminationEntry)
  if (filter) {
    return entries.filter((e) => e.vendor.toLowerCase().includes(filter.toLowerCase()))
  }
  return entries
}

const args = parseArgs(process.argv)

if (args.help) {
  console.log(`
Vendor Termination Audit Log

Usage:
  Record a termination:
    pnpm tsx scripts/enterprise/vendor-termination-audit.ts \\
      --vendor "OpenAI" \\
      --reason "Contract ended" \\
      --initiated-by "compliance@pixelated.dev" \\
      --data-deletion-confirmed \\
      --deletion-certificate-url "https://..." \\
      [--phi-migration-confirmed] \\
      [--baa-terminated] \\
      [--compliance-notified] \\
      [--hhs-notification-required] \\
      [--notes "Additional context"]

  Query the audit log:
    pnpm tsx scripts/enterprise/vendor-termination-audit.ts --query [--vendor "OpenAI"]
`)
  process.exit(0)
}

if (args.query) {
  const entries = queryLog(args.vendor as string)
  if (entries.length === 0) {
    console.log('No vendor termination records found.')
  } else {
    console.log(`Found ${entries.length} record(s):`)
    for (const entry of entries) {
      console.log(`\n[${entry.timestamp}] ${entry.vendor}`)
      console.log(`  Reason: ${entry.reason}`)
      console.log(`  Initiated by: ${entry.initiated_by}`)
      console.log(`  Data deletion confirmed: ${entry.data_deletion_confirmed}`)
      if (entry.deletion_certificate_url) {
        console.log(`  Deletion certificate: ${entry.deletion_certificate_url}`)
      }
      console.log(`  PHI migration confirmed: ${entry.phi_migration_confirmed}`)
      console.log(`  BAA terminated: ${entry.baa_terminated}`)
      console.log(`  Compliance notified: ${entry.compliance_notified}`)
      console.log(`  HHS notification required: ${entry.hhs_notification_required}`)
      if (entry.notes) {
        console.log(`  Notes: ${entry.notes}`)
      }
    }
  }
  process.exit(0)
}

// Record a new termination
if (!args.vendor || typeof args.vendor !== 'string') {
  console.error('Error: --vendor is required')
  process.exit(1)
}
if (!args.reason || typeof args.reason !== 'string') {
  console.error('Error: --reason is required')
  process.exit(1)
}
if (!args.initiated_by || typeof args.initiated_by !== 'string') {
  console.error('Error: --initiated-by is required')
  process.exit(1)
}

const entry: VendorTerminationEntry = {
  timestamp: new Date().toISOString(),
  vendor: args.vendor,
  reason: args.reason,
  initiated_by: args.initiated_by,
  data_deletion_confirmed: Boolean(args.data_deletion_confirmed),
  deletion_certificate_url: typeof args.deletion_certificate_url === 'string' ? args.deletion_certificate_url : undefined,
  phi_migration_confirmed: Boolean(args.phi_migration_confirmed),
  baa_terminated: Boolean(args.baa_terminated),
  compliance_notified: Boolean(args.compliance_notified),
  hhs_notification_required: Boolean(args.hhs_notification_required),
  notes: typeof args.notes === 'string' ? args.notes : undefined,
}

appendAuditEntry(entry)
console.log(`Vendor termination recorded: ${entry.vendor} at ${entry.timestamp}`)
console.log(`Audit log: ${AUDIT_LOG_PATH}`)
