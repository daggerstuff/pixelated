# Vendor Decision Scoring Checklist

> **Use during scoping calls with:** Bishop Fox, Cobalt, Synack  
> **Part of:** PIX-4135 (S1: Pre-Engagement — Scope Definition & Vendor
> Selection)  
> **Sprint:** Sprint 6 (2026-07-28 → 2026-08-11)  
> **Owner:** [Security Lead]

Print one copy per vendor. Score each criterion 1–5 during or immediately after
the scoping call. Weighted total auto-calculates.

---

## Vendor Information

| Field                     | Notes |
| ------------------------- | ----- |
| **Vendor Name**           |       |
| **Contact Person**        |       |
| **Title**                 |       |
| **Email**                 |       |
| **Phone**                 |       |
| **Quoted Price**          |       |
| **Call Date**             |       |
| **Attendees (Pixelated)** |       |
| **Attendees (Vendor)**    |       |

---

## Section A: Technical Capabilities (40 pts max)

Score each item **1–5**:

| #   | Criterion                                                                                          | Weight | Score (1–5) | Weighted | Call Notes / Vendor Response |
| --- | -------------------------------------------------------------------------------------------------- | ------ | ----------- | -------- | ---------------------------- |
| A1  | **Web App Depth** — How do you approach multi-tenant SaaS logic testing? OWASP ASVS Level?         | 10     |             |          |                              |
| A2  | **API Testing** — REST + GraphQL coverage? Async/message queue testing? BOLA detection approach?   | 10     |             |          |                              |
| A3  | **Cloud/K8s Coverage** — IAM, K8s cluster hardening, serverless? Which providers?                  | 8      |             |          |                              |
| A4  | **AI/ML Pipeline** — Prompt injection testing? Model endpoint assessment? Training data isolation? | 7      |             |          |                              |
| A5  | **Mobile Coverage** — iOS + Android? Static analysis? Runtime manipulation? SSL pinning bypass?    | 5      |             |          |                              |
|     | **Subtotal**                                                                                       | **40** |             | **/200** |                              |

---

## Section B: Operational Fit (30 pts max)

| #   | Criterion                                                                                       | Weight | Score (1–5) | Weighted | Call Notes / Vendor Response |
| --- | ----------------------------------------------------------------------------------------------- | ------ | ----------- | -------- | ---------------------------- |
| B1  | **Timeline to Launch** — How quickly can testing begin after MSA signing?                       | 10     |             |          |                              |
| B2  | **Reporting Quality** — ASVS alignment? Developer-ready PoCs? Compliance mapping (SOC2, HIPAA)? | 8      |             |          |                              |
| B3  | **Retesting Policy** — Rounds included? Window? Continuous retesting available?                 | 7      |             |          |                              |
| B4  | **Communication** — Real-time critical alerts? Slack integration? Mid-engagement sync cadence?  | 5      |             |          |                              |
|     | **Subtotal**                                                                                    | **30** |             | **/150** |                              |

---

## Section C: Compliance & Trust (20 pts max)

| #   | Criterion                                                                      | Weight | Score (1–5) | Weighted | Call Notes / Vendor Response |
| --- | ------------------------------------------------------------------------------ | ------ | ----------- | -------- | ---------------------------- |
| C1  | **Certifications** — SOC 2 Type II? ISO 27001? CREST? FedRAMP? PCI QSA?        | 10     |             |          |                              |
| C2  | **Tester Credentials** — Minimum certs on every engagement? OSWE? OSCP? CISSP? | 5      |             |          |                              |
| C3  | **Data Handling** — HIPAA BA agreement? DPA? GDPR Art. 28? Data residency?     | 5      |             |          |                              |
|     | **Subtotal**                                                                   | **20** |             | **/100** |                              |

---

## Section D: Cost & Commercial (10 pts max)

| #   | Criterion                                                                         | Weight | Score (1–5) | Weighted | Call Notes / Vendor Response |
| --- | --------------------------------------------------------------------------------- | ------ | ----------- | -------- | ---------------------------- |
| D1  | **Pricing** — Fixed price or T&M? What's included vs extra? Credits expire?       | 5      |             |          |                              |
| D2  | **Value for Scope** — Does the quoted price align with scope depth? Hidden costs? | 5      |             |          |                              |
|     | **Subtotal**                                                                      | **10** |             | **/50**  |                              |

