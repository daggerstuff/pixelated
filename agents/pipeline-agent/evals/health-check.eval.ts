import { defineEval, type EveEvalContext } from 'eve/evals'
import { includes } from 'eve/evals/expect'

export default defineEval({
  description:
    'Verifies the pipeline orchestrator responds to a health check without crashing.',
  async test(t: EveEvalContext) {
    await t.send('Check pipeline health')
    t.succeeded()
    t.check(t.reply, includes('health'))
  },
})
