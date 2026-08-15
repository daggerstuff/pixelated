# Agent Architecture Pipeline

Seven Eve agents form the Pixelated Empathy therapeutic training platform. This
doc maps their roles, data flow, handoff protocol, and shared infrastructure.

## Agent Map

```
                         ┌──────────────────┐
                         │   intake-agent   │
                         │  (Enrollment &   │
                         │   Cohorts)       │
                         └────────┬─────────┘
                                  │ trainee data
                                  v
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ session-agent  │───►│   qa-agent       │───►│ pipeline-agent   │
│ (Rehearsal     │    │ (Clinical QA &   │    │ (Training MLOps  │
│  Orchestrator) │    │  Review)         │    │  & Promotion)    │
└────────────────┘    └──────────────────┘    └────────┬─────────┘
       │ handoff:qa          │ handoff:pipeline         │
       │                     │                         │ subagent call
       v                     v                         v
┌───────────────────────────────────────────────────────────────┐
│                    supervisor-agent                            │
│          (Cross-agent oversight, reporting, alerts)            │
└───────────────────────────────────────────────────────────────┘
       │                         ▲
       │                         │ review request
       v                         │
┌───────────────────────────────────────────────────────────────┐
│                    advisor-agent                                │
│          (Code review, pipeline gate approval)                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    content-agent                                │
│          (Clinical scenario quality curation, library gate)    │
└───────────────────────────────────────────────────────────────┘
```

## Agent Roles

| Agent                | Role                                                                                                                                                      | Entry Points                                | Schedule             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| **session-agent**    | Conversation rehearsal session orchestrator. Runs the live trainee-facing session: emotion analysis, boundary checks, pace analysis, session persistence. | Eve API (`/eve/v1/health`), HTTP middleware | None (event-driven)  |
| **qa-agent**         | Clinical session QA & review. Scores sessions against the rubric, detects emotional patterns, flags training gaps, generates reports.                     | Eve API, Linear, Slack digest               | Daily 23:30 UTC      |
| **pipeline-agent**   | Training pipeline orchestrator. Manages dataset curation → training → evaluation → staging → production promotion with human approval gates.              | Eve API, Slack, Linear                      | Weekly Mon 09:00 UTC |
| **intake-agent**     | Intake & cohort manager. Onboards trainees, assigns to time- or skill-based cohorts (BEGINNER/INTERMEDIATE/ADVANCED), tracks curriculum.                  | Eve API, Linear                             | None (event-driven)  |
| **supervisor-agent** | Clinical supervisor oversight. Reads across all agents' data to answer ad-hoc queries, compare cohorts, adjust thresholds, post alerts.                   | Eve API, Slack, Linear                      | None (on-demand)     |
| **advisor-agent**    | Code review & engineering advisor. Reviews worktree state and source files, returns scored actionable advice. Does not write files.                       | Eve API, Slack, Linear                      | Weekly Mon 09:00 UTC |
| **content-agent**    | Clinical content curator. Audits, scores, and gates generated training scenarios before they enter the scenario library.                                  | Eve API                                     | None (event-driven)  |

## Data Flow

### Session Lifecycle

```
Trainee UI ──► session-agent ──► Foresight MCP (session memory)
                    │
                    ├──► handoff:qa tag ──► qa-agent (daily review)
                    │
                    └──► Foresight (session record, emotions, boundaries)
```

### QA & Training Gap Flow

```
qa-agent ──► Foresight (score records, gap flags)
    │
    ├──► supervisor-agent reads via searchMemories
    │
    └──► handoff:pipeline tag ──► pipeline-agent (weekly curation)
```

### Pipeline Promotion Flow

```
pipeline-agent
    ├──► evaluate_pipeline_review ──► advisor-agent (subagent) ──► scored advice
    ├──► human approval gate
    ├──► Foresight (provenance records)
    └──► promote_to_staging / promote_to_production
```

### Content Curation Flow

```
Session scenarios ──► content-agent
    ├──► audit_corpus (clinical quality dimensions)
    ├──► score_thread (Workers AI scoring)
    ├──► curate_showcase (top N, diverse presentations)
    └──► gate_injection (publish gate ← human approval)
```

## Handoff Protocol

| Trigger               | Source         | Target         | Mechanism                                    |
| --------------------- | -------------- | -------------- | -------------------------------------------- |
| Session completed     | session-agent  | qa-agent       | Foresight write with `tag: handoff:qa`       |
| Training gap found    | qa-agent       | pipeline-agent | Foresight write with `tag: handoff:pipeline` |
| Before promotion gate | pipeline-agent | advisor-agent  | Eve subagent delegation                      |

All handoffs are **async** (via Foresight memory tags) except pipeline → advisor
which uses **sync subagent delegation** because it blocks the promotion gate.

## Shared Infrastructure

| Component         | Integration                                              | Used By                                                       |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| **Foresight MCP** | HTTP/SSE via `foresight-client.ts`                       | All agents                                                    |
| **Workers AI**    | MCP connection (`@cf/meta/llama-3.2-3b-instruct`)        | session-agent, qa-agent, content-agent                        |
| **Memory MCP**    | MCP connection                                           | session-agent                                                 |
| **Eve framework** | `defineAgent`, `defineTool`, `defineMcpClientConnection` | All agents                                                    |
| **Linear**        | Channel                                                  | pipeline-agent, supervisor-agent, advisor-agent, intake-agent |
| **Slack**         | Channel                                                  | qa-agent, pipeline-agent, supervisor-agent, advisor-agent     |

## Memory Tag Conventions

All agents use Foresight memory with consistent tag conventions for cross-agent
discovery:

| Category              | Used By                         | Tags                                                   |
| --------------------- | ------------------------------- | ------------------------------------------------------ |
| `session`             | session-agent, qa-agent         | `session:<uuid>`, `trainee:<id>`, `handoff:qa`         |
| `training_gap`        | qa-agent, pipeline-agent        | `trainee:<id>`, `handoff:pipeline`, `severity:<level>` |
| `trainee`             | intake-agent, supervisor-agent  | `trainee:<id>`, `intake`                               |
| `cohort`              | intake-agent, supervisor-agent  | `cohort:<id>`, `enrollment`                            |
| `curriculum`          | intake-agent                    | `trainee:<id>`, `curriculum`, `step:<id>`              |
| `training_provenance` | pipeline-agent                  | `model_card_hash:<hash>`, `pipeline`                   |
| `boundary_flag`       | session-agent, supervisor-agent | `session:<uuid>`, `severity:<level>`                   |
