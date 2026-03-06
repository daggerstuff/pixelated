import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'

import { InMemoryTurnLedger } from '../store'
import { PersistentTurnLedger } from '../persistent-store'

describe('PersistentTurnLedger', () => {
  const artifactId = 'artifact://demo.md'

  const validTurn = {
    turnId: '',
    artifactId,
    phase: 'Observe' as const,
    role: 'scribe' as const,
    agentId: 'agent-scribe-1',
    confidence: 0.92,
    assumptions: ['Context source is stable.'],
    openQuestions: ['How should this be prioritized with existing evidence?'],
    decision: 'Record baseline observations and route to collaboration handoff.',
    evidence: ['http://docs.internal/observations'],
    requestedAction: 'ask-human' as const,
  }

  const makeTempPath = () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'agent-note-collab-'))
    return join(tempDir, 'turns.json')
  }

  const readLedgerFile = (filePath: string) => {
    const raw = readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  }

  const cleanupTempPath = (filePath: string) => {
    rmSync(dirname(filePath), { force: true, recursive: true })
  }

  it('persists turns and restores state across instances', async () => {
    const filePath = makeTempPath()
    try {
      const ledger = new PersistentTurnLedger({ filePath })

      const submitResult = await ledger.submitTurn(validTurn)
      expect(submitResult.ok).toBe(true)
      expect(readLedgerFile(filePath)).toMatchObject({
        version: 1,
        turns: [expect.objectContaining({ artifactId })],
      })

      const rehydrated = new PersistentTurnLedger({ filePath })
      const restoredTurns = await rehydrated.replayByArtifact(artifactId)
      expect(restoredTurns).toHaveLength(1)
      expect(restoredTurns[0]).toMatchObject({
        artifactId,
        role: 'scribe',
        requestedAction: 'ask-human',
      })
      expect(await rehydrated.openQuestionCount(artifactId)).toBe(
        validTurn.openQuestions.length,
      )
    } finally {
      cleanupTempPath(filePath)
    }
  })

  it('continues with valid turns when persisted data is corrupted', async () => {
    const filePath = makeTempPath()
    try {
      writeFileSync(filePath, '{ this is not json }', 'utf8')

      const ledger = new PersistentTurnLedger({ filePath })
      expect(await ledger.replayByArtifact(artifactId)).toHaveLength(0)

      const submitResult = await ledger.submitTurn({
        ...validTurn,
        phase: 'Counter',
        requestedAction: 'defer',
        confidence: 0.91,
      })
      expect(submitResult.ok).toBe(true)
      expect(await ledger.replayByArtifact(artifactId)).toHaveLength(1)
    } finally {
      cleanupTempPath(filePath)
    }
  })

  it('supports in-memory fallback usage when needed', () => {
    const inMemory = new InMemoryTurnLedger()
    const submitResult = inMemory.submitTurn({
      ...validTurn,
      phase: 'Counter',
      requestedAction: 'defer',
      confidence: 0.96,
    })

    expect(submitResult.ok).toBe(true)
    expect(inMemory.nextTurnIdForArtifact(artifactId)).toBe(`${artifactId}#turn-00002`)
    expect(inMemory.openQuestionCount(artifactId)).toBe(validTurn.openQuestions.length)
    expect(inMemory.getById(submitResult.turn.turnId)).toMatchObject({
      artifactId,
      phase: 'Counter',
    })
  })
})
