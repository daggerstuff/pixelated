/**
 * The synthetic-client reply path and the transcript-grounded coaching surface
 * are structure, and the content is deliberately absent (VAL-SCAF-001,
 * VAL-SCAF-002).
 *
 * A plausible-looking client reply is the most damaging thing this phase could
 * ship: a trainee cannot tell it from a real one. So the assertion that matters
 * most here is not that the surface renders a blocker — it is that no reply text
 * can reach the transcript at all. `requestClientReply` has no branch that
 * returns one, and the tests below drive it and inspect every value it produces.
 *
 * The same holds for coaching: no score, no rating, no rubric line, and no
 * feedback sentence. The rubric, the competency framework, and the wording are
 * the clinical content owner's decisions.
 *
 * Astro pages have no component test runner in this repository (see
 * `trainee-error-surface.test.ts`), so the page half is a structural guard over
 * the page and component sources. The seams are pure functions and are
 * exercised directly; the composer half evaluates the shipped script and drives
 * its real `sendMessage()` path, as `composer-submission-identity.test.ts` does.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  COACHING_MODEL_BLOCKER,
  COACHING_TRANSCRIPT_BLOCKER,
  SYNTHETIC_CLIENT_REPLY_BLOCKER,
  buildCoachingReport,
  requestClientReply,
  summarizeTranscript,
} from '../_reply-and-coaching'

const readFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const moduleSource = readFile('../_reply-and-coaching.ts')
const replyStateComponent = readFile('../_ClientReplyState.astro')
const guidancePanel = readFile('../_SessionGuidancePanel.astro')
const sessionPage = readFile('../session/[sessionId].astro')
const coachingPage = readFile('../coaching/index.astro')
const indexPage = readFile('../index.astro')
const trainingScript = readFile('../../../../public/js/training-session.js')

const transcript = [
  {
    id: '3f2c9a52-6a0e-4d47-9c11-2b4a5d6e7f80',
    content: 'I feel unheard at home.',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: '8b7e5d41-2c9f-4a63-8f10-1d2e3c4b5a69',
    content: 'Nobody listens to me.',
    createdAt: '2026-11-01T10:05:00.000Z',
  },
]

/** Every key anywhere in a value, so a nested reply field cannot hide. */
const collectKeys = (
  value: unknown,
  keys: Set<string> = new Set(),
): Set<string> => {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key)
      collectKeys(child, keys)
    }
  }
  return keys
}

/** Every string anywhere in a value, so a nested reply sentence cannot hide. */
const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectStrings(child, out)
  }
  return out
}

/** Key names that would carry a client utterance if one were emitted. */
const utteranceKey =
  /^(?:content|reply|replies|response|text|utterance|dialogue|completion|message|messages|clientMessage)$/i

/** The labels of the word-list ladder this phase must not ship. */
const qualityLadder = ['Excellent', 'Good', 'Fair', 'Poor']

