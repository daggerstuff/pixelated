---
title: SLA Contract Terms
description:
  Customer-facing Service Level Agreement terms for Pixelated Empathy platform
  subscriptions, including uptime guarantees, service credits, breach
  notification commitments, and support response times.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# SLA Contract Terms

**Pixelated Empathy Platform — Service Level Agreement**

Version 1.0 · Effective Date: _[to be set upon first enterprise contract
execution]_

</div>

---

## 1. Definitions

| Term                                | Definition                                                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer**                        | The legal entity that has executed a Master Service Agreement (MSA) or subscription order referencing these SLA Terms.                                                                                   |
| **Pixelated**, **Provider**, **we** | Pixelated Empathy, Inc. ("Pixelated"), the provider of the Platform.                                                                                                                                     |
| **Platform**                        | The Pixelated Empathy clinical AI training platform, comprising the web application, AI inference service, and supporting APIs, accessed via `pixelatedempathy.com` or a Customer-specific subdomain.    |
| **Service**                         | Any individually identifiable component of the Platform offered to the Customer under the applicable plan, as listed in Section 3.                                                                       |
| **Subscription Plan**               | The Customer's active plan tier (Free, Pro, Enterprise, or Enterprise+ HIPAA), as defined in the applicable order form or MSA.                                                                           |
| **Billing Month**                   | A calendar month for which the Customer is invoiced for the Subscription Plan.                                                                                                                           |
| **Uptime**                          | The percentage of total minutes in a Billing Month during which the Platform is operational and accessible by the Customer, excluding Downtime as defined in Section 6.                                  |
| **Downtime**                        | Any period during which the Customer is unable to access the Platform due to a failure in Provider-operated infrastructure, as measured from the opening of a Provider-confirmed incident to resolution. |
| **Latency**                         | The 95th percentile response time for successful (HTTP 2xx) requests to the Platform API, measured from the Provider's edge proxy over the Billing Month.                                                |
| **Error Rate**                      | The percentage of HTTP 5xx responses returned by the Platform API relative to total requests, measured at the Provider's edge proxy over the Billing Month.                                              |
| **Service Credit**                  | A credit, expressed as a percentage of the monthly Subscription fee, applied to the Customer's next invoice in accordance with Section 5.                                                                |
| **Incident**                        | Any event causing or likely to cause Downtime, increased Error Rate, or Latency above the committed SLA threshold.                                                                                       |
| **Maintenance Window**              | A scheduled period of Platform unavailability announced in accordance with Section 6.2.                                                                                                                  |
| **PHI**                             | Protected Health Information as defined under 45 CFR § 160.103.                                                                                                                                          |
| **BAA**                             | Business Associate Agreement as required under 45 CFR §§ 164.308, 164.314, and 164.502(e).                                                                                                               |

---

## 2. Agreement Structure

These SLA Contract Terms ("SLA Terms") are incorporated by reference into the
Customer's Master Service Agreement or subscription order. In the event of a
conflict between these SLA Terms and the MSA, the MSA governs except where the
MSA expressly defers to these SLA Terms. The Customer's Subscription Plan
determines which SLA commitments apply, as set forth in Section 4.

### 2.1 Modification of SLA Terms

Provider may modify these SLA Terms upon thirty (30) days' written notice to the
Customer. Any modification that reduces the Uptime commitment, increases the
response time for support, or reduces Service Credits for the Customer's
then-current Subscription Plan shall not take effect until the Customer's next
renewal term, unless the Customer consents in writing. Provider may increase SLA
commitments at any time without prior notice.

### 2.2 Precedence

Where these SLA Terms reference an operational runbook or internal procedure
document (e.g., the SLO Definitions Runbook, SLA Breach Response Runbook), those
documents describe internal processes and do not create Customer-facing
obligations beyond those stated in these SLA Terms.

---

## 3. Covered Services

The following services are covered by these SLA Terms. Service availability is
measured independently for each service from the Provider's edge proxy.

