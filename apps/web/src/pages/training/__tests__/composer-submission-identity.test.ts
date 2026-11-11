/**
 * Submission identity minted by the trainee composer.
 *
 * `POST /api/training/sessions/{id}/messages` derives the row's primary key from
 * the payload, which is the only stable input available when the client sends
 * nothing else. That makes a deliberate second send of identical text resolve to
 * the first submission: the route answers `201` with the first row's id and
 * writes nothing, so the bubble the trainee saw disappears on reload.
 *
 * The composer therefore mints one submission identity per send action and sends
 * it in `X-Message-Submission-Id`. A retry of that action reuses the identity
 * (one row); a second deliberate send mints a new one (a second row).
 *
 * The composer is a classic browser script served from `apps/web/public/js/`, so
 * it has no module exports. These cases evaluate the shipped source and drive
 * its real `sendMessage()` path rather than a copy of the logic.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInThisContext } from 'node:vm'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const COMPOSER_PATH = path.resolve(
  process.cwd(),
  'apps/web/public/js/training-session.js',
)

const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const SUBMISSION_HEADER = 'X-Message-Submission-Id'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SentRequest = {
  url: string
  init: { method: string; headers: Record<string, string>; body: string }
}

type Composer = {
  sessionData: { sessionId: string } | null
  sendMessage: () => Promise<void>
  cleanup: () => void
}

const loadComposerClass = (): new () => Composer => {
  const source = readFileSync(COMPOSER_PATH, 'utf8')
  // The class is declared at the top level of the script, so returning it from
  // the evaluated body hands the test the same implementation the page loads.
  // The IIFE keeps that declaration out of the global lexical scope, so loading
  // it once per case does not collide with the previous load.
  return runInThisContext(
    `(function () {\n${source}\nreturn TrainingSession\n})()`,
  ) as new () => Composer
}

const mountComposerDom = (): void => {
  document.body.innerHTML = `
    <div id="messages-container"></div>
    <textarea id="message-input"></textarea>
    <button id="send-message"></button>
    <span id="character-count"></span>
    <span id="response-quality"></span>
    <div id="feedback-messages"></div>
  `
}

const typeMessage = (value: string): void => {
  const input = document.getElementById('message-input') as HTMLTextAreaElement
  input.value = value
}

const submissionIdOf = (call: SentRequest | undefined): string => {
  const headers = call?.init.headers ?? {}
  const value =
    headers[SUBMISSION_HEADER] ??
    Object.entries(headers).find(
      ([name]) => name.toLowerCase() === SUBMISSION_HEADER.toLowerCase(),
    )?.[1]
  return value ?? ''
}

const successResponse = (content: string) => ({
  ok: true,
  status: 201,
  json: async () => ({
    id: 'a944fd64-1c3b-4f5d-8e7a-9b0c1d2e3f40',
    content,
    createdAt: new Date().toISOString(),
  }),
})

const failureResponse = () => ({
  ok: false,
  status: 503,
  json: async () => ({ error: 'Training message temporarily unavailable' }),
})

describe('trainee composer submission identity', () => {
  let Composer: new () => Composer
  let composer: Composer
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mountComposerDom()
    Composer = loadComposerClass()
    composer = new Composer()
    composer.sessionData = { sessionId: SESSION_ID }
    fetchMock = vi.fn(async (_url: string, init: SentRequest['init']) => {
      const body = JSON.parse(init.body) as { content: string }
      return successResponse(body.content)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    composer?.cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('sends one submission identity with the send action', async () => {
    typeMessage('Practice response')

    await composer.sendMessage()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      SentRequest['init'],
    ]
    expect(call[0]).toBe(`/api/training/sessions/${SESSION_ID}/messages`)
    expect(submissionIdOf({ url: call[0], init: call[1] })).toMatch(
      UUID_PATTERN,
    )
  })

  it('reuses the identity when the failed send is retried', async () => {
    fetchMock.mockResolvedValueOnce(failureResponse())
    typeMessage('Practice response')

    await composer.sendMessage()
    // The route refused to persist, so the composer keeps the text for a retry.
    await composer.sendMessage()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = fetchMock.mock.calls.map((call) =>
      submissionIdOf({
        url: call[0] as string,
        init: call[1] as SentRequest['init'],
      }),
    )
    expect(first).toMatch(UUID_PATTERN)
    expect(second).toBe(first)
  })

  it('mints a new identity for a second deliberate send of identical content', async () => {
    typeMessage('Practice response')
    await composer.sendMessage()

    // The successful send cleared the input; the trainee types the same text
    // again on purpose and sends it as its own action.
    typeMessage('Practice response')
    await composer.sendMessage()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = fetchMock.mock.calls.map((call) =>
      submissionIdOf({
        url: call[0] as string,
        init: call[1] as SentRequest['init'],
      }),
    )
    expect(first).toMatch(UUID_PATTERN)
    expect(second).toMatch(UUID_PATTERN)
    expect(second).not.toBe(first)
  })

  it('mints a new identity when the text is edited after a failed send', async () => {
    fetchMock.mockResolvedValueOnce(failureResponse())
    typeMessage('Practice response')
    await composer.sendMessage()

    typeMessage('A different reflection')
    await composer.sendMessage()

    const [first, second] = fetchMock.mock.calls.map((call) =>
      submissionIdOf({
        url: call[0] as string,
        init: call[1] as SentRequest['init'],
      }),
    )
    expect(second).not.toBe(first)
  })
})
