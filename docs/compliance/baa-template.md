# BAA Template — NIM on Hetzner
#
# Reference template for Business Associate Agreements covering AI inference
# services that process Protected Health Information (PHI) within Pixelated
# Empathy. Adapt with legal counsel before signing.

---

# BUSINESS ASSOCIATE AGREEMENT

This Business Associate Agreement ("**BAA**") is entered into by and between:

**Covered Entity:**
> Pixelated Empathy ("Covered Entity")
> [Legal Address]
> Represented by: [Name, Title]

**Business Associate:**
> [Business Associate Legal Name] ("Business Associate")
> [Legal Address]
> Represented by: [Name, Title]

**Effective Date:** [DATE]

---

## 1. Definitions

1.1. **PHI (Protected Health Information)** — As defined in 45 CFR §160.103,
meaning individually identifiable health information transmitted or maintained
in any form or medium, including demographic information.

1.2. **Breach** — As defined in 45 CFR §164.402, meaning the acquisition,
access, use, or disclosure of PHI not permitted under the Privacy Rule which
compromises the security or privacy of the PHI.

1.3. **Designated Record Set** — As defined in 45 CFR §164.501.

1.4. **Secretary** — The Secretary of the U.S. Department of Health and Human
Services ("HHS").

1.5. **Security Rule** — 45 CFR Part 164, Subpart C.

1.6. **Privacy Rule** — 45 CFR Part 164, Subpart E.

1.7. **Service Period** — The duration of the services agreement between the
parties under which PHI is created, received, maintained, or transmitted.

---

## 2. Permitted Uses and Disclosures

2.1. Business Associate shall not use or disclose PHI other than as permitted
or required by this BAA or as Required by Law.

2.2. Business Associate may use PHI only for the purpose of providing AI
inference services on behalf of Covered Entity, including:
   - Processing clinical notes, transcripts, and therapeutic session content
   - Generating AI-assisted clinical insights and recommendations
   - Operating NVIDIA NIM inference infrastructure

2.3. Business Associate shall not use PHI for any independent commercial
purpose, including:
   - Training or fine-tuning AI models on PHI without explicit written consent
   - Selling, licensing, or distributing PHI to third parties
   - Using PHI for the Business Associate's own marketing, research, or
     product development

2.4. Business Associate shall not disclose PHI to any subcontractor without
   the prior written consent of Covered Entity and a written agreement binding
   the subcontractor to the same restrictions and conditions.

---

## 3. Safeguards

3.1. Business Associate shall implement and maintain administrative, physical,
and technical safeguards that reasonably and appropriately protect the
confidentiality, integrity, and availability of PHI, in compliance with the
Security Rule (45 CFR §164.308–§164.312).

3.2. **Encryption Requirements:**

   | Layer | Standard | Minimum Configuration |
   |---|---|---|
   | Data in transit | TLS 1.3 | TLS 1.2 rejected; AEAD cipher suites only |
   | Data at rest (database) | AES-256-GCM | TDE or pgcrypto; KMS-managed keys |
   | Data at rest (volumes) | AES-256-XTS | LUKS2 full-disk encryption |
   | Key management | AES-256 | HSM-backed KMS; rotation every 90 days |

3.3. Business Associate shall ensure that all systems processing PHI meet or
exceed the encryption standards above.

3.4. Business Associate shall conduct an annual risk assessment and provide
the results to Covered Entity upon request.

---

## 4. Breach Notification

4.1. Business Associate shall notify Covered Entity of any Breach of
Unsecured PHI without unreasonable delay and **no later than 24 hours** after
discovery of the Breach.

4.2. Notification shall include:
   - The nature of the PHI involved (identifiers, elements)
   - The unauthorized person who used or received the PHI
   - What Business Associate is doing to investigate and mitigate the Breach
   - Steps individuals should take to protect themselves

4.3. Business Associate shall cooperate with Covered Entity in the
investigation and notification of the Breach, including notification to
affected individuals and HHS as required by 45 CFR §164.404–§164.410.

