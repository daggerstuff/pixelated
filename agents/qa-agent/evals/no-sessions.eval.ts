import { defineEval, type EveEvalContext } from 'eve/evals'
import { includes } from 'eve/evals/expect'

export default defineEval({
  description:
    'Verifies the QA assistant handles a no-sessions-in-window reply without crashing.',
  async test(t: EveEvalContext) {
    await t.send('Any sessions in window?')
    t.succeeded()
    // Soft check: the model may phrase the empty-window result differently,
    // so we only require a status term.
    t.check(t.reply, includes('no sessions'))
  },
})