| Service                  | Description                                                | Availability Scope                                |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------- |
| **Web Application**      | The Pixelated Empathy web interface (Astro SSR)            | All authenticated pages and API routes            |
| **AI Inference Service** | The cognitive AI engine (FastAPI) for emotional analysis   | All documented `/api/ai/*` endpoints              |
| **Authentication**       | The user authentication and session management subsystem   | Login, token refresh, and session validation      |
| **Data Persistence**     | The primary database (PostgreSQL) for Customer data        | Read and write operations on Customer-scoped data |
| **Cache Layer**          | The Redis cache for session and transient data             | Cache read/write operations                       |
| **Memory Service**       | The Foresight MCP memory service for cross-session context | Memory read/write operations via MCP protocol     |

Services not listed above (e.g., monitoring dashboards, administrative consoles,
API documentation sites) are provided on a best-effort basis and are not covered
by Uptime or Latency commitments.

---

## 4. SLA Commitments by Subscription Plan

### 4.1 Uptime Commitment

Provider commits to the following monthly Uptime percentages for the covered
Services:

| Subscription Plan     | Monthly Uptime SLA | Annualized Uptime |
| --------------------- | ------------------ | ----------------- |
| **Free**              | 99.0%              | 99.0%             |
| **Pro**               | 99.5%              | 99.5%             |
| **Enterprise**        | 99.9%              | 99.9%             |
| **Enterprise+ HIPAA** | 99.95%             | 99.95%            |

Uptime is measured per the methodology in Section 7. A Billing Month is
considered in compliance if the measured Uptime meets or exceeds the applicable
percentage.

### 4.2 Latency Commitment

Provider commits to the following 95th percentile response time for successful
(2xx) requests to the Web Application and AI Inference Service:

| Subscription Plan     | Web Application (p95) | AI Inference (p95) |
| --------------------- | --------------------- | ------------------ |
| **Free**              | 1,000 ms              | 5,000 ms           |
| **Pro**               | 750 ms                | 3,000 ms           |
| **Enterprise**        | 500 ms                | 2,000 ms           |
| **Enterprise+ HIPAA** | 500 ms                | 2,000 ms           |

Latency is measured at the Provider's edge proxy over the Billing Month for
requests that return HTTP 2xx status codes. The AI Inference latency commitment
applies to documented synchronous inference endpoints only; asynchronous batch
processing is excluded.

### 4.3 Support Response Time Commitment

Provider commits to the following initial response times for Customer support
requests submitted through the designated support channel:

| Subscription Plan     | Severity        | Response Time    | Support Channel                          |
| --------------------- | --------------- | ---------------- | ---------------------------------------- |
| **Free**              | All severities  | Best-effort      | Community forum                          |
| **Pro**               | Critical        | 4 business hours | Email (support@)                         |
| **Pro**               | Non-critical    | 1 business day   | Email (support@)                         |
| **Enterprise**        | Critical (24/7) | 1 business hour  | Email + phone + dedicated support portal |
| **Enterprise**        | Non-critical    | 4 business hours | Email + dedicated support portal         |
| **Enterprise+ HIPAA** | Critical (24/7) | 1 hour           | Email + phone + dedicated SE             |
| **Enterprise+ HIPAA** | Non-critical    | 2 business hours | Email + phone + dedicated SE             |

**Severity definitions:**

- **Critical**: The Platform is inaccessible, or a core feature is
  non-functional for the Customer's end users.
- **Non-critical**: The Platform is accessible but a feature is degraded, or the
  Customer has a question or configuration request.

### 4.4 Breach Notification Commitment

Provider commits to the following breach notification timelines:

| Subscription Plan     | Notification Trigger                        | Notification Deadline | Method                                        |
| --------------------- | ------------------------------------------- | --------------------- | --------------------------------------------- |
| **Free**              | Any confirmed security incident             | 30 days               | Email to technical contact                    |
| **Pro**               | Any confirmed security incident             | 7 days                | Email to technical contact                    |
| **Enterprise**        | Confirmed security incident or SLA breach   | 48 hours              | Email + phone to account contact              |
| **Enterprise+ HIPAA** | Confirmed security incident or SLA breach   | 24 hours              | Email + phone to account + compliance contact |
| **Enterprise+ HIPAA** | Confirmed or suspected PHI breach (per BAA) | Per BAA terms         | Per BAA notification procedure                |

