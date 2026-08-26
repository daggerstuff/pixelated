/**
 * Cloudflare AI Gateway — OpenAI-compatible /compat/embeddings endpoint.
 *
 * Bypasses the buggy workers-ai-provider code that sends the model name in the
 * URL path (`/workers-ai/run/{model}`). Instead we hit:
 *
 *   POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/compat/embeddings
 *
 * …which accepts the model in the JSON body, exactly like OpenAI.
 *
 * Activate by setting `KIMIFLARE_AI_GATEWAY_ID` in your environment.
 */

import { createBuildSafeLogger } from "../logging/build-safe-logger";

const logger = createBuildSafeLogger("cloudflare-compat-embeddings");

export interface CompatEmbeddingRequest {
  /** Text(s) to embed */
  input: string | string[];
  /** Cloudflare Workers AI model id, e.g. `@cf/baai/bge-small-en-v1.5` */
  model?: string;
}

export interface CompatEmbeddingResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface CompatEmbeddingError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

const DEFAULT_MODEL = "@cf/baai/bge-small-en-v1.5";

/**
 * Read an environment variable from either the Vite/Astro build-time env
 * (`import.meta.env`) or the Node.js runtime env (`process.env`).
 *
 * `import.meta.env` is typed as `any`, so we coerce each lookup to a
 * well-defined `string | undefined` to keep callers type-safe.
 */
function readEnv(key: string): string | undefined {
  const metaEnv = import.meta.env as Record<string, unknown> | undefined;
  const buildValue = metaEnv?.[key];
  if (typeof buildValue === "string" && buildValue.length > 0) {
    return buildValue;
  }

  const runtimeValue = process.env[key];
  if (typeof runtimeValue === "string" && runtimeValue.length > 0) {
    return runtimeValue;
  }

  return undefined;
}

function getGatewayId(): string | undefined {
  return readEnv("KIMIFLARE_AI_GATEWAY_ID");
}

function getAccountId(): string | undefined {
  return readEnv("CLOUDFLARE_ACCOUNT_ID");
}

function getApiKey(): string | undefined {
  return readEnv("CLOUDFLARE_AI_API_KEY");
}

/**
 * Returns true when the compat endpoint is configured locally.
 */
export function isCompatEmbeddingsEnabled(): boolean {
  return Boolean(getGatewayId() && getAccountId() && getApiKey());
}

/**
 * Generate embeddings via the Cloudflare AI Gateway OpenAI-compatible endpoint.
 *
 * @throws Error on missing configuration or non-2xx response.
 */
export async function createCompatEmbeddings(
  request: CompatEmbeddingRequest,
): Promise<CompatEmbeddingResponse> {
  const gatewayId = getGatewayId();
  const accountId = getAccountId();
  const apiKey = getApiKey();

  if (!gatewayId) {
    throw new Error(
      "KIMIFLARE_AI_GATEWAY_ID is not set. " +
        "Add it to your .env.local to use the compat embeddings endpoint.",
    );
  }
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. " +
        "Required for Cloudflare AI Gateway compat embeddings.",
    );
  }
  if (!apiKey) {
    throw new Error(
      "CLOUDFLARE_AI_API_KEY is not set. " +
        "Required for Cloudflare AI Gateway compat embeddings.",
    );
  }

  const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai/compat/embeddings`;
  const body = {
    model: request.model ?? DEFAULT_MODEL,
    input: request.input,
  };

  logger.info("Calling Cloudflare AI Gateway compat embeddings", {
    gatewayId,
    model: body.model,
    inputCount: Array.isArray(body.input) ? body.input.length : 1,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorPayload: CompatEmbeddingError | string;
    try {
      errorPayload = (await response.json()) as CompatEmbeddingError;
    } catch {
      errorPayload = await response.text();
    }
    const message =
      typeof errorPayload === "string"
        ? errorPayload
        : errorPayload.error?.message ?? `HTTP ${response.status}`;
    logger.error("Cloudflare compat embeddings failed", {
      status: response.status,
      message,
    });
    throw new Error(`Cloudflare compat embeddings error: ${message}`);
  }

  const data = (await response.json()) as CompatEmbeddingResponse;
  logger.info("Cloudflare compat embeddings succeeded", {
    model: data.model,
    count: data.data.length,
    usage: data.usage,
  });
  return data;
}

/**
 * Convenience wrapper: embed a single string and return the vector.
 */
export async function embedTextCompat(
  text: string,
  model?: string,
): Promise<number[]> {
  const response = await createCompatEmbeddings({ input: text, model });
  if (!response.data[0]) {
    throw new Error("No embedding returned from Cloudflare compat endpoint");
  }
  return response.data[0].embedding;
}

/**
 * Convenience wrapper: embed multiple strings and return the vectors.
 */
export async function embedTextsCompat(
  texts: string[],
  model?: string,
): Promise<number[][]> {
  const response = await createCompatEmbeddings({ input: texts, model });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
