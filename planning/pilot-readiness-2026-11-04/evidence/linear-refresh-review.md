# Linear issue snapshot refresh — 2026-11-04

## Read method and coverage

Authenticated directly to Linear GraphQL using the existing `LINEAR_API_KEY`
from the project `.env`, read in memory only. No browser was opened. The
read-only query requested PIX team issue metadata, included archived issues,
and fetched no descriptions, comments, attachments or other issue bodies. No
Linear mutations were made. The credential value was not printed or written to
any artifact.

- Pages: **11**, 100 issues per full page; terminal page returned 89.
- Retrieved records: **1,089**; every record has an issue identifier and
  workflow status.
- Archived records: **679** (`archivedAt` is retained in the CSV).
- Workflow state types: **798 completed**, **253 canceled**, **22 backlog**,
  **12 triage**, **4 started**.
- Pagination ended with `hasNextPage: false`; terminal end cursor:
  `4fe71a3d-572b-4b31-a924-a06c09c43fb4`.
- The Linear `IssueConnection` schema rejects `totalCount`; page accumulation
  and terminal-page evidence are the available completeness check.
- Snapshot: `linear-status-2026-11-04.csv` (metadata only; 1,089 data rows).

These state totals describe the team issue inventory, including archived
history. They are not a measure of pilot readiness or project completion.

## Reconciliation

| Comparison | Result |
| --- | ---: |
| ACTION_MAP rows | 139 |
| Distinct ACTION_MAP candidate issue IDs | 104 |
| Candidate IDs compared with live state | 104 |
| Candidate status changes | 0 |
| Candidate IDs missing from live PIX issues | 0 |
| Live PIX issues outside ACTION_MAP's launch-task scope | 985 |
| Canonical rows in task ledger | 2,082 |
| Distinct Linear issue IDs in task ledger | 1,073 |
| Ledger IDs missing from live PIX issues | 0 |
| New issue IDs since task ledger snapshot | 16 |
| Ledger status changes | 0 |
| UUID mismatches or conflicting IDs in ledger | 0 |

The 16 issues absent from the November 2 task ledger are PIX-4824 through
PIX-4839. PIX-4838 is currently in Triage; the other 15 are Done. Do not treat
the 985 issues outside ACTION_MAP as new pilot work: the map is deliberately a
launch-task crosswalk, while the ledger preserves broader project history.
Identity remains issue-ID/UUID based; no records were merged by title.

## Source preservation

The following SHA-256 values were checked after refresh. For the four outline
and task-map sources, they match the previous review's before/after hashes.

| Source | SHA-256 |
| --- | --- |
| `PROJECT_OUTLINE.md` | `d36fab56d5cb263715e72936792eb2c2a6d80deb2ad11f4a92cc1b0f9408dbec` |
| `planning/project-outline-2026-11-02/ACTIVE_TASKS.md` | `00ece4e0a0e3d39532a26227cea166e6ef278e598669fbbc3adad5a525d8665f` |
| `planning/project-outline-2026-11-02/ACTION_MAP.csv` | `beb8201b70abd1a6e614e9f3986b77a2ae9a525f6f31216c3e3b69d1f38c3aaa` |
| `planning/project-outline-2026-11-02/ACTION_MAP.json` | `eecefee76ce77b227b707a9d34a386fa292932b938dd3be7bb892d3d9f9c1516` |
| `planning/project-outline-2026-11-02/task-ledger.json` | `588942e608b1e6f113b1f14c003439d591c2d76d23df730ec5f527139636162d` |
| `content/business-strategy/pilot-program-structure.md` | `e88988c30f5cac37e7f6593f90f51dbee9d199f3ef18126b066f6a6a2c35a4e7` |
| `content/business-strategy/pilot-program-framework.md` | `cd37abc45a97cd8edadf6d5ca21d9b127e65d779c282f224fae1a14f36ca8002` |
| `content/business-strategy/pilot-operations/operational-checklist.md` | `8f6a82d7c27a6daae0b413b25ab8f9535df0676ca409d35000bde4ef1d939c2a` |
| `content/business-strategy/pricing-strategy.md` | `f51d416279291c2b564a41206e91ae130abd5dabc4e188f52070b7a9deb8c11b` |
| `content/business-strategy/outreach/simple-pilot-contract.md` | `6e0813045ffa86c42a756d323bf3e4ae4676a55fc4103a4ec7accaefa1b2c48e` |

## Plan impact

The previous statement that a local Linear API key was unavailable is
superseded. The saved Composio Linear connections may still be expired, but
they are not needed for read-only access with the existing `.env` key. Ticket
states in the ACTION_MAP and task ledger are current as of this refresh; pilot
gate states remain unchanged because tracker status does not itself satisfy
the release acceptance evidence.