"Breach" for notification purposes means (a) a confirmed security incident
involving unauthorized access to Customer Data, or (b) an SLA breach as defined
in Section 5. The notification deadline is measured from the time Provider
confirms the breach, not from the time the incident began.

### 4.5 Data Processing Addendum (HIPAA Tier Only)

For Enterprise+ HIPAA customers, the following additional commitments apply:

1. **BAA execution**: A Business Associate Agreement is executed prior to
   processing any PHI and remains in effect for the duration of data processing.
2. **Data residency**: PHI is stored and processed in Provider infrastructure
   located in the United States. No PHI is transferred to or processed in
   jurisdictions outside the United States.
3. **Encryption**: PHI is encrypted at rest using AES-256 and in transit using
   TLS 1.2 or higher.
4. **Access controls**: Access to PHI is restricted to authorized workforce
   members who have completed HIPAA training, logged via role-based access
   controls, and reviewed quarterly.
5. **Audit logging**: All access to PHI is logged and retained for a minimum of
   six (6) years per 45 CFR § 164.316(b)(2).
6. **Breach notification**: Provider follows the breach notification timelines
   specified in the BAA, which shall not exceed the timelines required by 45 CFR
   §§ 164.410–414.

---

## 5. Service Credits

### 5.1 Eligibility

Service Credits are available to Pro, Enterprise, and Enterprise+ HIPAA
customers only. Free-tier customers are not entitled to Service Credits. A
Service Credit is a percentage of the monthly Subscription fee for the affected
Service, applied as a credit to the Customer's next invoice. Service Credits are
not refunds and are not payable in cash.

### 5.2 Credit Calculation

If the measured Uptime for a Billing Month falls below the applicable SLA
commitment, the Customer is entitled to the following Service Credit:

| Measured Monthly Uptime | Pro Credit | Enterprise Credit | Enterprise+ HIPAA Credit                              |
| ----------------------- | ---------- | ----------------- | ----------------------------------------------------- |
| Below SLA but ≥ 99.0%   | 10%        | 10%               | 10%                                                   |
| Below 99.0% but ≥ 98.0% | 25%        | 25%               | 25% + written incident review                         |
| Below 98.0% but ≥ 95.0% | 50%        | 50%               | 50% + written incident review                         |
| Below 95.0%             | 100%       | 100%              | 100% + written incident review + escalation to VP Eng |

If the measured Latency for a Billing Month exceeds the applicable SLA
commitment, the Customer is entitled to a Service Credit of 10% of the monthly
Subscription fee for the affected Service. Latency and Uptime credits are not
stacked; the Customer receives the higher of the two applicable credits.

### 5.3 Claim Procedure

To receive a Service Credit, the Customer must submit a claim to
`support@pixelatedempathy.com` within thirty (30) days of the end of the Billing
Month in which the SLA breach occurred. The claim must include:

1. The Customer's account name and Subscription Plan.
2. The affected Service(s).
3. The Billing Month in question.
4. A brief description of the observed impact (e.g., inaccessible Platform,
   elevated error rates), including timestamps if available.

Provider will validate the claim against its monitoring data within ten (10)
business days. If Provider confirms the breach, the Service Credit will be
applied to the Customer's next invoice. If Provider disputes the claim, Provider
will provide a written explanation referencing its monitoring data.

### 5.4 Maximum Credits

The aggregate Service Credits payable to a Customer in any Billing Month shall
not exceed one hundred percent (100%) of the monthly Subscription fee. Service
Credits are the Customer's sole and exclusive remedy for SLA breaches, and are
in lieu of any other claim for damages or equitable relief arising from
unavailability of the Platform, except as provided in the MSA.

### 5.5 Written Incident Review (Enterprise+ HIPAA)

For Enterprise+ HIPAA customers, any SLA breach entitles the Customer to a
written incident review document, delivered to the Customer's compliance contact
within five (5) business days, containing:

1. Incident summary and root cause analysis.
2. Timeline of events (detection, mitigation, resolution).
3. Error budget impact.
4. Remediation actions taken and planned.
5. Reference to the postmortem document (confidential, shared under NDA).

---

## 6. Exclusions

The following do not count as Downtime or SLA breaches and do not entitle the
Customer to Service Credits:

### 6.1 Customer-Side Issues

