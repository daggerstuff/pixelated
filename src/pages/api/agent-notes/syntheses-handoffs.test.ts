import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'

const makeTempPath = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'agent-note-collab-syn-'))
  return join(tempDir, 'turns.json')
}

const cleanupTempPath = (filePath: string) => {
  rmSync(dirname(filePath), { force: true, recursive: true })
}

const buildJsonRequest = (payload: unknown) => ({
  json: vi.fn().mockResolvedValue(payload),
})

const asActor = (actorId: string) => ({
  user: {
    id: actorId,
    role: 'therapist',
  },
})

describe('Agent note syntheses and handoffs APIs', () => {
  it('creates synthesis summary from replayed turns', async () => {
    const tempPath = makeTempPath()
    try {
      process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = tempPath
      vi.resetModules()
      const { POST: submitTurn } = await import('./turns')
      const { POST } = await import('./syntheses')

      await submitTurn({
        request: buildJsonRequest({
          turnId: '',
          artifactId: 'artifact://synth',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.9,
          assumptions: ['Assumptions validated'],
          openQuestions: ['Question 1'],
          decision: 'Capture initial note.',
          evidence: ['e1'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      await submitTurn({
        request: buildJsonRequest({
          turnId: '',
          artifactId: 'artifact://synth',
          phase: 'Propose',
          role: 'critic',
          agentId: 'agent-beta',
          confidence: 0.92,
          assumptions: ['Need one more source'],
          openQuestions: ['Question 2'],
          decision: 'Refine risk language.',
          evidence: ['e2'],
          requestedAction: 'defer',
        }),
        locals: asActor('agent-beta'),
      } as any)

      const response = await POST({
        request: buildJsonRequest({
          artifactId: 'artifact://synth',
          maxTurns: 10,
          includeResolvedOpenQuestions: false,
        }),
        locals: asActor('agent-alpha'),
      } as any)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.turnCount).toBe(2)
      expect(body.data.synthesis?.turnCount).toBe(2)
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('returns not-found for unknown artifact synthesis', async () => {
    const tempPath = makeTempPath()
    try {
      process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = tempPath
      vi.resetModules()
      const { POST } = await import('./syntheses')

      const response = await POST({
        request: buildJsonRequest({
          artifactId: 'artifact://missing',
          maxTurns: 5,
          includeResolvedOpenQuestions: false,
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const body = await response.json()
      expect(response.status).toBe(404)
      expect(body.code).toBe('NOT_FOUND')
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('builds handoff payload validation and source mapping', async () => {
    const tempPath = makeTempPath()
    try {
      process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = tempPath
      vi.resetModules()
      const { POST: submitTurn } = await import('./turns')
      const handoffModule = await import('./handoffs')
      const submitResponse = await submitTurn({
        request: buildJsonRequest({
          turnId: '',
          artifactId: 'artifact://handoff',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.9,
          assumptions: ['Sufficient context'],
          openQuestions: ['Need follow-up'],
          decision: 'Escalation request to human.',
          evidence: ['e1'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const sourceTurn = await submitResponse.json()
      const sourceTurnId = sourceTurn.data.turn.turnId

      const response = await handoffModule.POST({
        request: buildJsonRequest({
          artifactId: 'artifact://handoff',
          sourceTurnId,
          target: 'agent-human-reviewer',
          mode: 'human',
          urgency: 'high',
          summary: 'Needs adjudication before final handoff.',
          blockers: ['Policy gate check'],
          requiredContext: ['Recent risk notes'],
          constraints: ['No patient data persistence'],
          nextPhase: 'Handoff',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const body = await response.json()
      expect(response.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.data.nextAction).toBe('escalate')
      expect(body.data.artifactId).toBe('artifact://handoff')
      expect(body.data.sourceTurnId).toBe(sourceTurnId)
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('forbids handoff creation by actors outside artifact scope', async () => {
    const tempPath = makeTempPath()
    try {
      process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = tempPath
      vi.resetModules()
      const { POST: submitTurn } = await import('./turns')
      const handoffModule = await import('./handoffs')
      const submitResponse = await submitTurn({
        request: buildJsonRequest({
          turnId: '',
          artifactId: 'artifact://handoff-guard',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.9,
          assumptions: ['Sufficient context'],
          openQuestions: ['Need follow-up'],
          decision: 'Escalation request to human.',
          evidence: ['e1'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const sourceTurn = await submitResponse.json()
      const sourceTurnId = sourceTurn.data.turn.turnId

      const response = await handoffModule.POST({
        request: buildJsonRequest({
          artifactId: 'artifact://handoff-guard',
          sourceTurnId,
          target: 'agent-human-reviewer',
          mode: 'human',
          urgency: 'high',
          summary: 'Needs adjudication before final handoff.',
          blockers: ['Policy gate check'],
          requiredContext: ['Recent risk notes'],
          constraints: ['No patient data persistence'],
          nextPhase: 'Handoff',
        }),
        locals: asActor('agent-hacker'),
      } as any)

      const body = await response.json()
      expect(response.status).toBe(403)
      expect(body.code).toBe('FORBIDDEN')
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('allows synthesis only for artifact participants', async () => {
    const tempPath = makeTempPath()
    try {
      process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = tempPath
      vi.resetModules()
      const { POST: submitTurn } = await import('./turns')
      const syntheses = await import('./syntheses')

      await submitTurn({
        request: buildJsonRequest({
          turnId: '',
          artifactId: 'artifact://synth-guard',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.95,
          assumptions: ['Sufficient evidence'],
          openQuestions: ['Should we escalate?'],
          decision: 'First pass ready.',
          evidence: ['source'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const blockedResponse = await syntheses.POST({
        request: buildJsonRequest({
          artifactId: 'artifact://synth-guard',
          maxTurns: 5,
          includeResolvedOpenQuestions: false,
        }),
        locals: asActor('agent-hacker'),
      } as any)

      const blockedBody = await blockedResponse.json()
      expect(blockedResponse.status).toBe(403)
      expect(blockedBody.code).toBe('FORBIDDEN')
    } finally {
      cleanupTempPath(tempPath)
    }
  })
})
