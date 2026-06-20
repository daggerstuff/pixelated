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
      const eventData = (event as { data?: unknown }).data;
      console.info(
        "[pipeline-audit] action result:",
        typeof eventData === "object" && eventData !== null && "status" in eventData
          ? (eventData as { status?: unknown }).status
          : eventData,
      );
    },
    "message.completed"(event, _ctx) {
      // eslint-disable-next-line no-console
      const eventType = (event as { type?: unknown }).type;
      console.info(
        "[pipeline-audit] message completed:",
        typeof eventType === "string" ? eventType : eventType,
      );
    },
  },
});
