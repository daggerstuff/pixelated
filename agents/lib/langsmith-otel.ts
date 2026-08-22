/**
 * LangSmith OTel setup — exports Eve agent traces to LangSmith via OTLP HTTP.
 *
 * Env vars (from hackathon/.env or deployment env):
 * - LANGSMITH_API_KEY: Required. LangSmith API key (lsv2_pt_...).
 * - LANGSMITH_ENDPOINT: Optional. Defaults to https://api.smith.langchain.com.
 * - LANGSMITH_PROJECT: Optional. Defaults to "tracer".
 *
 * If LANGSMITH_API_KEY is not set, setup is skipped and local eve traces continue.
 */
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

let registered = false

/**
 * Set up OTel trace export to LangSmith for an Eve agent.
 * Called from `instrumentation.ts` → `defineInstrumentation({ setup })`.
 * Guards against double-registration when multiple agents share a process.
 */
export function setupLangSmithOTel({ agentName }: { agentName: string }): void {
  if (registered) return
  registered = true

  const apiKey = process.env.LANGSMITH_API_KEY
  if (!apiKey) {
    console.warn(
      `[langsmith-otel] LANGSMITH_API_KEY not set — local traces only for ${agentName}`,
    )
    return
  }

  const endpoint =
    process.env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com'
  const project = process.env.LANGSMITH_PROJECT ?? 'tracer'

  const exporter = new OTLPTraceExporter({
    url: `${endpoint}/otel/v1/traces`,
    headers: { 'x-api-key': apiKey },
  })

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: agentName,
      'langsmith.project': project,
    }),
    traceExporter: exporter,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  })

  sdk.start()
  console.info(
    `[langsmith-otel] ${agentName} → LangSmith (project: ${project}, endpoint: ${endpoint})`,
  )
}
