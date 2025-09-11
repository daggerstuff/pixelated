import fs from 'fs'
import path from 'path'
import { logAudit } from './auditLogger'

describe('auditLogger', () => {
  const logPath = path.resolve(process.cwd(), 'logs', 'audit.log')

  beforeEach(() => {
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath)
    }
  })

  it('writes audit log entry', () => {
    logAudit('test-action', { foo: 'bar' })
    const content = fs.readFileSync(logPath, 'utf-8')
    expect(content).toMatch(/test-action/)
    expect(content).toMatch(/foo/)
  })
})
