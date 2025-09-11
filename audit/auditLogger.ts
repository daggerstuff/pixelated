import fs from 'fs'
import path from 'path'

const AUDIT_LOG_PATH = path.resolve(process.cwd(), 'logs', 'audit.log')

export function logAudit(action: string, details: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    details,
  }
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n')
}