4.4. Business Associate shall report any use or disclosure of PHI not
permitted by this BAA within **10 business days** of discovery.

---

## 5. Subcontractors

5.1. Business Associate shall ensure that any subcontractor that creates,
receives, maintains, or transmits PHI on behalf of Business Associate agrees
to the same restrictions, conditions, and requirements that apply to Business
Associate under this BAA.

5.2. Business Associate remains liable for the acts and omissions of its
subcontractors to the same extent as if Business Associate had performed such
acts or omissions directly.

5.3. For the avoidance of doubt, if NVIDIA Corporation provides NIM model
services that process PHI, Business Associate shall obtain a subcontractor
BAA or written attestation from NVIDIA binding it to these terms.

---

## 6. Records and HHS Access

6.1. Business Associate shall make its internal practices, books, and records
relating to the use and disclosure of PHI available to the Secretary for the
purpose of determining compliance with the Privacy Rule.

6.2. Business Member shall make such records available within **10 business
days** of a request by the Secretary.

---

## 7. Termination

7.1. Upon termination of the Service Period, Business Associate shall return
or destroy all PHI received from, or created or received by Business Associate
on behalf of, Covered Entity.

7.2. If return or destruction is infeasible, Business Associate shall:
   - Provide certification to Covered Entity that return/destruction is infeasible
   - Extend the protections of this BAA to the PHI
   - Limit further uses and disclosures to those that make return or destruction infeasible

7.3. Covered Entity may terminate this BAA immediately upon written notice if
Business Associate breaches a material term of this BAA and fails to cure such
breach within **30 days** of written notice.

---

## 8. Data Retention and Disposition

8.1. Business Associate shall not retain PHI beyond the period necessary to
provide the services, except as Required by Law.

8.2. Upon termination, Business Associate shall securely delete or return all
PHI within **30 days**.

8.3. Secure deletion shall comply with NIST SP 800-88 (Purge level).

8.4. Business Associate shall provide written certification of destruction to
Covered Entity.

---

## 9. Indemnification

Business Associate shall indemnify and hold harmless Covered Entity from and
against any and all claims, damages, losses, and expenses (including
reasonable attorneys' fees) arising out of or resulting from Business
Associate's breach of this BAA or its violation of HIPAA.

---

## 10. Survival

The obligations of Business Associate under Sections 4 (Breach Notification),
7 (Termination), 8 (Data Retention), and 9 (Indemnification) shall survive
the termination of this BAA.

---

## 11. Miscellaneous

11.1. This BAA shall be governed by and construed in accordance with the laws
of the jurisdiction in which Covered Entity operates.

11.2. This BAA may be amended only by written agreement signed by both parties.

11.3. In the event of any conflict between this BAA and the underlying
services agreement, this BAA shall control with respect to PHI.

11.4. This BAA is binding upon the parties and their respective successors
and assigns.

11.5. This BAA shall terminate automatically upon the termination of the
underlying services agreement, except for provisions that by their nature
survive termination.

---

## Execution

| Party | Signature | Name | Date |
|---|---|---|---|
| **Covered Entity** (Pixelated Empathy) | _________________ | [Name, Title] | [Date] |
| **Business Associate** ([Entity]) | _________________ | [Name, Title] | [Date] |

---

## Appendix A — Covered Services

| Service | Description | PHI Processed |
|---|---|---|
| NIM Inference | NVIDIA NIM on Hetzner dedicated hosts | Yes — clinical notes, transcripts |
| Model Hosting | Containerized model serving | Yes — inference inputs/outputs |
| Logging | Inference audit logs | Yes — PHI-bearing |

## Appendix B — Renewal Cadence

| Item | Cadence |
|---|---|
| BAA contract review | Annually |
| BAA renewal | On contract expiry (typically 3 years) |
| Encryption key rotation | Every 90 days |
| Risk assessment | Annually |

---

*This template is provided as a reference starting point. It must be
reviewed and approved by qualified legal counsel before execution. It does
not constitute legal advice.*
