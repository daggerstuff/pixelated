import type { APIRoute } from "astro";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ModelMessage } from "ai";

import { verifyAuthToken } from "../../utils/auth";

export const prerender = false;

type MessageRequestBody = {
  userId: string;
  message: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toMessageRequestBody = (value: unknown): MessageRequestBody | null => {
  if (!isObject(value)) return null;

  const { userId, message } = value;
  if (typeof userId !== "string" || typeof message !== "string") {
    return null;
  }

  return { userId, message };
};

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authorization header required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract Bearer token from Authorization header
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  try {
    await verifyAuthToken(token);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const requestBody = toMessageRequestBody(await request.json());
  if (!requestBody) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request format",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const message = requestBody.message;

  const messages: ModelMessage[] = [
    {
      role: "system",
      content: "You are a helpful AI therapist assistant.",
    },
    { role: "user", content: message },
  ];

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    messages,
  });

  return result.toTextStreamResponse();
};