- Failures of the Customer's network, internet service provider, or equipment.
- Customer misconfiguration, including but not limited to: incorrect API
  credentials, malformed requests, invalid authentication tokens, or use of the
  Platform outside documented specifications.
- Rate-limit responses (HTTP 429) returned when the Customer exceeds their
  plan's request quota or concurrent session limit.
- Customer failure to maintain compatibility with documented API versions after
  a deprecation notice period has expired.

### 6.2 Scheduled Maintenance

- Scheduled maintenance announced at least seventy-two (72) hours in advance via
  the Customer's notification channel (email or status page).
- Maintenance is limited to a maximum of two (2) hours per month for Enterprise
  and Enterprise+ HIPAA plans, and four (4) hours per month for Pro plans.
  Maintenance beyond these limits counts as Downtime.
- Emergency security patches may be applied with six (6) hours' notice and do
  not count toward the monthly maintenance limit; emergency patches exceeding
  thirty (30) minutes of Platform unavailability count as Downtime.

### 6.3 Force Majeure

- Acts of God (earthquake, flood, hurricane, fire).
- Government actions, civil unrest, war, or terrorism.
- Failure of underlying cloud or infrastructure providers beyond Provider's
  reasonable control, including but not limited to: hyperscaler regional
  outages, CDN failures, DNS provider outages, or upstream network failures
  affecting the Provider's edge.

### 6.4 Third-Party Dependencies

- Failures of third-party services that the Customer has integrated with the
  Platform, where the failure originates in the third-party service and not in
  Provider-operated infrastructure. This includes but is not limited to: the
  Customer's identity provider, payment processor, or external API integrations.
- This exclusion does not apply to Provider-selected dependencies that are
  integral to the Platform's core functionality (e.g., Provider's primary
  database, cache). Provider remains responsible for the availability of its own
  infrastructure dependencies.

### 6.5 Beta and Pre-GA Features

- Features or services designated as "beta," "preview," "experimental," or
  otherwise not generally available are not covered by any SLA commitment.

### 6.6 Customer-Initiated Downtime

- Downtime caused by Customer-initiated actions, including but not limited to:
  account suspension for non-payment, Customer-requested data migration, or
  Customer-initiated API rate limit increases that temporarily degrade
  performance.

---

## 7. Measurement Methodology

### 7.1 Uptime Measurement

Uptime is calculated as follows:

```
Uptime % = ((Total Minutes in Billing Month - Downtime Minutes) / Total Minutes in Billing Month) × 100
```

**Total Minutes** is the total number of minutes in the Billing Month, minus
excluded Maintenance Window minutes (per Section 6.2).

**Downtime Minutes** is the sum of all minutes during which the Platform was
inaccessible to the Customer due to Provider-confirmed incidents. Downtime is
measured from the moment Provider confirms an incident (either via automated
monitoring or Customer report) to the moment the Platform is restored to
operational status.

Partial unavailability (one Service down, others operational) is calculated
proportionally. If the Web Application is down but the AI Inference Service
remains operational, the Customer receives Downtime minutes for the Web
Application only, weighted by the fraction of total covered Services affected.

### 7.2 Latency Measurement

Latency is measured at the 95th percentile of successful (HTTP 2xx) response
times for requests to the documented Platform API, recorded at the Provider's
edge proxy (Caddy) over the Billing Month. Requests that return 4xx or 5xx
responses are excluded from the latency calculation. The 95th percentile is
calculated from the full population of requests in the Billing Month, not from a
sample.

### 7.3 Error Rate Measurement

Error Rate is the percentage of HTTP 5xx responses returned by the Platform API
relative to total requests, measured at the edge proxy over the Billing Month.
HTTP 4xx responses (client errors) are not counted as errors for SLA purposes.

### 7.4 Monitoring Data Authority

Provider's monitoring data (Prometheus metrics recorded at the edge proxy) is
the authoritative source for SLA measurement. Customer-provided monitoring data
may be used to support a Service Credit claim but does not override Provider's
monitoring data unless Provider's monitoring was itself non-operational during
the disputed period, in which case the Customer's data is used and the disputed
period counts as Downtime.

### 7.5 Data Availability

