import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'

type RouteModule = typeof import('./turns')

const loadRoutes = async (filePath: string): Promise<RouteModule> => {
  process.env['AGENT_NOTE_COLLAB_LEDGER_PATH'] = filePath
  vi.resetModules()
  return (await import('./turns')) as RouteModule
}

const createJsonRequest = (payload: unknown) => ({
  json: vi.fn().mockResolvedValue(payload),
})

const asActor = (actorId: string) => ({
  user: {
    id: actorId,
    role: 'therapist',
  },
})

describe('Agent note turns API', () => {
  const makeTempPath = () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'agent-note-collab-api-'))
    return join(tempDir, 'turns.json')
  }

  const cleanupTempPath = (filePath: string) => {
    rmSync(dirname(filePath), { force: true, recursive: true })
  }

  it('accepts a valid turn and returns routing metadata', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST } = await loadRoutes(tempPath)

      const response = await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://demo-01',
          phase: 'Counter',
          role: 'critic',
          agentId: 'agent-critic',
          confidence: 0.88,
          assumptions: ['Source logs are complete'],
          openQuestions: ['What weighting should be applied?'],
          decision: 'Add confidence interval checks before next phase.',
          evidence: ['obs-log-2026-01-01'],
          requestedAction: 'defer',
        }),
        locals: asActor('agent-critic'),
      } as any)

      const responseBody = await response.json()
      expect(response.status).toBe(201)
      expect(responseBody.ok).toBe(true)
      expect(responseBody.data.action).toBe('accept')
      expect(responseBody.data.nextPhase).toBe('Synthesize')
      expect(responseBody.data.turn).toMatchObject({ artifactId: 'artifact://demo-01', role: 'critic' })
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('rejects invalid payloads with a 400 response', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST } = await loadRoutes(tempPath)

      const response = await POST({
        request: createJsonRequest({
          artifactId: '',
          phase: 'Counter',
          role: 'critic',
          agentId: '',
          confidence: 1.2,
          assumptions: [],
          openQuestions: [],
          decision: '',
          evidence: [],
          requestedAction: 'defer',
        }),
        locals: asActor('agent-critic'),
      } as any)

      const responseBody = await response.json()
      expect(response.status).toBe(400)
      expect(responseBody.ok).toBe(false)
      expect(responseBody.code).toBe('INVALID_PAYLOAD')
      expect(responseBody.message).toBe('Turn payload is invalid.')
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('rejects policy gating with 422 when governance denies submission', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST } = await loadRoutes(tempPath)

      const response = await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://low-confidence',
          phase: 'Synthesize',
          role: 'router',
          agentId: 'agent-router',
          confidence: 0.4,
          assumptions: ['Confidence estimate may be updated.'],
          openQuestions: ['What is the root cause?'],
          decision: 'Request rerun on additional evidence before handoff.',
          evidence: ['evidence-a', 'evidence-b'],
          requestedAction: 'handoff',
        }),
        locals: asActor('agent-router'),
      } as any)

      const responseBody = await response.json()
      expect(response.status).toBe(422)
      expect(responseBody.ok).toBe(false)
      expect(responseBody.code).toBe('SUBMISSION_REJECTED')
      expect(responseBody.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'RETRY',
          }),
        ]),
      )
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('rejects writes from actors without artifact membership', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST } = await loadRoutes(tempPath)

      await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://write-guard',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.92,
          assumptions: ['Alpha owns this artifact.'],
          openQuestions: ['Question?'],
          decision: 'Initial capture.',
          evidence: ['e1'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const response = await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://write-guard',
          phase: 'Propose',
          role: 'critic',
          agentId: 'agent-beta',
          confidence: 0.93,
          assumptions: ['Beta should not be able to write.'],
          openQuestions: ['Should we override?'],
          decision: 'Unauthorized edit attempt.',
          evidence: ['e2'],
          requestedAction: 'defer',
        }),
        locals: asActor('agent-hacker'),
      } as any)

      const responseBody = await response.json()
      expect(response.status).toBe(403)
      expect(responseBody.code).toBe('FORBIDDEN')
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('returns filtered turn history via GET', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST, GET } = await loadRoutes(tempPath)

      const createTurnPayload = {
        turnId: '',
        role: 'scribe',
        agentId: 'agent-alpha',
        confidence: 0.93,
        assumptions: ['Data normalized'],
        openQuestions: ['Should we defer until reviewer confirms?'],
        decision: 'Initial note created for artifact review.',
        evidence: ['obs-1'],
      }

      await POST({
        request: createJsonRequest({
          ...createTurnPayload,
          artifactId: 'artifact://filter-demo',
          phase: 'Observe',
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      await POST({
        request: createJsonRequest({
          ...createTurnPayload,
          artifactId: 'artifact://filter-demo',
          phase: 'Counter',
          requestedAction: 'defer',
          confidence: 0.96,
        }),
        locals: asActor('agent-alpha'),
      } as any)

      await POST({
        request: createJsonRequest({
          ...createTurnPayload,
          artifactId: 'artifact://other',
          phase: 'Observe',
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const response = await GET({
        url: 'http://localhost:4321/api/agent-notes/turns?artifactId=artifact://filter-demo&sort=asc',
        locals: asActor('agent-alpha'),
      } as any)
      const responseBody = await response.json()
      expect(response.status).toBe(200)
      expect(responseBody.ok).toBe(true)
      expect(responseBody.data.count).toBe(2)
      expect(responseBody.data.turns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artifactId: 'artifact://filter-demo' }),
          expect.objectContaining({ artifactId: 'artifact://filter-demo' }),
        ]),
      )
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('enforces actor membership checks on artifact-scoped GET', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST, GET } = await loadRoutes(tempPath)

      await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://restricted',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.92,
          assumptions: ['Assumptions validated'],
          openQuestions: ['Question from alpha'],
          decision: 'Alpha created first turn.',
          evidence: ['evidence-alpha'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      const deniedResponse = await GET({
        url: 'http://localhost:4321/api/agent-notes/turns?artifactId=artifact://restricted',
        locals: asActor('agent-hacker'),
      } as any)
      const deniedBody = await deniedResponse.json()
      expect(deniedResponse.status).toBe(403)
      expect(deniedBody.code).toBe('FORBIDDEN')

      const allowedResponse = await GET({
        url: 'http://localhost:4321/api/agent-notes/turns?artifactId=artifact://restricted',
        locals: asActor('agent-alpha'),
      } as any)
      const allowedBody = await allowedResponse.json()
      expect(allowedResponse.status).toBe(200)
      expect(allowedBody.ok).toBe(true)
      expect(allowedBody.data.count).toBe(1)
    } finally {
      cleanupTempPath(tempPath)
    }
  })

  it('returns actor-scoped turns when artifactId is omitted', async () => {
    const tempPath = makeTempPath()
    try {
      const { POST, GET } = await loadRoutes(tempPath)

      await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://alpha-1',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-alpha',
          confidence: 0.92,
          assumptions: ['Shared project context'],
          openQuestions: ['Open question alpha'],
          decision: 'Collect more notes.',
          evidence: ['e1'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://alpha-2',
          phase: 'Observe',
          role: 'critic',
          agentId: 'agent-alpha',
          confidence: 0.91,
          assumptions: ['Second artifact same actor'],
          openQuestions: ['Open question two'],
          decision: 'Collect related notes.',
          evidence: ['e2'],
          requestedAction: 'defer',
        }),
        locals: asActor('agent-alpha'),
      } as any)

      await POST({
        request: createJsonRequest({
          turnId: '',
          artifactId: 'artifact://beta-1',
          phase: 'Observe',
          role: 'scribe',
          agentId: 'agent-beta',
          confidence: 0.93,
          assumptions: ['Different actor artifact'],
          openQuestions: ['Open question beta'],
          decision: 'Different actor context.',
          evidence: ['e3'],
          requestedAction: 'ask-human',
        }),
        locals: asActor('agent-beta'),
      } as any)

      const response = await GET({
        url: 'http://localhost:4321/api/agent-notes/turns?sort=desc',
        locals: asActor('agent-alpha'),
      } as any)
      const responseBody = await response.json()

      expect(response.status).toBe(200)
      expect(responseBody.ok).toBe(true)
      expect(responseBody.data.count).toBe(2)
      expect(responseBody.data.turns.map((turn: { artifactId: string }) => turn.artifactId)).toEqual([
        'artifact://alpha-2',
        'artifact://alpha-1',
      ])
    } finally {
      cleanupTempPath(tempPath)
    }
  })
})
