import fs from 'fs'
import { safeJoin, ALLOWED_DIRECTORIES } from '../../utils/path-security'

const AUDIT_LOG_PATH = safeJoin(ALLOWED_DIRECTORIES.LOGS, 'audit.log')

export function logAudit(action: string, details: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    details,
  }
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n')
}

