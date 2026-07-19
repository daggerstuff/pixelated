import { defineMcpClientConnection } from "eve/connections";

// Foresight MCP. Stores the demo-ready curation picks and pulls prior
// audit runs so the QA agent can cite memory IDs in its report.

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_URL ?? "http://127.0.0.1:8764/sse",
  description:
    "Foresight memory MCP for demo corpus QA. Stores curation picks " +
    "and pulls prior audit runs for citation.",
  auth: process.env.FORESIGHT_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_TOKEN ?? "",
        }),
      }
    : undefined,
});
