---
title: Google Cloud Startup Program Application - Pixelated Empathy
category: startup_program
tags:
  - strategy
  - google-cloud
  - startup-program
  - vertex-ai
  - confidential
status: published
authorId: 00000000-0000-0000-0000-000000000000
version: 1.0
priority: critical
---

# Google Cloud Startup Program Application - Pixelated Empathy

Internal decision record and application worksheet for the **Google for Startups
Cloud Program**. Author: Chad Coburn. All program facts below were researched
from Google-published sources (startup.google.com/programs,
cloud.google.com/startup, the startup-program Terms of Service, and GCP billing
documentation) and verified against our live GCP state on **2026-10-22**. Facts
come only from that verified fact base; nothing here is estimated or invented.

## 1. Program Fit & Tier Selection

**Verdict: apply to the Start tier. It is the only tier we are currently
eligible for.**

### Start-tier benefits

- **$2,000** in Google Cloud credits.
- **$200** in Google Cloud Skills credits.
- **12 months of Google Workspace Business Plus.**

### Start-tier eligibility rules

- Founded within the last **24 months** - we satisfy this with room to spare
  (founded within the last 12 months as of 2026-10-22).
- A working MVP - satisfied; the clinician-training platform is live.
- A clear business model - satisfied (see Section 4 for the positioning we
  present).
- Plans to seek VC funding - we state this honestly: bootstrapped today, open
  to institutional rounds. This is a truthful forward-looking statement, not a
  claim of existing funding.
- Less than **$300** in prior trial-equivalent credits - a self-audit against
  our billing account is required before applying (Section 2).

### Why not Scale / Scale-AI

The Scale and Scale-AI tiers ($100K-$250K in year-one credits) require
**verifiable institutional funding** at the Pre-Seed through Series A level,
being founded within 5 years, and less than $5,000 in prior credits. Critically:

- A **SAFE from a known investor** qualifies as verifiable institutional
  funding. This is our documented path to Scale later.
- Angel or friends-and-family money does **not** qualify.
- An unfunded startup has **no published path** to Scale.

We are bootstrapped with no institutional funding, so Scale is out of reach
today. Applying for Scale now would fail verification and waste the
application. The honest sequence is: Start tier now; revisit Scale after an
institutional round closes.

## 2. Eligibility Checklist

Status as of 2026-10-22, against the Start-tier rules and application
prerequisites:

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 1 | Founded within 24 months | Done | Founded within the last 12 months. |
| 2 | Working MVP | Done | Clinician-training / supervision platform, live. |
| 3 | Clear business model | Done | Documented in the business-strategy series. |
| 4 | Plans to seek VC funding | Done (stated honestly) | Bootstrapped today; open to institutional rounds. |
| 5 | Less than $300 prior trial-equivalent credits | Open | Self-audit required against billing account `013214-CFE7B2-9F16D5` before submitting (Section 9, Action A1). |
| 6 | 18-character GCP billing account ID, owned/administered by a user on the company domain | Done | Account `013214-CFE7B2-9F16D5` ("My Billing Account", OPEN); administrator `chad@pixelatedempathy.com` is on the application domain. |
| 7 | Business email matching the website domain | Open | `pixelatedempathy.com` mail currently runs on Cloudflare Email Routing; the Google Workspace migration (Section 3) closes this. |
| 8 | Active website describing company, team, and product | Done | `pixelatedempathy.com` is live with company, product, and team pages; the team page names the founder, Chad Coburn. Google screens for AI-generated content and rejects high volumes of low-substance applications - our pages carry real substance (privacy ~15.3K, terms ~23.3K, full product and company sections). |

The billing account is linked to three projects, all created in mid-2026:
`gemcity-kick` (48388400806, created 2026-07-20), `one-moon-505501-u3`
(841537788053, "dearlydeparted", created 2026-08-04), and `handholder`
(479982736741, billing-disabled, created 2026-08-14). The self-audit in row 5
must confirm that total trial-equivalent credit consumption across this account
is under $300.

## 3. Company & Domain Alignment

Google verifies that the application, the domain, the email, the billing
account, and the website all describe the same company. Our state:

- **Application domain:** `pixelatedempathy.com` - the single domain used
  across every artifact in this application package.
- **Domain hosting:** the canonical marketing site runs Cloudflare in front of
  Vercel, live, with canonical sitemap/robots and all marketing pages present:
  index, about, company, features, team, demo-hub, plus privacy, terms, cookie,
  accessibility, and trust pages.
