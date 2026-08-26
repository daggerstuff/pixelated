# Linear Workspace Audit Toolkit

This directory contains the audit report and reusable scripts for auditing and
remediating Linear.

## Files

| File              | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `linear_audit.md` | Full audit report — initial findings, remediation log, and follow-up comparison                             |
| `fetch_issues.py` | Fetch all issues from Linear via GraphQL API with pagination                                                |
| `run_audit.py`    | Comprehensive audit analysis — state distribution, duplicates, assignments, estimates, enterprise readiness |
| `remediate.py`    | Bulk remediation script — resolve duplicates, assign issues, add descriptions, add estimates                |

## How to Run a Quarterly Re-Audit

### Prerequisites

- Linear API key set in `LINEAR_API_KEY` environment variable (or edit the
  script)
- Python 3.12+

### Step 1: Fetch All Issues

```bash
python3 fetch_issues.py
```

Output: `/tmp/linear_all_issues.json`

### Step 2: Run Audit Analysis

```bash
python3 run_audit.py
```

Output: Comprehensive before/after comparison printed to stdout.

### Step 3: Apply Remediations (if needed)

```bash
python3 remediate.py
```

This resolves duplicates, assigns unassigned issues, adds descriptions, and adds
estimates.

## Script Configuration

All scripts require:

- `API_KEY` — Linear API key (set in `.env` or inline)
- `CHAD_ID` — Default assignee user ID
- `TEAM_ID` — Pixelated team ID

## Output Files

- `/tmp/linear_all_issues.json` — Full issue dump (fetched)
- `/tmp/linear_followup_issues.json` — Later snapshot (for comparison)
- `/tmp/linear_workflow_states.json` — Workflow state definitions
- `/tmp/linear_labels.json` — Issue label definitions

---

## Dashboard Auto-Refresh via Linear Webhook

When issue states change in the Enterprise Readiness Program project, a Linear
webhook can automatically trigger `refresh_dashboard.py` to keep the dashboard
up to date.

### Architecture

```
Linear (Issue/Project update)
  │
  │  POST /api/webhooks/linear/dashboard
  │  Headers: linear-digest, linear-event, linear-delivery
  ▼
Express Server (src/api/server.ts)
  │
  │  Verify HMAC-SHA256 signature via standardwebhooks
  │  Filter: only Enterprise Readiness Program project (projectId match)
  │  Spawn: python3 docs/linear-audit/refresh_dashboard.py
  ▼
dashboard.md regenerated with live data
```

### Components

| File                                         | Purpose                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/api/routes/linear-dashboard-webhook.ts` | Express route handler — verifies signature, filters by project, spawns refresh            |
| `refresh_dashboard.py`                       | Live dashboard generator — fetches issue states, recomputes progress, writes dashboard.md |
| `register_webhook.py`                        | CLI tool to register/unregister the webhook subscription with Linear                      |

### Setup

**1. Register the webhook with Linear**

```bash
# The webhook URL should be the public address of your Express server
# followed by /api/webhooks/linear/dashboard
python3 register_webhook.py register \\
    --url https://your-server.com/api/webhooks/linear/dashboard \\
    --label "Enterprise Readiness Dashboard Refresh"
```

This will output a `LINEAR_DASHBOARD_WEBHOOK_SECRET`. **Save it** — it's shown
only once.

**2. Set environment variables on the server**

```bash
export LINEAR_DASHBOARD_WEBHOOK_SECRET=whsec_...  # From step 1
export LINEAR_API_KEY=lin_api_...                  # For the refresh script
```

**3. Restart the server** — the webhook endpoint is live at
`/api/webhooks/linear/dashboard`.

### Managing the Webhook

```bash
# List all registered webhooks
python3 register_webhook.py list

# Unregister by label
python3 register_webhook.py unregister --label "Enterprise Readiness Dashboard Refresh"

# Unregister by ID
python3 register_webhook.py unregister --id <webhook-id>
```

### Event Filtering

The webhook subscribes to `Issue` and `Project` events. The handler filters
further:

- Only events where `data.projectId` matches the Enterprise Readiness Program
  project are processed.
- `Issue.create`, `Issue.update`, `Issue.delete` and `Project.update` events for
  that project trigger the dashboard refresh.
- All other events are silently ignored (200 OK with `status: "ignored"`).

### Security

- **Signature verification**: Every webhook payload is verified using
  `standardwebhooks` v1.0.0 (HMAC-SHA256) before processing.
- **No auth middleware**: The route sits before `authMiddleware` in the server,
  so no user authentication is needed — the webhook signature is the sole
  authentication.
- **Project filter**: Only issues in the target project trigger a refresh.
- **Child process isolation**: `refresh_dashboard.py` runs as a detached child
  process with a copy of the environment.

## Platform Constraints

- **Estimate cap:** Linear estimates are capped at 5. Any value > 5 is silently
  clamped. The `remediate.py` script already respects this limit.
- **Trashed vs archived:** Projects are archived via `projectDelete` mutation
  (trashes them, restorable via `projectUnarchive`). The `trashed` field on
  `ProjectUpdateInput` returns an internal server error — do not use it.

## Audit History

- **2026-07-29**: Initial audit and remediation. 20 duplicates resolved, 146
  assignments made, 149 estimates added, 7 enterprise gaps created (26
  sub-issues), 15 projects archived. Linear estimate cap of 5 discovered.
