# Human Escalation Action

Posts a formatted handoff when automation cannot resolve a task safely.

```yaml
- uses: ./.github/actions/human-escalation
  if: failure()
  with:
    trigger: test_failure_after_fix
    what-was-tried: Ran the focused tests after applying the candidate fix.
    failure-reason: The same assertion is still failing.
    next-steps: Review the failing test output and decide whether the fix needs broader scope.
    slack-webhook-url: ${{ secrets.PR_REVIEWS_SLACK_WEBHOOK_URL }}
    linear-api-key: ${{ secrets.LINEAR_API_KEY }}
    linear-team-id: ${{ secrets.LINEAR_TEAM_ID }}
```

Supported trigger names include:

- `conflict_after_rebase_attempt`
- `test_failure_after_fix`
- `low_confidence_fix`
- `llm_timeout_after_retries`
- `rate_limit_reached`
- `workflow_failure`

GitHub comments are posted automatically when the workflow event contains a pull request or issue number. Use `target-number` when the event context cannot resolve one.
