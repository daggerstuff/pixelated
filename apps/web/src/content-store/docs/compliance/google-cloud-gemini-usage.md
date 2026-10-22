---
description: How Pixelated Empathy uses Google Cloud and Gemini under HIPAA-aligned controls
title: Google Cloud and Gemini Usage Policy
pubDate: '2026-10-22'
---

# Google Cloud and Gemini Usage Policy

This document describes how Pixelated Empathy uses Google Cloud and Gemini in a
HIPAA-scoped clinical environment. It is written as policy and engineering
guidance for our team and as a public statement of our controls for customers,
auditors, and partners.

Pixelated Empathy is a clinician-training and supervision platform. AI supports
training scenarios, feedback, and supervision review; licensed professionals
remain in the loop for every clinical decision. The product is not a medical
device and is not direct-to-patient care.

## 1. Binding Rules for Gemini Usage

Three rules are binding on all product engineering and research work. They are
not defaults that can be overridden without compliance review.

1. **Vertex AI only.** All product and PHI-adjacent Gemini usage goes through
   Vertex AI on Google Cloud. Vertex AI is the only Gemini surface that can be
   covered by a Google Cloud Business Associate Agreement (BAA).
2. **BAA before PHI.** A Google Cloud HIPAA BAA must be signed and in force
   before any PHI touches GCP in any form. No exception applies to
   experiments, staging environments, or "temporary" evaluations.
3. **No PHI outside the BAA perimeter.** No PHI is sent through the Gemini API
   or AI Studio, and no PHI is placed in logs, request metadata, labels, or
   other ancillary fields on any Google surface.

## 2. Why Vertex AI

Vertex AI is the sanctioned route for product and PHI-adjacent Gemini work
because it is the only Gemini surface that can sit inside a Google Cloud HIPAA
BAA. The standalone Gemini API and AI Studio are not BAA-covered, and their
additional terms restrict clinical practice and medical-advice uses, which is
incompatible with AI-assisted clinical training workflows. Unpaid tiers of the
standalone Gemini API carry no PHI protections at all.

Routing product usage through Vertex AI also keeps Gemini inside the same
governance perimeter as the rest of our cloud work: Google Cloud project
controls, key management, audit logging, and our BAA vendor program.

## 3. Gemini API and AI Studio

The standalone Gemini API and AI Studio are out of bounds for product features
and for anything PHI-adjacent:

- [ ] Never connect product functionality to the Gemini API or AI Studio
- [ ] Never send PHI, or data derived from PHI, through the Gemini API or AI
      Studio, on any tier
- [ ] Use synthetic or de-identified data only for evaluation and prototyping
      outside Vertex AI
- [ ] Route any team member who needs Gemini for product work to Vertex AI

## 4. BAA Sequencing and Vendor Governance

Google Cloud is managed within our existing BAA vendor program, which tracks
providers, agreements, and verification status. A provider is not cleared for
PHI until its BAA is executed and verification completes.

- [ ] Execute the Google Cloud HIPAA BAA before any PHI touches GCP
- [ ] Record the executed BAA in our vendor inventory and complete BAA
      verification for Google Gemini before enabling any PHI-adjacent workload
- [ ] Review BAA scope against the services actually used (for example, Vertex
      AI and storage), not just the account level
- [ ] Re-verify on material changes to the provider's terms or our usage

Until the BAA is executed and verified, no PHI may flow to any Google service.

## 5. Logs, Metadata, and Data Minimization

Rule 3 extends beyond request payloads. PHI must never reach Google surfaces
through side channels:

- [ ] Verify that prompts and payloads sent to Vertex AI contain no PHI
      (de-identified or synthetic data wherever feasible)
- [ ] Keep PHI out of logs, request metadata, labels, and user-defined fields
- [ ] Design prompts to minimize the inclusion of sensitive information
- [ ] Review audit logs periodically to confirm no PHI leakage into Google
      service logs or our own
- [ ] Confirm logging and retention settings never store prompt content
      containing PHI

## 6. Billing and Program Credits

Google for Startups program credits apply to eligible first-party Google Cloud
products on pay-as-you-go billing, and they apply cleanly through **Vertex AI
billing**. The standalone Gemini API and AI Studio moved to a separate Prepay
ledger in March 2026, which free trial credits cannot pay and which program
credits are not designed to cover. This is one more reason all product Gemini
usage stays on Vertex AI.

Program credits do not extend to third-party Marketplace or Model Garden
offerings, and Workspace or Maps benefits are administered separately.

## 7. Questions

Questions about this policy, our BAA program, or Google Cloud usage can be
directed to [info@pixelatedempathy.com](mailto:info@pixelatedempathy.com).

## Related Documentation

- [HIPAA Compliance Verification Checklist for AI Components](/docs/compliance/hipaa-ai-verification)
- [Security Overview](/docs/security/overview)