Provider retains monitoring data for a minimum of ninety (90) days. Monitoring
data older than ninety (90) days may be aggregated and is not available for
individual request-level inspection. Service Credit claims must be submitted
within thirty (30) days of the Billing Month end, per Section 5.3.

---

## 8. Support and Incident Management

### 8.1 Support Channels

| Subscription Plan     | Support Channel                                           |
| --------------------- | --------------------------------------------------------- |
| **Free**              | Community forum at `community.pixelatedempathy.com`       |
| **Pro**               | Email: `support@pixelatedempathy.com`                     |
| **Enterprise**        | Email + dedicated support portal + phone (business hours) |
| **Enterprise+ HIPAA** | Email + phone (24/7) + dedicated Solutions Engineer (SE)  |

### 8.2 Incident Severity and Escalation

Customers may escalate incidents as follows:

1. **Initial contact**: Submit a support request through the Customer's
   designated channel, including the affected Service, a description of the
   impact, and a severity assessment (Critical or Non-critical).
2. **Response confirmation**: Provider acknowledges the request within the
   response time commitment in Section 4.3 and confirms or adjusts the severity.
3. **Escalation path**:
   - If the response time commitment is not met, the Customer may escalate to
     `escalations@pixelatedempathy.com`.
   - If an incident remains unresolved beyond the mitigation target (Critical:
     30 minutes; Non-critical: 2 business hours), the Customer may request
     escalation to the Provider's Director of Engineering.
   - For Enterprise+ HIPAA customers, unresolved Critical incidents beyond 1
     hour may be escalated to the Provider's VP of Engineering directly.

### 8.3 Status Page

Provider maintains a public status page at `status.pixelatedempathy.com` (or a
Customer-specific status page for Enterprise+ HIPAA customers) showing real-time
and historical Platform availability. Customer-initiated status page
subscriptions (email, SMS, Slack) are available at no charge.

### 8.4 Proactive Notification

Provider will proactively notify Customers of incidents that may affect SLA
compliance as follows:

| Severity                         | Notification Target                      | Method                               |
| -------------------------------- | ---------------------------------------- | ------------------------------------ |
| Warning (SLO at risk)            | Status page                              | Automatic status page update         |
| Critical (SLA breach)            | Status page + Customer technical contact | Email + status page update           |
| Emergency (multi-service outage) | Status page + all Customer contacts      | Email + status page + direct contact |

---

## 9. Limitations

### 9.1 SLA Exclusions Are Absolute

The exclusions in Section 6 are absolute and apply regardless of the cause or
duration of the excluded event. Provider has no obligation to provide Service
Credits for periods excluded under Section 6.

### 9.2 Sole Remedy

Service Credits are the Customer's sole and exclusive remedy, and Provider's
sole and exclusive liability, for any failure to meet the SLA commitments in
Section 4. This limitation does not apply to: (a) Provider's breach of
confidentiality obligations, (b) Provider's breach of the BAA (for HIPAA-tier
customers), or (c) Provider's gross negligence or willful misconduct, as
provided in the MSA.

### 9.3 No Consequential Damages

In no event shall Provider be liable for any indirect, incidental,
consequential, special, or punitive damages, or for any lost profits or revenue,
arising from or related to the SLA or the Platform's availability, even if
Provider has been advised of the possibility of such damages. This limitation is
subject to any conflicting provision in the MSA.

### 9.4 Credit Cap

The aggregate Service Credits payable in any Billing Month shall not exceed 100%
of the monthly Subscription fee. Service Credits do not carry over between
Billing Months and are not refundable or transferable.

---

## 10. HIPAA Addendum

This Section 10 applies only to Enterprise+ HIPAA customers and supplements (not
replaces) the BAA executed between Provider and Customer.

### 10.1 PHI Safeguards

Provider implements the following safeguards for Customer PHI:

1. **Administrative**: Workforce HIPAA training (annual), designated privacy and
   security officers, access review (quarterly), incident response plan.
2. **Physical**: Datacenter access controls managed by cloud provider (SOC 2
   Type II certified facilities), no on-premises PHI storage.
3. **Technical**: AES-256 at-rest encryption, TLS 1.2+ in-transit encryption,
   role-based access control, audit logging (6-year retention), network
   segmentation, automated vulnerability scanning, annual penetration testing.

### 10.2 Subcontractors

