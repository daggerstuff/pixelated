# Pixelated Empathy Training Pilot — Decision Draft

**Status:** Proposed; not approved or offered. **Decision requested:** accept,
edit, or reject the scope and assign accountable people before any customer
commitment.

| Contract item | Proposed term | Decision / owner |
| --- | --- | --- |
| Buyer and users | One university or professional training program; one faculty champion; 5–10 trainee users. The institutional buyer and procurement path are unconfirmed. | Founder/product: select target program and buyer. Institution: name faculty champion. |
| Teaching use case | Supervised practice of one difficult-conversation skill: trainee completes a synthetic scenario, reviews evidence-grounded feedback, retries, then discusses the saved session with faculty. | Faculty champion: choose skill and approve rubric. |
| Pilot boundary | After internal release rehearsal, propose a 2–4 week design-partner study using 3–5 approved scenarios. Training and simulation only. | Product + release owner: approve included scenarios and release. |
| Included | Invitation and sign-in; assigned synthetic scenarios; conversation, feedback and retry; saved-session and faculty-review journey. Include only features that pass the pinned-release rehearsal. | Engineering/QA: verify complete journey and failure recovery. |
| Excluded | Clinical care or advice; real patient records or PHI; diagnosis or treatment decisions; EHR, prescribing, payer or external scheduling integrations; emergency monitoring; unverified analytics, exports, multimodal features or outcome claims. | Product + safety owner: verify exclusions are disabled or clearly marked as demos. |
| Data and research | Use synthetic training content and minimum necessary account/session data. Agree access, retention, deletion, consent and incident handling before enrollment. Educational feedback is not clinical validation. Any research use needs separate institutional determination, authorization and consent. | Privacy/data owner + institution: approve data schedule and research status. |
| Acceptance and learning | Before enrollment, agree a rubric and thresholds. Measure journey completion, evidence-grounded feedback, retries, faculty review/usefulness, defects, support load, latency and cost per completed session where available. Report counts and limitations; do not promise improvement or compare against clinical outcomes. | Faculty + product: set baseline, thresholds, sample and review cadence. Analytics owner: confirm measurement source. |
| Support | Name a responder and coverage window before enrollment. Publish a contact route, severity definitions, response expectations and escalation/stop path in the signed scope. No 24/7 or dedicated-staff commitment is assumed. | Founder/customer success: confirm staffing and written hours. |
| Commercial terms | Price, payment, duration beyond the experiment, renewal, refunds, IP, publicity and research publication rights are undecided. No price or ROI guarantee is authorized by this draft. | Founder + institution procurement/legal: agree terms before signature. |
| Go/no-go and stop | Do not enroll until G1 product boundary and the applicable G2–G5 release, evaluation, privacy/security, operations and offer gates pass. Pause for cross-tenant access, data exposure, unsafe or misleading behavior, inability to honor deletion, unavailable support owner, material service failure, or measurement integrity failure. Resume only after documented review and approval. | Named release owner + safety/privacy owner: approve entry and any restart. |

**Owners required before external use:** founder/executive sponsor; product owner;
release/engineering owner; qualified safety/evaluation reviewer; privacy/data
owner; support responder; institution buyer; faculty champion. Names are not yet
assigned. This draft does not establish production readiness, customer
commitment, educational efficacy, clinical safety, or a launch date.

**Basis:** proposed experiment size follows `PROJECT_OUTLINE.md` M2; the journey
and prerequisite gates follow L01, L04–L15 and G1–G6. Older commercial drafts
contain larger cohorts, long durations, prices, support promises and outcomes;
those remain unvalidated historical proposals, not terms of this draft.
