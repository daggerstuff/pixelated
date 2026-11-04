import { defineInstrumentation } from 'eve/instrumentation'

import { setupLangSmithOTel } from './langsmith-otel.js'

/**
 * Eve instrumentation — local traces + LangSmith OTel export.
 *
 * Exports traces to LangSmith via OTLP HTTP when LANGSMITH_API_KEY is set.
 * Falls back to local disk traces (eve traces CLI / /traces TUI) without it.
 *
 * Framework auto-injects runtime context on all spans:
 * eve.version, eve.session.id, eve.environment, eve.turn.id,
 * eve.turn.sequence, eve.step.index, eve.channel.kind
 */
export default defineInstrumentation({
  setup: ({ agentName }) => setupLangSmithOTel({ agentName }),
  // Record prompt and completion content for every audience. eve 0.90 replaced
  // the flat recordInputs/recordOutputs/traceChannelRequests flags with a
  // per-trace policy; channel request spans are always traced now.
  tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: true }),
})
