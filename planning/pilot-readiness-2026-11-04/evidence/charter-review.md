# Pilot Charter Review

Reviewed `planning/pilot-readiness-2026-11-04/PILOT_CHARTER.md` against
`PROJECT_OUTLINE.md` (L01, L04–L16, G1–G6) and the existing pilot structure,
framework, operational checklist, pricing strategy, and simple pilot agreement.
Manual review by reading the source and final Markdown. No automated tests were
run because this is prose with no machine-consumed behavior.

## C001 — required contract fields: PASS

| Required field                   | Charter location                          | Source alignment                                                          |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| Buyer and user roles             | Partner and learning goal; Owners needed  | L01; M2                                                                   |
| Teaching use case                | Partner and learning goal                 | Product direction; L04                                                    |
| Included and excluded scope      | Format and included journey; Out of scope | L01, L04, L09, L15                                                        |
| Cohort, scenarios and duration   | Format and included journey               | M2 proposed 5–10 trainees, one faculty champion, 3–5 scenarios, 2–4 weeks |
| Synthetic data and privacy       | Out of scope; Data and measurement        | L03, L10–L12                                                              |
| Acceptance measures              | Data and measurement                      | L06, L08, L13                                                             |
| Support and incident limits      | Support and commercial terms; Go/no-go    | L12, L14                                                                  |
| Stop and continuation conditions | Go/no-go; Continuation (G6)               | G1–G6                                                                     |
| Accountable roles                | Owner fields and Owners needed            | L01; all people remain unassigned                                         |

## C002 — uncertainty and claim boundaries: PASS

The charter labels itself a proposal, identifies the buyer/procurement route and
people as unconfirmed, and leaves commercial terms, support coverage, research
authorization, baseline and thresholds undecided. It explicitly excludes
clinical care, real patient data, diagnosis/treatment, emergency monitoring,
unverified features, outcome claims, ROI, refunds, 24/7 support and research
co-authorship. It does not claim production readiness, customer commitment,
efficacy, safety approval or a launch date. The 2–4 week / 5–10 trainee scope is
identified as a learning hypothesis, not an offer.

## C003 — adjacent source preservation: PASS

SHA-256 values were captured before drafting and rechecked after drafting. All
six sources are byte-identical:

| Source                                                                | Before and after SHA-256                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PROJECT_OUTLINE.md`                                                  | `d36fab56d5cb263715e72936792eb2c2a6d80deb2ad11f4a92cc1b0f9408dbec` |
| `content/business-strategy/pilot-program-structure.md`                | `e88988c30f5cac37e7f6593f90f51dbee9d199f3ef18126b066f6a6a2c35a4e7` |
| `content/business-strategy/pilot-program-framework.md`                | `cd37abc45a97cd8edadf6d5ca21d9b127e65d779c282f224fae1a14f36ca8002` |
| `content/business-strategy/pilot-operations/operational-checklist.md` | `8f6a82d7c27a6daae0b413b25ab8f9535df0676ca409d35000bde4ef1d939c2a` |
| `content/business-strategy/pricing-strategy.md`                       | `f51d416279291c2b564a41206e91ae130abd5dabc4e188f52070b7a9deb8c11b` |
| `content/business-strategy/outreach/simple-pilot-contract.md`         | `6e0813045ffa86c42a756d323bf3e4ae4676a55fc4103a4ec7accaefa1b2c48e` |

## Remaining decision gate

This is a founder-review-ready proposal, not an approved contract. Assign named
owners and confirm the buyer, scenario/rubric, data terms, support coverage,
measurement thresholds and commercial terms before sharing as an offer or
enrolling anyone. Linear could not be refreshed in this session because its app
connection requires reauthentication; this review relies on the local
2026-11-02 outline snapshot. No tracker changes were made.

Cleanup: no QA process, browser, container, port, or script was created; the
temporary `/tmp` notepad was removed after preserving the durable notes in
`planning/pilot-readiness-2026-11-04/evidence/ULW_NOTEPAD.md`.
