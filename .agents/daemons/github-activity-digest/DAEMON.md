---
id: github-activity-digest
purpose: Publish one low-noise daily digest of meaningful GitHub pull request and CI activity.
routines:
  - Collect meaningful GitHub pull request and CI activity since the previous scheduled run.
  - Select only high-signal items that changed what the team needs to know or do.
  - When a verified Slack destination is configured, post one concise digest if the signal threshold is met and no digest exists for the UTC date.
deny:
  - Do not modify GitHub state.
  - Do not post when the Slack destination is missing or unverified.
  - Do not create more than one digest message for the same UTC date.
  - Do not post threaded retries or quiet-day confirmation messages.
  - Do not post raw event dumps, long watch lists, speculative metrics, or inferred performance scores.
  - Do not name people in problem-oriented bullets unless the team policy explicitly allows it.
  - Do not post on low-signal days unless the team explicitly wants quiet-day confirmations.
schedule: "0 15 * * 1-5"
---

# GitHub Activity Digest

## Repository configuration

Repository policy:

- Slack destination: none configured or verified.
- Until a destination is explicitly configured and verified, no-op silently without posting.

## Scope

Collect activity from the repository that contains this daemon.

Default window:

- previous scheduled run to current scheduled run
- Monday includes weekend activity since the prior Friday run

## Signal threshold

Include activity only when it changes what the team needs to know or do.

Examples:

- pull request merged
- pull request opened and ready for review
- pull request unblocked
- recurring CI failure affecting active work

Exclude:

- label-only churn
- assignment-only changes
- bot housekeeping
- comment-only chatter without action
- duplicate references to the same underlying change

## Low-noise behavior

If fewer than two meaningful items exist, do not post unless the single item is a critical blocker or unblocker.

If no item meets the signal threshold, no-op silently.

No-op silently when there has been no repository activity since the previous scheduled run.

## Output format

Use `references/digest-template.md`.

Start each top-level digest with the immutable exact marker `GitHub daily digest (YYYY-MM-DD UTC)`, substituting the current UTC date.

Format the Slack message with Slack `mrkdwn`, not standard Markdown. Use Slack link syntax (`<url|label>`), bold section labels with `*text*`, and plain hyphen bullets.

Do not use Markdown headings, Markdown links (`[label](url)`), tables, nested lists, or code fences in the final Slack message.

Limits:

- 1 link maximum per bullet
- no tables
- no nested bullet lists
- no unverified counts

## Communication policy

Before posting, inspect recent messages in the configured channel and the prior activation context for a Charlie-authored message with today's exact immutable marker.

If found, no-op silently.

On retry or after ambiguous delivery, re-check for the exact marker before any further post attempt. Create at most one top-level digest per UTC date; do not use a thread for a retry.

No-op silently when no item meets the signal threshold, duplicate detection shows today's digest already exists, or the Slack destination is missing or unverified.

Do not post a digest asking for configuration or policy decisions. Surface blockers only when a configured safe Slack channel exists and human action is required.
