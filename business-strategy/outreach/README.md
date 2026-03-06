# Outreach and pilot tracking

This folder holds templates, proposals, and trackers for institutional pilot outreach.

## Pipeline stages

Use these stages in both **pilot-tracking.csv** and **basic-crm-tracker.csv** so
status is consistent.

| Stage | Description |
| --- | --- |
| Lead | Identified contact; not yet contacted |
| Email Sent | Initial or follow-up email sent; awaiting response |
| Meeting Scheduled | Meeting or call scheduled |
| Proposal Sent | Pilot proposal or agreement sent |
| Negotiation | In discussion (terms, scope, timeline) |
| Closed Won | Pilot agreed; contract signed or verbal commit |
| Closed Lost | Declined or no response after follow-ups |

**Progression:** Lead → Email Sent → Meeting Scheduled → Proposal Sent → Negotiation
→ Closed Won (or Closed Lost).

## Trackers

### pilot-tracking.csv

- **Status:** Legacy field; keep for backward compatibility (e.g. "Email Sent",
  "Pending Response").
- **Pipeline Stage:** Set to one of the stages above. Update when the opportunity
  moves.
- **Follow-up Date:** When to follow up if no response.
- Update the CSV when you send emails, schedule meetings, send proposals, or
  close.

### basic-crm-tracker.csv

- **Status:** Use the same pipeline stage values as above (or keep in sync with
  Pipeline Stage if we add that column).
- **Contract Sent / Contract Signed / Program Start / Program End:** Fill when
  applicable for Closed Won pilots.

## How to update

1. Open the CSV in a spreadsheet or editor.
2. Set **Pipeline Stage** (and **Status** where used) to the current stage.
3. Fill **Response Date**, **Meeting Date**, **Proposal Sent Date** when those
   events happen.
4. Save and commit so the team has one source of truth.

## Templates

- [stanford-pilot-proposal.md](stanford-pilot-proposal.md) – Example
  institutional proposal
- [simple-pilot-contract.md](simple-pilot-contract.md) – Short contract outline
- [pilot-agreement-template.md](pilot-agreement-template.md) – Agreement checklist
- [follow-up-emails.md](follow-up-emails.md) and
  [follow-up-templates.md](follow-up-templates.md) – Follow-up sequences
