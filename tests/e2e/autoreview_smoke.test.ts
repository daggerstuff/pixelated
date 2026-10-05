import { writeFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  BotCommentFilter,
  FailoverChain,
  InMemoryProcessedCommentStore,
  RuleBasedProvider,
  ValidationOrchestrator,
  buildChainFromEnv,
  createGithubApi,
  decideValidation,
  dedupeComments,
  runReview,
  type GithubApi,
  type PullRequestRef,
  type ReviewResult,
  type SandboxRunner,
} from '../../packages/autoreview/src/index'

const LIVE = process.env.AUTOREVIEW_SMOKE_MODE === 'live'

const FIXTURE_DIFF = `diff --git a/src/app.ts b/src/app.ts
new file mode 100644
--- /dev/null
+++ b/src/app.ts
@@ -0,0 +1,8 @@
+import { fetchData } from './data'
+
+export function run(): number {
+  console.log('leftover debug output')
+  const value: any = fetchData()
+  debugger
+  // TODO: remove before merge
+  return value
+}
+`

const REF: PullRequestRef = { owner: 'pixelated', repo: 'empathy', number: 1 }

const EXISTING_COMMENTS = [
  {
    id: '1',
    authorLogin: 'alice',
    authorAssociation: 'MEMBER',
    body: 'needs work',
  },
  {
    id: '2',
    authorLogin: 'dependabot[bot]',
    authorAssociation: 'NONE',
    body: 'bump dep',
  },
  {
    id: '3',
    authorLogin: 'chad',
    authorAssociation: 'CONTRIBUTOR',
    body: 'looks ok',
  },
]

function makeOfflineGithub(): {
  github: GithubApi
  postedReviews: ReviewResult[]
} {
  const postedReviews: ReviewResult[] = []
  const github: GithubApi = {
    async fetchPullRequest() {
      return { diff: FIXTURE_DIFF, context: 'AutoReview smoke test PR' }
    },
    async fetchReviewComments() {
      return EXISTING_COMMENTS
    },
    async submitReview(_ref, review) {
      postedReviews.push(review)
    },
    async submitComment() {},
  }
  return { github, postedReviews }
}

describe.skipIf(LIVE)('AutoReview smoke (offline pipeline)', () => {
  it('reviews a PR with known issues end-to-end', async () => {
    const { github, postedReviews } = makeOfflineGithub()
    const chain = new FailoverChain({
      steps: [{ provider: new RuleBasedProvider(), retries: 1 }],
    })

    const result = await runReview({
      github,
      chain,
      ref: REF,
      logger: () => {},
    })

    // The failover chain ran the deterministic rule-based provider.
    expect(result.provider).toBe('rule-based')

    // Exactly one review comment was posted to the PR.
    expect(postedReviews).toHaveLength(1)
    const review = postedReviews[0]

    // All known lint/anti-pattern issues are identified, with file + line.
    const bodies = review.comments.map((comment) => comment.body)
    expect(bodies.some((body) => body.includes('console'))).toBe(true)
    expect(bodies.some((body) => body.includes('any'))).toBe(true)
    expect(bodies.some((body) => body.includes('debugger'))).toBe(true)
    expect(bodies.some((body) => body.includes('TODO'))).toBe(true)
    expect(
      review.comments.every((comment) => comment.path === 'src/app.ts'),
    ).toBe(true)
    expect(
      review.comments.every((comment) => typeof comment.line === 'number'),
    ).toBe(true)
  })

  it('filters bot comments and does not re-raise processed comments', async () => {
    const { github } = makeOfflineGithub()
    const filter = new BotCommentFilter()
    const humanComments = filter.filter(await github.fetchReviewComments())
    expect(humanComments.map((comment) => comment.id)).toEqual(['1', '3'])

    const store = new InMemoryProcessedCommentStore()
    const ids = async () =>
      (await github.fetchReviewComments()).map((comment) => ({
        id: comment.id,
      }))
    const first = dedupeComments(await ids(), store)
    expect(first.fresh).toHaveLength(3)
    const second = dedupeComments(await ids(), store)
    expect(second.fresh).toEqual([])
    expect(second.alreadyProcessed).toEqual(['1', '2', '3'])
  })

  it('flags a failing validation suite for human review', async () => {
    const failingRunner: SandboxRunner = {
      async run() {
        return { exitCode: 1, stdout: '', stderr: 'tests failed' }
      },
    }
    const result = await new ValidationOrchestrator({
      maxAttempts: 2,
    }).validate(failingRunner)
    expect(result.status).toBe('failed')
    expect(decideValidation(result)).toBe('needs-review')
  })
})

describe.skipIf(!LIVE)('AutoReview smoke (live)', () => {
  it(
    'reviews a real PR and writes the result log',
    { timeout: 300_000 },
    async () => {
      const token = process.env.GITHUB_TOKEN
      const repository = process.env.GITHUB_REPOSITORY
      const number = Number(process.env.AUTOREVIEW_SMOKE_PR)
      if (!token || !repository || !number) {
        throw new Error(
          'live smoke requires GITHUB_TOKEN, GITHUB_REPOSITORY, AUTOREVIEW_SMOKE_PR',
        )
      }
      const [owner, repo] = repository.split('/')
      const github = createGithubApi((url, init) => fetch(url, init), token)
      const chain = buildChainFromEnv({
        LLM_PRIMARY: process.env.LLM_PRIMARY,
        LLM_SECONDARY: process.env.LLM_SECONDARY,
        LLM_PRIMARY_RETRIES: process.env.LLM_PRIMARY_RETRIES,
        LLM_SECONDARY_RETRIES: process.env.LLM_SECONDARY_RETRIES,
        LLM_RULE_BASED: process.env.LLM_RULE_BASED,
      })
      const result = await runReview({
        github,
        chain,
        ref: { owner, repo, number },
        logger: (message) => console.log(message),
      })
      const outcome = {
        provider: result.provider,
        attempts: result.attempts,
        summary: result.result.summary,
        comments: result.result.comments.length,
        timestamp: new Date().toISOString(),
      }
      writeFileSync(
        new URL('./autoreview-smoke-result.json', import.meta.url),
        JSON.stringify(outcome, null, 2),
      )
      expect(result.result.summary.length).toBeGreaterThan(0)
    },
  )
})