describe('the synthetic-client reply path emits no reply', () => {
  it('answers with the not-approved state and the owner blocker', async () => {
    const outcome = await requestClientReply({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    expect(outcome.status).toBe('not-approved')
    expect(outcome.blocker).toEqual(SYNTHETIC_CLIENT_REPLY_BLOCKER)
    expect(outcome.blocker.headline).toMatch(
      /awaiting the approved synthetic-client model/i,
    )
    expect(outcome.blocker.owner).toBe('Clinical content owner')
  })

  it('carries no field that could hold a client utterance', async () => {
    const outcome = await requestClientReply({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    expect(Object.keys(outcome)).toEqual(['status', 'blocker', 'transcript'])
    const offending = [...collectKeys(outcome)].filter((key) =>
      utteranceKey.test(key),
    )
    expect(offending).toEqual([])
  })

  it('produces no free text: every string is a blocker field or a timestamp', async () => {
    const outcome = await requestClientReply({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    const allowed = new Set([
      'not-approved',
      SYNTHETIC_CLIENT_REPLY_BLOCKER.id,
      SYNTHETIC_CLIENT_REPLY_BLOCKER.owner,
      SYNTHETIC_CLIENT_REPLY_BLOCKER.headline,
      SYNTHETIC_CLIENT_REPLY_BLOCKER.detail,
      '2026-11-01T10:00:00.000Z',
      '2026-11-01T10:05:00.000Z',
    ])
    const unexpected = collectStrings(outcome).filter(
      (value) => !allowed.has(value),
    )

    expect(unexpected).toEqual([])
  })

  it('does not echo the trainee message back as a reply', async () => {
    const outcome = await requestClientReply({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    const serialized = JSON.stringify(outcome)
    for (const message of transcript) {
      expect(serialized).not.toContain(message.content)
    }
  })

  it('reports the real transcript it would have been grounded in', async () => {
    const outcome = await requestClientReply({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    expect(outcome.transcript).toEqual({
      messageCount: 2,
      firstMessageAt: '2026-11-01T10:00:00.000Z',
      lastMessageAt: '2026-11-01T10:05:00.000Z',
      clientTurnCount: 0,
    })
  })

  it('refuses the same way with no session selected', async () => {
    const outcome = await requestClientReply({
      sessionId: undefined,
      transcript: [],
    })

    expect(outcome.status).toBe('not-approved')
    expect(outcome.transcript.messageCount).toBe(0)
    expect(outcome.transcript.firstMessageAt).toBeNull()
  })

  it('has no code path that returns a ready reply', () => {
    // A reply has to be *returned* by this module to reach a transcript. The
    // only status literal it may produce is `not-approved`.
    expect(moduleSource).not.toMatch(/status:\s*'(?!not-approved')[a-z-]+'/)
    expect(moduleSource).not.toMatch(/\bstatus:\s*'ready'/)
  })
})

describe('the coaching surface emits no coaching', () => {
  it('answers with both blockers, each owned by the clinical content owner', async () => {
    const outcome = await buildCoachingReport({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    expect(outcome.status).toBe('not-approved')
    expect(outcome.blockers).toEqual([
      COACHING_MODEL_BLOCKER,
      COACHING_TRANSCRIPT_BLOCKER,
    ])
    expect(outcome.blockers[0]?.headline).toMatch(
      /awaiting the approved coaching model/i,
    )
    for (const blocker of outcome.blockers) {
      expect(blocker.owner).toBe('Clinical content owner')
    }
  })

  it('carries no score, rating, or feedback field', async () => {
    const outcome = await buildCoachingReport({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    expect(Object.keys(outcome)).toEqual(['status', 'blockers', 'transcript'])
    expect(Object.keys(outcome.transcript)).toEqual([
      'messageCount',
      'firstMessageAt',
      'lastMessageAt',
      'clientTurnCount',
    ])
    for (const blocker of outcome.blockers) {
      expect(Object.keys(blocker)).toEqual([
        'id',
        'owner',
        'headline',
        'detail',
      ])
    }
  })

  it('produces no free text: every string is a blocker field or a timestamp', async () => {
    const outcome = await buildCoachingReport({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })

    const allowed = new Set([
      'not-approved',
      '2026-11-01T10:00:00.000Z',
      '2026-11-01T10:05:00.000Z',
    ])
    for (const blocker of outcome.blockers) {
      allowed.add(blocker.id)
      allowed.add(blocker.owner)
      allowed.add(blocker.headline)
      allowed.add(blocker.detail)
    }
    const unexpected = collectStrings(outcome).filter(
      (value) => !allowed.has(value),
    )

    expect(unexpected).toEqual([])
  })

  it('ships none of the word-list quality ladder', async () => {
    const outcome = await buildCoachingReport({
      sessionId: 'b0a3d1c2-1111-4222-8333-444455556666',
      transcript,
    })
    const strings = collectStrings(outcome)

    for (const label of qualityLadder) {
      expect(strings).not.toContain(label)
    }
    // The heuristic vocabulary is gone from the module, not merely unreachable.
    expect(moduleSource).not.toMatch(/therapeuticWords|problematicWords/)
  })

  it('has no code path that returns a ready report', () => {
    expect(moduleSource).not.toMatch(/status:\s*'ready'/)
  })
})

describe('the transcript summary is mechanical', () => {
  it('counts messages and keeps the first and last timestamps', () => {
    expect(summarizeTranscript(transcript)).toEqual({
      messageCount: 2,
      firstMessageAt: '2026-11-01T10:00:00.000Z',
      lastMessageAt: '2026-11-01T10:05:00.000Z',
      clientTurnCount: 0,
    })
  })

  it('reports an empty transcript without inventing one', () => {
    expect(summarizeTranscript([])).toEqual({
      messageCount: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      clientTurnCount: 0,
    })
  })
})

describe('the session page renders both blockers in place', () => {
  it('renders the reply state beside the composer, from the real transcript', () => {
    const replyTag =
      sessionPage.match(/<ClientReplyState[\s\S]*?\/>/)?.[0] ?? ''

    expect(sessionPage).toMatch(
      /import ClientReplyState from '\.\.\/_ClientReplyState\.astro'/,
    )
    expect(replyTag).not.toBe('')
    // Prettier's `astroAllowShorthand` renders `{transcript}` for the prop.
    expect(replyTag).toMatch(/transcript/)
    expect(replyTag).toMatch(/sessionId=\{sessionData\.sessionId\}/)
    expect(sessionPage).toMatch(
      /const transcript = sessionData\?\.messages \?\? \[\]/,
    )
  })

  it('renders the coaching panel in the trainee aside, linked to the full surface', () => {
    const panelTag =
      sessionPage.match(/<SessionGuidancePanel[\s\S]*?\/>/)?.[0] ?? ''

    expect(sessionPage).toMatch(
      /import SessionGuidancePanel from '\.\.\/_SessionGuidancePanel\.astro'/,
    )
    expect(panelTag).not.toBe('')
    expect(panelTag).toMatch(/transcript/)
    expect(panelTag).toMatch(/sessionId=\{sessionData\.sessionId\}/)
  })

  it('no longer presents the unapproved quality ladder as working', () => {
    // The ladder scored a trainee's message with a word list and labelled the
    // result Excellent/Good/Fair/Poor. It is not an approved coaching model, so
    // it is not on the trainee surface at all.
    expect(sessionPage).not.toContain('id="response-quality"')
    expect(sessionPage).not.toMatch(/Quality:\s*\{?'\s*\}?/)
    for (const label of qualityLadder) {
      expect(sessionPage).not.toMatch(new RegExp(`>\\s*${label}\\s*<`))
    }
  })

  it('no longer presents a suggestions control that gave therapeutic advice', () => {
    expect(sessionPage).not.toContain('id="suggestions-button"')
    expect(sessionPage).not.toContain('Get Suggestions')
  })

  it('keeps the composer status list the failure affordance writes to', () => {
    // `showConnectionStatus(false)` is the only signal that a message was not
    // saved; it must keep a container to write into.
    expect(guidancePanel).toContain('id="feedback-messages"')
  })
})

describe('the reply and coaching components render the owner blockers', () => {
  it('imports the decisions instead of restating them', () => {
    expect(replyStateComponent).toMatch(/from '\.\/_reply-and-coaching'/)
    expect(guidancePanel).toMatch(/from '\.\/_reply-and-coaching'/)
    expect(replyStateComponent).toMatch(/requestClientReply/)
    expect(guidancePanel).toMatch(/buildCoachingReport/)
  })

  it('renders blocker fields rather than authored copy', () => {
    for (const source of [replyStateComponent, guidancePanel]) {
      expect(source).toMatch(/\{(?:blocker|primary)\.headline\}/)
      expect(source).toMatch(/\{(?:blocker|primary)\.owner\}/)
      // The headline is not duplicated into the component: one source of truth.
      expect(source).not.toContain(SYNTHETIC_CLIENT_REPLY_BLOCKER.headline)
      expect(source).not.toContain(COACHING_MODEL_BLOCKER.headline)
    }
  })

  it('names the blocker id so a reviewer can grep for the decision', () => {
    expect(replyStateComponent).toMatch(/\{blocker\.id\}/)
    expect(guidancePanel).toMatch(/\{primary\.id\}/)
  })
})

describe('the coaching route', () => {
  it('reads the transcript through the one existing session path', () => {
    expect(coachingPage).toMatch(/getTrainingSessionResponse\(/)
    expect(coachingPage).toMatch(/classifyTrainingSessionLoad\(/)
    expect(coachingPage).toMatch(/searchParams\.get\('sessionId'\)/)
  })

  it('renders both seams from their real outcomes', () => {
    expect(coachingPage).toMatch(/await requestClientReply\(/)
    expect(coachingPage).toMatch(/await buildCoachingReport\(/)
    expect(coachingPage).toMatch(/\{replyOutcome\.blocker\.headline\}/)
    expect(coachingPage).toMatch(
      /\{coachingOutcome\.blockers\[0\]\?\.headline\}/,
    )
    expect(coachingPage).toMatch(/coachingOutcome\.blockers\.map\(/)
  })

  it('tells an outage apart from a missing session', () => {
    // A deadline 503 is temporary and retryable; a 4xx is a genuine absence.
    expect(coachingPage).toMatch(/loadState === 'unavailable'/)
    expect(coachingPage).toMatch(/Retry loading this transcript/)
    expect(coachingPage).toMatch(/Astro\.response\.status = 503/)
    expect(coachingPage).toMatch(/loadState === 'not-found'/)
  })

  it('resolves the page session once, through the shared helper', () => {
    const helperCalls = coachingPage.match(/resolvePageSession\s*\(/g) ?? []

    expect(helperCalls).toHaveLength(1)
    expect(coachingPage).toMatch(
      /resolvePageSession\(\s*Astro\.request,\s*Astro\.locals,?\s*\)/,
    )
    expect(coachingPage).not.toMatch(/\bgetSession\s*\(/)
    expect(coachingPage).not.toMatch(/\bisAuthenticated\s*\(/)
    expect(coachingPage).not.toMatch(/\bgetCurrentUser\s*\(/)
  })

  it('answers a provider outage with a retryable response, not a logout', () => {
    expect(coachingPage).toMatch(
      /providerUnavailableResponse\(Astro\.url\.pathname\)/,
    )
  })

  it('keeps the design system', () => {
    const chromaticChrome =
      /\b(?:bg|text|border|ring)-(?:emerald|indigo|red|green|blue|amber|purple|slate|gray|neutral|teal|pink|rose|cyan|yellow|orange)-/

    for (const source of [coachingPage, replyStateComponent, guidancePanel]) {
      expect(source).not.toMatch(chromaticChrome)
      expect(source).not.toMatch(/\brounded-(?!none)/)
      expect(source).not.toMatch(/\bshadow-/)
    }
    expect(coachingPage).toContain('min-h-[44px]')
  })
})

describe('the surfaces are reachable through normal navigation', () => {
  it('links the coaching surface from the training portal', () => {
    expect(indexPage).toContain('href="/training/coaching"')
    expect(indexPage).toMatch(/Client replies and session coaching/)
  })

  it('links back to the portal from the coaching surface', () => {
    expect(coachingPage).toContain('href="/training"')
  })

  it('links the session page to its own transcript coaching', () => {
    expect(guidancePanel).toMatch(
      /`\/training\/coaching\?sessionId=\$\{encodeURIComponent\(sessionId\)\}`/,
    )
  })
})

describe('no clinical content is authored', () => {
  it('does not consume the unapproved authored scenario list', () => {
    for (const source of [
      moduleSource,
      replyStateComponent,
      guidancePanel,
      sessionPage,
      coachingPage,
      indexPage,
    ]) {
      expect(source).not.toMatch(/from\s+['"][^'"]*data\/scenarios['"]/)
      expect(source).not.toMatch(/\bclientScenarios\b/)
    }
  })

  it('does not reproduce any authored scenario name', () => {
    const authoredScenarios = readFile('../../../data/scenarios.ts')
    const names = [...authoredScenarios.matchAll(/name:\s*'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect(names.length).toBeGreaterThan(0)

    const scaffoldSources = [
      moduleSource,
      replyStateComponent,
      guidancePanel,
      sessionPage,
      coachingPage,
      indexPage,
    ].join('\n')

    for (const name of names) {
      expect(scaffoldSources).not.toContain(name)
    }
  })

  it('names no persona, protocol, or competency in the module', () => {
    // The blocker details name the decisions that are missing. They must not
    // describe the content those decisions would contain.
    for (const source of [moduleSource, replyStateComponent, guidancePanel]) {
      expect(source).not.toMatch(
        /persona:|systemMessage|therapeuticOrientation/i,
      )
      expect(source).not.toMatch(
        /learningObjective|competencyLevel|rubricItem/i,
      )
    }
  })
})

describe('the composer never renders a client reply', () => {
  const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

  type Composer = {
    sessionData: { sessionId: string } | null
    sendMessage: () => Promise<void>
    cleanup: () => void
  }

  const loadComposerClass = (): new () => Composer => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/web/public/js/training-session.js'),
      'utf8',
    )
    // The class is declared at the top level of the script, so returning it from
    // the evaluated body hands the test the same implementation the page loads.
    return runInThisContext(
      `(function () {\n${source}\nreturn TrainingSession\n})()`,
    ) as new () => Composer
  }

  let composer: Composer
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="messages-container"></div>
      <textarea id="message-input"></textarea>
      <button id="send-message"></button>
      <span id="character-count"></span>
      <div id="feedback-messages"></div>
    `
    const Composer = loadComposerClass()
    composer = new Composer()
    composer.sessionData = { sessionId: SESSION_ID }
    fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { content: string }
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 'a944fd64-1c3b-4f5d-8e7a-9b0c1d2e3f40',
          content: body.content,
          createdAt: new Date().toISOString(),
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    composer?.cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('adds the trainee bubble and no client bubble after a send', async () => {
    const input = document.getElementById(
      'message-input',
    ) as HTMLTextAreaElement
    input.value = 'Practice response'

    await composer.sendMessage()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const container = document.getElementById('messages-container')
    const bubbles = [...(container?.children ?? [])]

    expect(bubbles).toHaveLength(1)
    expect(bubbles[0]?.className).toContain('message-therapist')
    expect(bubbles[0]?.className).not.toContain('message-client')
    expect(document.querySelector('.message-client')).toBeNull()
  })

  it('leaves the page-rendered reply state untouched', async () => {
    // The absence is rendered by the page, not appended per message.
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="client-reply-state">page rendered</div>',
    )
    const input = document.getElementById(
      'message-input',
    ) as HTMLTextAreaElement
    input.value = 'Practice response'

    await composer.sendMessage()

    expect(document.getElementById('client-reply-state')?.textContent).toBe(
      'page rendered',
    )
  })
})

describe('the composer script ships no unapproved coaching model', () => {
  it('no longer scores a trainee response with a word list', () => {
    expect(trainingScript).not.toMatch(/therapeuticWords|problematicWords/)
    expect(trainingScript).not.toMatch(/updateMessageQuality/)
    for (const label of qualityLadder) {
      expect(trainingScript).not.toMatch(new RegExp(`quality = '${label}'`))
    }
  })

  it('no longer answers a suggestions control with therapeutic advice', () => {
    expect(trainingScript).not.toMatch(/showSuggestions/)
    expect(trainingScript).not.toMatch(/Focus on reflecting the client/)
  })

  it('keeps the handlers that only render what a server sent', () => {
    // Removing the heuristics must not take the reply *render* path with it:
    // `handleClientResponse` is where an approved reply will be displayed.
    expect(trainingScript).toContain('handleClientResponse(data) {')
    expect(trainingScript).toContain('handleCrisisAlert(data) {')
    expect(trainingScript).toContain('handleFeedbackUpdate(data) {')
  })

  it('keeps the message-post idempotency path untouched', () => {
    // This feature builds on the restored submission identity; it must not
    // rename the header or drop the identity from the request.
    expect(trainingScript).toContain("'X-Message-Submission-Id'")
    expect(trainingScript).toContain('resolveSubmission(content)')
  })
})