- **Email on the domain:** currently NOT on Google infrastructure. MX records
  point to Cloudflare Email Routing (`route*.mx.cloudflare.net`), SPF includes
  `_spf.mx.cloudflare.net`, and outbound mail flows through a Resend token. To
  satisfy the business-email prerequisite and unlock the Workspace Business
  Plus benefit, mail moves to Google Workspace. That migration is
  **user-executed** following the companion runbook
  (`google-workspace-email-migration-runbook.md`).
- **Workspace benefit condition:** no **paid** Workspace subscription may
  exist within **31 days** before applying. The migration must be sequenced
  accordingly - sign up for Workspace with the 31-day clean window in mind.
- **Billing account:** `013214-CFE7B2-9F16D5`, administered by
  `chad@pixelatedempathy.com` on the application domain.
- **Cloud Identity organization:** the org for `pixelatedempathy.com` already
  exists (org ID **334502034583**). No new org setup is needed.
- **Website substance:** company, team, and product pages are real content,
  not generated filler. The team page identifies the founder as **Chad
  Coburn**.

## 4. Healthcare Positioning & Regulated-Industry Risk

### The framing Google's review will meet

Pixelated Empathy is a **clinician-training / supervision platform with humans
in the loop**. It is **not a medical device** and **not direct-to-patient
care**. This framing is used consistently here and in the public compliance
addendum, and it is the truthful description of the product.

### Is a regulated-industry application barred?

No - but acceptance is discretionary, not guaranteed:

- The binding program Terms of Service contain **no regulated-industry
  exclusion**. The only activity requiring written consent is crypto-mining.
- The FAQ sentence about a "regulated industry or sector" is undefined
  **discretionary screening language**, not a prohibition.
- Google itself features a regulated health-insurance startup in its success
  stories and publishes a startups guide at health.google/startups-guide.

**Assessment (~75% confidence):** mental-health / clinical-AI is not
categorically excluded from the program, but the reviewer retains discretion.
We present the clinician-training framing plainly, document our compliance
posture publicly (the compliance addendum renders at
`/docs/compliance/google-cloud-gemini-usage`), and accept that the decision is
Google's.

### Conditions we accept if admitted

1. Sign the Google Cloud HIPAA BAA before any PHI touches GCP (Section 7).
2. Route all product Gemini usage through Vertex AI, the BAA-covered surface
   (Section 6).
3. Keep the product framed as clinician-training with humans in the loop.
4. No PHI in logs or metadata.

## 5. Unincorporated-Application Risk & Fallback

**Risk, stated plainly:** we are applying **before incorporation**. A reviewer
who sees no legal entity may classify the application as **personal content**
rather than a company application, which can lead to rejection or a request
that is impossible to satisfy from an unincorporated position.

**Honest-answer plan:** every form field gets a truthful answer with no
fabricated entity details. Where the form asks for legal entity status, we
answer that Pixelated Empathy is a pre-incorporation, founder-led venture
(sole-proprietor stage). We do not invent an entity name, registration number,
state, formation date, or funding history anywhere in the application. The
product, domain, team, and website are real and verifiable; the legal-entity
status is the one fact we cannot yet present, and we present its absence
honestly rather than papering over it.

**Fallback:** if the application is rejected or stalled on the
unincorporated-status grounds, we incorporate and **re-apply**. The Start tier
has no expiry on this plan: the 24-month founding window gives ample time for
an incorporate-and-reapply cycle. Re-applying after incorporation is the
documented fallback, not a failure state.

## 6. Google Cloud & Vertex AI Routing Decision

**Decision: all product Gemini usage runs through Vertex AI. Never the raw
Gemini API or AI Studio, for product work or anything PHI-adjacent.**

Reasons:

1. **BAA coverage.** Vertex AI is covered by the Google Cloud HIPAA BAA. The
   Gemini API / AI Studio is not BAA-covered, its additional terms prohibit
   clinical-practice and medical-advice uses, and no PHI is permitted on
   unpaid tiers. Product or PHI-adjacent usage there is disqualified twice
   over.
2. **Credits only route cleanly through Vertex AI.** As of **March 2026**,
   Gemini API / AI Studio billing moved to a separate **Prepay ledger** that
   the $300 free trial cannot pay. Program credits apply cleanly only via
   Vertex AI - routing through the API would strand our credits.
3. **Consistency with the public posture.** The compliance addendum at
   `/docs/compliance/google-cloud-gemini-usage` states the same rule publicly;
   this decision is its internal source.

### Credit coverage boundaries

- Credits cover **first-party GCP products on pay-as-you-go only**.
- No Marketplace or Model Garden third-party purchases.
- Workspace and Maps are separate benefits, not credit-covered.

