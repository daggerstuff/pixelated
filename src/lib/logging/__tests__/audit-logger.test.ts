import fs from 'fs'
import { logAudit } from '../audit-logger'
import { safeJoin, ALLOWED_DIRECTORIES } from '../../../utils/path-security'

describe('auditLogger', () => {
    const logPath = safeJoin(ALLOWED_DIRECTORIES.LOGS, 'audit.log')

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

