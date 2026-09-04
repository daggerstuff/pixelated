import { defineInstrumentation } from 'eve/instrumentation'

export default defineInstrumentation({
  traceChannelRequests: true,
  recordInputs: true,
  recordOutputs: true,
})