Provider uses subcontractors who may access PHI. A current list of
subcontractors with PHI access is maintained in the Provider's HIPAA compliance
documentation and provided to the Customer upon request. All subcontractors have
executed BAAs with Provider as required by 45 CFR § 164.308(b)(2).

### 10.3 Breach Notification (HIPAA)

In the event of a confirmed or suspected breach of unsecured PHI, Provider will
notify the Customer in accordance with the BAA and 45 CFR § 164.410. The
notification deadline shall not exceed sixty (60) days from discovery of the
breach, consistent with the HHS Breach Notification Rule. Provider will provide
the Customer with all information reasonably necessary for the Customer to
comply with its own breach notification obligations under 45 CFR § 164.404.

### 10.4 Audit Rights

The Customer has the right, upon thirty (30) days' written notice and no more
than once per calendar year, to audit Provider's compliance with these SLA Terms
and the BAA, at the Customer's expense. The audit will be conducted during
business hours and will not unreasonably interfere with Provider's operations.
The Customer may use a third-party auditor provided the auditor has executed a
confidentiality agreement with Provider.

### 10.5 Termination and Data Return

Upon termination of the Subscription, Provider will return or destroy all PHI in
accordance with 45 CFR § 164.500(d)(2) and the BAA. Data return is completed
within thirty (30) days of termination, and a certificate of destruction is
provided within sixty (60) days.

---

## 11. Glossary

| Term               | Definition                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **BAA**            | Business Associate Agreement under HIPAA.                                                      |
| **Billing Month**  | The calendar month for which the Customer is invoiced.                                         |
| **Critical**       | The highest support severity: Platform inaccessible or core feature non-functional.            |
| **Downtime**       | Period of Platform unavailability due to Provider-confirmed incident, excluding Section 6.     |
| **Edge Proxy**     | The Provider's reverse proxy (Caddy) through which all Customer requests pass.                 |
| **MSA**            | Master Service Agreement between Provider and Customer.                                        |
| **p95**            | The 95th percentile: 95% of requests complete within this time.                                |
| **PHI**            | Protected Health Information as defined under 45 CFR § 160.103.                                |
| **Service Credit** | A credit applied to the Customer's next invoice, expressed as a percentage of the monthly fee. |
| **SLA**            | Service Level Agreement — the commitments in these SLA Terms.                                  |
| **SLO**            | Service Level Objective — internal target that exceeds the SLA to provide error-budget buffer. |
| **Uptime**         | Percentage of total Billing Month minutes the Platform is operational, excluding Downtime.     |

---

## 12. References

- **Internal documents**:
  - SLO Definitions Runbook — `docs/enterprise/runbooks/slo-definitions.md`
  - SLA Breach Response Runbook —
    `docs/enterprise/runbooks/sla-breach-response.md`
  - DR RTO/RPO Targets — `docs/enterprise/runbooks/dr-rto-rpo-targets.md`
  - Vendor Inventory — `docs/enterprise/vendor-inventory.md`
  - HIPAA Compliance — `docs/compliance/hipaa.mdx`
  - Security Overview — `docs/compliance/security.mdx`
- **Monitoring configuration**:
  - Prometheus — `monitoring/prometheus.yml`
  - Alertmanager — `monitoring/alertmanager.yml`
  - SLO recording rules — `monitoring/slo-recording-rules.yml`
  - SLO burn rate alerts — `monitoring/slo-burn-rate-alerts.yml`
- **External standards**:
  - HHS Breach Notification Rule — 45 CFR §§ 164.400–414
  - HIPAA Security Rule — 45 CFR §§ 164.308, 164.312, 164.314
  - Google SRE Workbook — Service Level Objectives chapter
- **Linear**:
  - PIX-4146 — SLA-3: Draft Customer SLA Contract Terms
  - PIX-4127 — Enterprise Gap: SLA/SLO Definitions & Error Budgets (parent epic)
- **GitHub**: <https://github.com/daggerstuff/pixelated/issues/5081>

---

_These SLA Terms are provided for informational purposes as a draft. The final
executed SLA Terms are incorporated into the Customer's Master Service Agreement
and may differ. For questions regarding these terms, contact
`legal@pixelatedempathy.com`._
