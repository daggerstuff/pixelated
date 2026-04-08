import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth/auth0-middleware";
import { getLedger } from "../../../../lib/agent-note-collab/server";

export const GET: APIRoute = async ({ params, request }) => {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return authResult.response!;
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing turn ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ledger = getLedger();
  try {
    const turn = await ledger.getById(id);
    if (!turn) {
      return new Response(JSON.stringify({ error: "Turn not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(turn), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: "Failed to fetch turn" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
