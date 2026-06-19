import { defineHook } from "eve/hooks";

// Audit log for every pipeline state transition and tool call result.
// The hook emits a structured event record so the program leads can
// reconstruct the full run trace from Foresight or a log aggregator.

export default defineHook({
  events: {
    "action.result"(event, _ctx) {
      // TODO(disable-no-console): replace with structured logger once
      // the pipeline-event MCP is wired for persistent storage.
      // eslint-disable-next-line no-console
      console.info("[pipeline-audit] action result:", event.data.status);
    },
    "message.completed"(event, _ctx) {
      // eslint-disable-next-line no-console
      console.info("[pipeline-audit] message completed:", event.type);
    },
  },
});
