import { defineMcpClientConnection } from "eve/connections";

// Workers AI MCP server deployed on Cloudflare Workers. Exposes 5 tools:
// summarize_session, classify_text, analyze_sentiment,
// detect_crisis_patterns, translate_text.
//
// Pipeline agent uses this for pre-evaluation scoring and lightweight
// inference during training pipeline steps.

export default defineMcpClientConnection({
  url: "https://workers-ai-mcp.coburncd.workers.dev/mcp",
  description:
    "Workers AI inference MCP backed by @cf/meta/llama-3.2-3b-instruct on " +
    "Cloudflare Workers. Exposes clinical tools for session summarization, " +
    "text classification, sentiment analysis, crisis detection, and " +
    "translation. All inference runs at the edge on the Workers AI free tier.",
  headers: {
    "Accept": "application/json, text/event-stream",
  },
});
