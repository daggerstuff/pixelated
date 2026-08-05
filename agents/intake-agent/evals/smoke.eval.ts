import { defineEval } from 'eve/evals'

export default defineEval({
  description:
    'Smoke coverage for the intake-agent. Verifies the agent boots and ' +
    'accepts a registration interaction.',
  async test(t) {
    await t.send(
      "I'd like to register a new trainee: Dr. Sarah Chen, LCSW, specializing in trauma therapy.",
    )
    t.succeeded()
    t.calledTool('register_trainee')
  },
})
