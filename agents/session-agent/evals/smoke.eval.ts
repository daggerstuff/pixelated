import { defineEval } from 'eve/evals'

export default defineEval({
  description:
    'Smoke coverage for the session-agent. Verifies the agent boots, ' +
    'accepts a turn, and exercises the start_session tool.',
  async test(t) {
    await t.send("Hi, I'd like to start a practice session, please.")
    t.succeeded()
    t.calledTool('start_session')
  },
})
