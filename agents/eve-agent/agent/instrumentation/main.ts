import { defineInstrumentation } from 'eve/instrumentation'

export default defineInstrumentation({
  // Record prompt and completion content for every audience. eve 0.90 replaced
  // the flat recordInputs/recordOutputs/traceChannelRequests flags with a
  // per-trace policy; channel request spans are always traced now.
  tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: true }),
})