## 7. HIPAA/BAA Sequencing

**Sequence: sign the Google Cloud HIPAA BAA before any PHI touches GCP. Not
after; before.** This is a hard gate, not a best practice.

Current state and steps:

1. **The repo already has the BAA machinery.** The `docs/` submodule carries
   `compliance/hipaa.mdx`, `baa-template.md`, and `baa-compliance-gate.md`
   (PIX-4428), and the admin UI at `apps/web/src/pages/admin/security/baa/`
   manages BAA templates, vendors, requirements, and verification.
2. **The vendor inventory is honest today.**
   `docs/enterprise/vendor-inventory.md` lists "Google Gemini pending BAA
   verification." This dossier does not contradict that: BAA verification is
   the required step that must complete before any GCP PHI use.
3. **On acceptance into the program:** execute the Google Cloud HIPAA BAA,
   complete the BAA verification step, and update the vendor inventory from
   "pending BAA verification" to verified for Google Cloud / Vertex AI.
4. **Only then** does any PHI-adjacent workload touch GCP, exclusively via
   Vertex AI per Section 6.
5. **No HITRUST claim exists** in our posture and none is added here or
   anywhere else in the application package.

## 8. Application Worksheet

Field-by-field plan for the Start-tier application form. Every answer is
truthful and consistent with the fact base and the public site.

| Form field | Honest answer | Supporting evidence |
| --- | --- | --- |
| Company name | Pixelated Empathy (pre-incorporation, founder-led) | Application domain and site |
| Legal entity status | Pre-incorporation / sole-proprietor stage - no entity details invented | This document, Section 5 |
| Website | `https://pixelatedempathy.com` | Live site with company, team, product pages |
| Business email | An address on `pixelatedempathy.com` (post-Workspace-migration) | Email migration runbook |
| Billing account ID | `013214-CFE7B2-9F16D5` | Verified live GCP state, 2026-10-22 |
| Cloud Organization / domain verification | `pixelatedempathy.com`, Cloud Identity org `334502034583` (already exists) | Verified live GCP state, 2026-10-22 |
| What the company does | Clinician-training / supervision platform with humans in the loop; not a medical device; not direct-to-patient | Site content; compliance addendum |
| Stage / MVP | Working MVP, live | Product pages, demo-hub |
| Business model | Documented subscription/pilot model for training institutions | Business-strategy series (internal) |
| Funding status | Bootstrapped; no institutional funding; plans to seek VC funding | This document, Sections 1 and 5 |
| Founded | Within the last 12 months (as of 2026-10-22) | Eligibility check, Section 2 |
| Prior Google Cloud credits | Under $300 trial-equivalent - confirm via self-audit before submitting | Action A1, Section 9 |
| AI usage on Google Cloud | Product Gemini via Vertex AI only; BAA signed before any PHI; no PHI via Gemini API / AI Studio; no PHI in logs or metadata | Sections 6 and 7; `/docs/compliance/google-cloud-gemini-usage` |
| Team | Chad Coburn, founder (product engineering, platform architecture, AI workflow design) | `/team` |

## 9. Open Actions & Owners

| # | Action | Owner | Status / notes |
| --- | --- | --- | --- |
| A1 | Prior-credits self-audit: confirm total trial-equivalent credit consumption on billing account `013214-CFE7B2-9F16D5` is under $300 | Chad Coburn (user) | Required before submission. |
| A2 | Sequence the Google Workspace signup/migration respecting the 31-day no-paid-Workspace rule, then complete the Cloudflare-to-Workspace email cutover | Chad Coburn (user) | Follow `google-workspace-email-migration-runbook.md`; user-executed. |
| A3 | Submit the Start-tier application via Google's form with the worksheet answers | Chad Coburn (user) | User-owned; agents prepare, never submit. |
| A4 | On acceptance: sign the Google Cloud HIPAA BAA and complete BAA verification before any PHI touches GCP; update the vendor inventory | Chad Coburn (user) | Hard gate per Section 7. |
| A5 | Enforce Vertex-AI-only routing for all product Gemini usage from day one | Chad Coburn (user) | Standing rule per Section 6. |
| A6 | If rejected on unincorporated grounds: incorporate, then re-apply | Chad Coburn (user) | Fallback per Section 5; 24-month window is ample. |
| A7 | After an institutional round (SAFE from a known investor): revisit the Scale tier | Chad Coburn (user) | Future path per Section 1. |

No GCP mutations, spend, or `gcloud` operations are performed by agents at any
point in this plan; every action above is user-executed.
