import { z } from "zod";

import {
  jsonError,
  jsonResponse,
  requireAuthenticatedMemoryCaller,
} from "@/lib/memory/contract/route-helpers";

const DEFAULT_UPSTREAM_GATE_ORIGIN = "http://127.0.0.1:8100";

const IngestRequestSchema = z.object({
  content: z.string().min(1),
  source_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
});

const IngestResponseSchema = z.object({
  accepted: z.boolean(),
  report: z.record(z.string(), z.unknown()),
  request_id: z.string().min(1),
});

function getUpstreamUrl(path: string): string {
  const origin = (process.env["INGESTION_GATE_ORIGIN"] || DEFAULT_UPSTREAM_GATE_ORIGIN).replace(
    /\/$/,
    "",
  );
  return `${origin}${path}`;
}

async function proxyUpstream(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(getUpstreamUrl(path), init);
  } catch {
    return jsonError({
      status: 503,
      code: "ingestion_gate_unavailable",
      message: "The ingestion gate service is unavailable.",
    });
  }
}

export const GET = async (context: { request: Request }): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request);
  if (!auth.ok) return auth.response;

  const upstream = await proxyUpstream("/health", { method: "GET" });
  if (!upstream.ok) {
    return jsonError({
      status: upstream.status,
      code: "ingestion_gate_health_failed",
      message: "The ingestion gate health check failed.",
    });
  }

  const payload = await upstream.json();
  return jsonResponse(payload);
};

export const POST = async (context: { request: Request }): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return jsonError({
      status: 400,
      code: "bad_request",
      message: "Request body must be valid JSON.",
    });
  }

  const parsed = IngestRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "validation_failed",
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; "),
    });
  }

  const upstream = await proxyUpstream("/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...parsed.data,
      user_id: parsed.data.user_id ?? auth.caller.user.id,
    }),
  });

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return jsonError({
      status: 502,
      code: "ingestion_gate_bad_response",
      message: "The ingestion gate returned invalid JSON.",
    });
  }

  if (!upstream.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : "The ingestion gate request failed.";
    return jsonError({
      status: upstream.status,
      code: "ingestion_gate_failed",
      message: detail,
    });
  }

  const response = IngestResponseSchema.safeParse(payload);
  if (!response.success) {
    return jsonError({
      status: 502,
      code: "ingestion_gate_bad_response",
      message: "The ingestion gate response did not match the expected contract.",
    });
  }

  return jsonResponse(response.data);
};
