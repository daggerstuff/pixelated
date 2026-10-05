# Simulator Module — Privacy Utilities

This module now holds the privacy-preserving utilities that other parts of the
application consume. The real-time healthcare simulation prototype that once
lived here (WebRTC container, feedback panels, scenario selectors, and the
supporting context/services/data layers) was never mounted anywhere and had
zero importers; it was removed.

## What remains

- `utils/privacy.ts` — ephemeral session IDs, privacy hashing, PHI-safe
  text sanitization, consent-form generation. Consumers:
  ConsentDialog, the security anonymization pipeline.
- `utils/speechRecognition.ts` — therapeutic-technique analysis used by
  SupervisorFeedback.
- `hooks/useAnonymizedMetrics.ts` — privacy-preserving progress tracking
  consumed by MetricsDialog.
- `types.ts` / `types/` — shared type definitions (e.g.
  `TherapeuticTechnique`), re-exported through `types.ts` for compatibility.

## Security and Privacy

- No session recording
- No persistent storage of interactions
- Anonymized metrics collection only with user consent
