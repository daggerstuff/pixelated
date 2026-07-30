import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: process.env.FORESIGHT_URL ?? "http://127.0.0.1:8764/sse",
  description:
    "Foresight memory MCP for intake and cohort management. Stores trainee " +
    "profiles, cohort assignments, enrollment records, and curriculum progress.",
  auth: process.env.FORESIGHT_URL
    ? {
        getToken: async () => ({
          token: process.env.FORESIGHT_TOKEN ?? "",
        }),
      }
    : undefined,
});
