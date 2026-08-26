# Idea Archival Policy & Backlog Cleanup Workflow

**Last updated:** 2026-07-30 **Owner:** Chad

---

## 1. Purpose

Keep the Linear backlog actionable without losing recoverable context. Ideas
that are not actively scheduled should be archived — not deleted — so historical
context, duplicates, and prior art remain searchable.

---

## 2. Decision Rules

### Keep Open

| Condition                                           | Example                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| Clear requirements and acceptance criteria exist    | Spec, design link, or documented user need                       |
| Assigned to a sprint or has a committed milestone   | Labeled `sprint-*` or pinned to a project                        |
| Currently in progress or blocked by a known issue   | Status is `In Progress` or status is `Todo` with a named blocker |
| Recently updated (< 90 days) with active discussion | Comments or status changes within the quarter                    |

### Archive

| Condition                                            | Example                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| No activity for 90+ days and not in an active sprint | Stale, no comments, no assignee action           |
| Superseded by another issue                          | "See PIX-XXXX" noted in comments                 |
| Vague idea with no clear next step                   | "Explore X" with no spec, no constraints         |
| Duplicate but with useful context                    | Keep as archival reference, link canonical issue |

### Merge

| Condition                                           | Example                                                         |
| --------------------------------------------------- | --------------------------------------------------------------- |
| Two or more issues describe the same feature or fix | Same user story, same acceptance criteria                       |
| Issues are complementary parts of one deliverable   | Backend + frontend tracked as separate issues but better merged |
| One issue is strictly a subset of another           | "Add login button" is part of "Implement SSO"                   |

After merging, archive the superseded issue with a comment linking the canonical
one.

### Delete

| Condition                                       | Example                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| Truly out of scope — will never be built        | Platform-specific feature for a deprecated system       |
| Test/spike issue that served its purpose        | "Investigate library X" — conclusion recorded elsewhere |
| Accidental duplicate with no additional context | Created by automation or human error                    |

**Prefer archive over delete.** Delete only when the issue has zero
informational value.

---

## 3. Cleanup Workflow

Run this monthly (e.g., first Friday) as a 30-minute backlog grooming session.

### Step 1: Identify Candidates

```bash
# Linear filter — issues in "Todo" untouched for 90+ days
# Query: status:Todo updated:<90d
# Or use the CLI dashboard:
python3 scripts/ci/ci-ops-dashboard.py --backlog-report
```

### Step 2: Classify Each Issue

| Action      | How                                                                               |
| ----------- | --------------------------------------------------------------------------------- |
| **Keep**    | Add a comment explaining why it stays. Optionally bump priority.                  |
| **Archive** | Set status → `Backlog` or add label `archived`. Leave a one-line summary comment. |
| **Merge**   | Comment `Superseded by PIX-XXXX` → link canonical issue → archive.                |
| **Delete**  | Confirm no external references (GitHub PR, commit, doc link) → delete in Linear.  |

### Step 3: Batch Operations

For 5+ issues with the same action, batch process:

- Archive: use Linear multi-select → status change
- Merge: process individually (each needs a link)
- Delete: process individually (irreversible)

### Step 4: Log Changes

After grooming, post a summary to the team channel:

```
Backlog grooming (2026-07-30):
- Kept: 3
- Archived: 12
- Merged: 2 (PIX-XXX → PIX-YYY)
- Deleted: 1 (test issue, no value)
```

---

## 4. Restoring Archived Ideas

Archived issues can be restored at any time. Before restoring:

1. Re-assess whether the spec is still current
2. Link the archive issue in the new issue as prior art
3. If restoring to active development, update acceptance criteria and assign to
   a sprint

Archival is not permanent deletion. It is a signal that the idea needs
re-validation before work begins.

---

## 5. Exceptions

| Issue                    | Policy                                                       |
| ------------------------ | ------------------------------------------------------------ |
| Security vulnerabilities | Never archive — escalate or close with resolution            |
| Compliance/audit items   | Never archive — keep in dedicated project                    |
| Customer-reported bugs   | Never archive — keep until fix ships or explicitly won't fix |
| RFCs and ADRs            | Never archive — move to `docs/` instead                      |

---

## 6. References

- [Linear documentation on archiving](https://linear.app/docs/managing-issues#archiving)
- [Backlog grooming best practices](https://linear.app/docs/backlog-management)
