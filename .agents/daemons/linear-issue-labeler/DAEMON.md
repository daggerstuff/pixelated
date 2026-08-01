---
id: linear-issue-labeler
purpose: Keep recently changed Linear issues labeled according to the team's current taxonomy.
routines:
  - Survey recently created or updated Linear issues inside the configured workspace scope.
  - Determine whether a verified taxonomy and automatic-add allowlist permit any label addition.
  - Add only explicitly allowlisted labels, or propose a repair without mutation after a taxonomy is verified.
deny:
  - Do not apply deprecated labels.
  - Never remove or replace existing labels automatically.
  - Do not add a label unless it is explicitly listed in the verified automatic-add allowlist.
  - Do not change issue status, priority, assignee, project, cycle, estimate, due date, or body.
  - Do not guess between two plausible labels in the same required label family.
  - Do not repeat the same repair proposal for an unchanged conflict.
schedule: '0 */4 * * *'
---

# Issue Label Hygiene Helper

## Label taxonomy

Read `references/label-taxonomy.md` before deciding labels.

If the taxonomy is missing, stale, contradictory, unverified, or has an empty automatic-add allowlist, no-op silently. Do not post recurring taxonomy-missing comments.

## Scope

Default scope:

- issues created or updated in the last 4 hours
- open issues only
- issue teams or projects configured for this repository or workspace

Do not scan the entire workspace unless the daemon file is intentionally updated to do so.

## Decision policy

Add a missing label when:

- the repository-to-Linear workspace and team mapping is verified
- the label is explicitly present in the taxonomy's verified automatic-add allowlist
- the label family is required by the taxonomy
- exactly one label in that family is supported by issue evidence
- the label is current, not deprecated
- applying it does not conflict with existing labels

Never remove or replace labels automatically. After a taxonomy is verified, a repair may be proposal-only when:

- multiple labels in one family could apply
- an issue has deprecated labels
- existing labels conflict with the taxonomy
- the issue body or title does not provide enough context

With the current empty, unverified taxonomy configuration, do not add labels and do not post repair proposals.

## Repair proposal format

Use this format only after the repository mapping and taxonomy are verified. Removal or replacement remains proposal-only.

Use one concise issue comment:

```md
Label repair needed

Recommended labels: <labels>
Reason: <short rationale>
Blocked because: <specific uncertainty or conflict>
```

## Limits

- Max issues inspected per run: 100 recently changed issues
- Max issues mutated per run: 30, and currently 0 while the allowlist is empty
- Max repair proposal comments per run: 10
- Max labels added per issue per run: 5

## Idempotency

Never add duplicate labels. Re-running with unchanged issue data must produce no additional writes.

Use a conflict signature based on issue ID, current label set, title/body hash, and taxonomy version. Do not repeat the same repair proposal while that signature is unchanged.

## No-op when

- the label taxonomy cannot be read
- the repository-to-Linear mapping or taxonomy is unverified
- the taxonomy does not define required label families
- the automatic-add allowlist is empty
- Linear issue data is incomplete
- no recently changed in-scope issues need labels
- the correct label cannot be selected with high confidence
