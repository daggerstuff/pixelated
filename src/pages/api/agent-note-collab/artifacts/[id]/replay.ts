import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../../lib/auth/auth0-middleware";
import { getLedger } from "../../../../../lib/agent-note-collab/server";

export const GET: APIRoute = async ({ params, url, request }) => {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return authResult.response!;
  }

  const { id: artifactId } = params;
  if (!artifactId) {
    return new Response(JSON.stringify({ error: "Missing artifact ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const asOf = url.searchParams.get("asOf") || undefined;
  const ledger = getLedger();

  try {
    const turns = await ledger.replayByArtifact(artifactId, asOf);
    return new Response(JSON.stringify(turns), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: "Failed to replay artifact history" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
