# Report format for the QA agent

The QA agent renders two deliverables per `generate_report` call:

## Slack Block Kit digest

A `home` view with three blocks:

1. **Header** — "Daily QA Digest — {cohort_id} — {date}"
2. **Section** — bullets naming the top-N priority sessions by rationale.
3. **Actions** — buttons named "Open ticket" (deep-link) and "Acknowledge".

The Block Kit payload is produced by the report-writer sub-agent with the
`outputSchema: SlackBlock` constraint enforced by the agent's `outputSchema`
definition. The agent has access to ref IDs in the buttons; it never inlines
ticket identifiers into the body.

## Linear Markdown comment fallback

If Slack delivery is delayed or fails, the same digest is dropped into the
"Training Pipeline Improvements" project as a project update with the title
`Daily QA Digest — {cohort_id} — {date}` and the canonical body template below.
The agent emits this path only on a Slack delivery failure.

```md
## Cohort

{cohort_id}

## Top priority sessions

- [{ticket_identifier}]: {rationale}

## Sources

- {session_id}
```

## Hardening rules

- Never include PII or quoted transcript text longer than 12 words.
- Use project labels exactly as written in `flagging-rules.md`.
- Always include the canonical session_id next to each summary line.

## What is still TODO

- Replace the Block Kit shape once the supervisor-side layout lock-in lands.
- Add a `force_markdown_only` flag for the Slack thread reply path.
