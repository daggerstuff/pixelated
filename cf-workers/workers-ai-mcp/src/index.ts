/**
 * workers-ai-mcp: Cloudflare Workers MCP server exposing Workers AI models
 * as tools consumable by Pixelated Empathy Eve agents.
 *
 * Tools:
 *   summarize_session      - Condense a clinical session transcript
 *   classify_text          - Multi-label text classification
 *   analyze_sentiment      - Sentiment/emotion signal for a text span
 *   detect_crisis_patterns - Crisis indicator detection
 *   translate_text         - Translate text to a target language
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AiTextGenerationOutput } from "@cloudflare/workers-types";

function text(raw: unknown): string {
  const out = raw as AiTextGenerationOutput;
  return out?.response ?? "No response returned.";
}

function buildServer(binding: Ai): McpServer {
  const server = new McpServer({
    name: "Workers AI MCP",
    version: "0.1.0",
  });

  // ── summarize_session ─────────────────────────────────────────────
  server.tool(
    "summarize_session",
    {
      transcript: z.string().min(1).max(32000),
      max_words: z.number().int().min(50).max(2000).default(500),
    },
    async ({ transcript, max_words }) => {
      const prompt =
        `Summarize this clinical rehearsal session transcript in at most ${max_words} words. ` +
        `Focus on: key dialogue themes, emotional trajectory, clinical boundary events, ` +
        `and overall outcome. No patient-identifiable information.\n\nTRANSCRIPT:\n${transcript}`;
      const result = await binding.run("@cf/meta/llama-3.2-3b-instruct", {
        prompt,
        max_tokens: max_words * 3,
        stream: false,
      });
      return { content: [{ type: "text" as const, text: text(result) }] };
    },
  );

  // ── classify_text ─────────────────────────────────────────────────
  server.tool(
    "classify_text",
    {
      text: z.string().min(1).max(16000),
      categories: z.array(z.string()).min(1).max(20),
    },
    async ({ text: inputText, categories }) => {
      const prompt =
        `Classify the following text into these categories: ${categories.join(", ")}\n\n` +
        `Return only JSON: {"primary_category":string,"confidence":0.0-1.0,"matched_categories":[],"rationale":"one sentence"}` +
        `\n\nTEXT:\n${inputText}`;
      const result = await binding.run("@cf/meta/llama-3.2-3b-instruct", {
        prompt,
        max_tokens: 300,
        stream: false,
      });
      const raw = text(result);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return {
        content: [{ type: "text" as const, text: jsonMatch ? jsonMatch[0] : raw }],
      };
    },
  );

  // ── analyze_sentiment ─────────────────────────────────────────────
  server.tool(
    "analyze_sentiment",
    {
      text: z.string().min(1).max(8000),
      context: z.string().max(2000).optional(),
    },
    async ({ text: inputText, context }) => {
      const ctx = context ? `Context: ${context}\n\n` : "";
      const prompt =
        `${ctx}Analyze the emotional content. Return only JSON: ` +
        `{"primary_emotion":string,"intensity":0.0-1.0,"valence":-1.0-1.0,` +
        `"risk_flags":[],"confidence":0.0-1.0}\n\nTEXT:\n${inputText}`;
      const result = await binding.run("@cf/meta/llama-3.2-3b-instruct", {
        prompt,
        max_tokens: 300,
        stream: false,
      });
      const raw = text(result);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return {
        content: [{ type: "text" as const, text: jsonMatch ? jsonMatch[0] : raw }],
      };
    },
  );

  // ── detect_crisis_patterns ────────────────────────────────────────
  server.tool(
    "detect_crisis_patterns",
    {
      text: z.string().min(1).max(16000),
      sensitivity: z.enum(["low", "normal", "high"]).default("normal"),
    },
    async ({ text: inputText, sensitivity }) => {
      const prompt =
        `You are a clinical safety monitor. Sensitivity: ${sensitivity}.\n\n` +
        `Return only JSON: {"severity":"none|warning|critical","flagged_risk_criteria":[],` +
        `"boundary_passed":boolean,"recommendation":"max 100 chars"}\n\nTEXT:\n${inputText}`;
      const result = await binding.run("@cf/meta/llama-3.2-3b-instruct", {
        prompt,
        max_tokens: 400,
        stream: false,
      });
      const raw = text(result);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return {
        content: [{ type: "text" as const, text: jsonMatch ? jsonMatch[0] : raw }],
      };
    },
  );

  // ── translate_text ────────────────────────────────────────────────
  server.tool(
    "translate_text",
    {
      text: z.string().min(1).max(16000),
      target_language: z.string().min(2).max(20),
      source_language: z.string().min(2).max(20).optional(),
    },
    async ({ text: inputText, target_language, source_language }) => {
      const src = source_language ? ` from ${source_language}` : "";
      const prompt =
        `Translate the following text${src} to ${target_language}. ` +
        `Return only the translated text, no explanations.\n\nTEXT:\n${inputText}`;
      const result = await binding.run("@cf/meta/llama-3.2-3b-instruct", {
        prompt,
        max_tokens: 2000,
        stream: false,
      });
      return {
        content: [{ type: "text" as const, text: text(result) }],
      };
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const server = buildServer(env.AI);
    const handler = createMcpHandler(server);
    return handler(request, env, {} as ExecutionContext);
  },
};
