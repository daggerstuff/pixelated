import { defineEvalConfig } from 'eve/evals'

import { AGENT_MODEL } from '../agent/lib/workers-ai.js'

export default defineEvalConfig({
  judge: { model: AGENT_MODEL },
})
