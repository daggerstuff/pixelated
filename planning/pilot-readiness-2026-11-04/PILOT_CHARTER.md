# Pixelated Empathy Training Pilot — Decision Draft

**Status:** Starting scope accepted by user on 2026-11-04; not an approved
customer offer. Accepted scope: one training program, 5–10 trainees, 3–5
synthetic scenarios, 2–4 weeks. Buyer, named owners and contract terms remain
open.

**Readiness decision (2026-11-04): NO-GO.** Enrollment and customer launch are
not authorized. Session progress/snapshot ownership checks, the authenticated
training-session read handler and trainee-message persistence have focused test
coverage and are deployed to production under commit `f497d82ce`. Migration 017
is applied to the production app database. Cross-organization verification is
still open. Session creation, automated synthetic
client replies, coaching analysis, faculty review and end-to-end release proof
remain incomplete. The technical release does not authorize the pilot. See
[`LAUNCH_DECISIONS.md`](LAUNCH_DECISIONS.md) for package statuses, evidence,
owner roles, proposed defaults and closure criteria.

**Partner and learning goal.** One university or professional training program,
one faculty champion, and a proposed 5–10 trainees. Practice one difficult-
conversation skill: complete an approved synthetic scenario, review feedback
grounded in the transcript, retry, and review the saved session with faculty.
Buyer, procurement path and faculty champion are unconfirmed.

**Format and included journey.** After internal release rehearsal, propose 2–4
weeks with 3–5 approved scenarios. Include invitation/sign-in, scenario,
conversation, feedback, retry, saved session and faculty review, only where
each step passes on the pinned release. The small cohort and duration are
learning hypotheses from `PROJECT_OUTLINE.md` M2, not customer commitments.

**Out of scope.** Clinical care or advice, diagnosis or treatment decisions,
real patient records or PHI, emergency monitoring, EHR/prescribing/payer or
scheduling integrations, and any unverified analytics, exports, multimodal
features or outcome claims. Disable excluded functions or label them as demos.
Educational feedback is not clinical validation. Research use requires separate
institutional determination, authorization and consent.

**Data and measurement.** Use synthetic training content and minimum necessary
account/session data. Before enrollment, agree access, retention, deletion,
consent and incident handling. Agree a supervisor rubric, baseline and
thresholds in advance. Report journey completion, grounded-feedback and retry
rates, faculty usefulness, defects, support load, latency and cost where
measurable, with sample limits. Promise no improvement or clinical outcome.

**Support and commercial terms.** Name a responder, coverage window, contact
route, severity levels, response expectations and escalation path in the signed
scope. Price, payment, refunds, renewal, IP, publicity and publication rights
remain undecided. No 24/7 support, ROI guarantee, refund, dedicated staffing or
research co-authorship is included.

**Go/no-go.** Do not enroll until G1 and applicable G2–G5 gates pass: defined
scope; pinned release and working journey; evaluation decision; privacy,
security and operations approval; and a supportable offer. Pause for cross-
tenant access, data exposure, unsafe or misleading behavior, failed deletion,
unavailable support, material service failure or unreliable measurement.
Document review and approval before resuming.

**Continuation (G6).** After the pilot, review observed results and decide paid
continuation or no-go; no renewal or expansion is assumed.

**Owners needed:** founder/sponsor, product, release/engineering,
privacy/data, support responder, institution buyer and faculty champion. Paige
Taylor, LPCC-S, is the established qualified assessment reviewer in Foresight
context; confirm availability and a pilot-specific review before relying on a
candidate assessment. Other people are not assigned. This draft establishes no
production readiness, customer commitment, efficacy, safety approval or launch
date. Older pilot/pricing documents contain larger cohorts, prices, guarantees
and service promises; retain them as historical proposals, not current terms.
