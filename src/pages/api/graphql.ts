/**
 * Astro API Route — /api/graphql
 *
 * PIX-4064: GraphQL Federation Layer
 *
 * Handles:
 * - GET: GraphiQL playground (dev) or health check
 * - POST: GraphQL queries/mutations
 * - WebSocket upgrade: graphql-ws subscriptions (handled by Astro adapter)
 */

import { yoga } from "@/lib/graphql/server";
import type { APIRoute } from "astro";

export const prerender = false;

// Astro handles WebSocket upgrades when using the Node adapter
// with `astro config.adapter` supporting websockets.
// For now, we delegate to yoga which handles both HTTP and WS.

export const GET: APIRoute = async (context) => {
  const response = await yoga.handle(context.request);
  return response;
};

export const POST: APIRoute = async (context) => {
  const response = await yoga.handle(context.request);
  return response;
};

// OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async (context) => {
  const response = await yoga.handle(context.request);
  return response;
};