---

## Section E: Scoping Call Questions

### Technical Questions

1. **Scope methodology:** Walk us through how you'd test a multi-tenant SaaS app
   like ours. What's your first 48 hours look like?
2. **API depth:** Can you test both REST and GraphQL endpoints? How do you
   handle endpoint discovery?
3. **Cloud approach:** Which cloud providers do you test? Can you review
   Terraform/CloudFormation IaC templates?
4. **AI/ML:** Have you tested AI model pipelines? How do you approach prompt
   injection vs traditional OWASP testing?
5. **Mobile:** Can you work with our CI/CD build artifacts, or do you need
   production binaries?
6. **False positives:** What's your false positive rate? How do you validate
   findings before reporting?
7. **Exploit chaining:** Do you chain low-severity issues to demonstrate
   business impact, or report each finding independently?

### Operational Questions

8. **Timeline:** From signed MSA to kickoff — what's the realistic lead time?
   What delays you most?
9. **Resource assignment:** Do we get dedicated testers? Can we request the same
   team for retests?
10. **Report format:** Can you provide a sample report? Does it include
    developer-ready reproduction steps and compliance mappings?
11. **Remediation support:** After the report, can your team answer developer
    questions about findings?
12. **Retesting:** How many rounds are included? What's the typical turnaround
    for a retest?

### Compliance & Legal Questions

13. **Certifications:** Can you share your SOC 2 Type II report and penetration
    testing methodology certification?
14. **BA/DPA:** Can you sign a HIPAA Business Associate Agreement and GDPR Data
    Processing Addendum?
15. **Data residency:** Where is findings data stored? Can you guarantee EU data
    residency if needed?
16. **References:** Can you provide 2–3 references from SaaS companies of
    similar scale and complexity?

### Commercial Questions

17. **Pricing model:** Do you quote fixed price or T&M? What scope changes
    trigger a change order?
18. **Inclusions/exclusions:** Does your quote include retesting, executive
    summary, compliance mapping? What's extra?
19. **Payment terms:** Net 30? Net 60? Discount for annual commitment?
20. **Contract:** Do you have a standard MSA or do you accept our vendor MSA?

---

## Scorecard Summary

Transfer each section's weighted total from the tables above.

| Section                   | Weighted Score |
| ------------------------- | -------------- |
| A: Technical Capabilities | /200           |
| B: Operational Fit        | /150           |
| C: Compliance & Trust     | /100           |
| D: Cost & Commercial      | /50            |
| **Total**                 | **/500**       |

### Quick Reference: Score Interpretation

| Total Score | Rating                                      |
| ----------- | ------------------------------------------- |
| **400–500** | Strong fit — proceed to contract            |
| **300–399** | Acceptable — note gaps for negotiation      |
| **200–299** | Marginal — requires significant concessions |
| **<200**    | Weak fit — eliminate from consideration     |

---

## Final Comparison Grid (fill after all calls)

| Criterion                  | Bishop Fox | Cobalt | Synack |
| -------------------------- | ---------- | ------ | ------ |
| **A: Technical ( /200)**   |            |        |        |
| **B: Operational ( /150)** |            |        |        |
| **C: Compliance ( /100)**  |            |        |        |
| **D: Cost ( /50)**         |            |        |        |
| **Total ( /500)**          |            |        |        |
| **Quoted Price**           |            |        |        |
| **Contract Ready?**        |            |        |        |
| **Team Verdict**           |            |        |        |

---

## Decision Record

| Field                     | Value |
| ------------------------- | ----- |
| **Selected Vendor**       |       |
| **Rationale**             |       |
| **Engagement Start Date** |       |
| **Contract Value**        |       |
| **Approved By**           |       |
| **Approval Date**         |       |
| **Next Review Date**      |       |

---

## Post-Call Action Items

| #   | Action                             | Owner | Due Date |
| --- | ---------------------------------- | ----- | -------- |
| 1   |                                    |       |          |
| 2   |                                    |       |          |
| 3   |                                    |       |          |
| 4   | Send follow-up questions to vendor |       |          |
| 5   | Share notes with evaluation team   |       |          |

---

_Template version: 1.0 | Generated: 2026-07-29_
