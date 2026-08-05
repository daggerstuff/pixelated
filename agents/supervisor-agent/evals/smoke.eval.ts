import { defineEval } from 'eve/evals'

export default defineEval({
  description:
    'Smoke coverage for the supervisor-agent. Verifies the agent boots and can ' +
    'query cohort trends.',
  async test(t) {
    await t.send(
      'Show me the trends for cohort CBT-2026-01 over the last 30 days.',
    )
    t.succeeded()
    t.calledTool('query_cohort_trends')
  },
})
