import { defineHook } from "eve/hooks";

// PII redaction pass on every assistant reply. Will route through
// ai-services/security/pii_scrubber.py once the sidecar is wired. For now
// only logs the call; the real scrub is performed when the parent's
// save_session tool runs and that stub includes the same call site.

export default defineHook({
  events: {
    "message.completed"(event) {
      const text = event.data.message ?? "";
      if (typeof text === "string") {
        // TODO(disable-no-console): replace with structured logger
        // eslint-disable-next-line no-console
        console.info("[pii-scrubber-hook] would scan", text.length, "chars");
      }
    },
  },
});
