# Sinker Ollama Route Pinpoint Index

This file cross-references every artifact in this tree with the mission-side
documents and worker-side skill that should reference it.

| Artifact              | Mission doc                                    | Worker skill                |
| --------------------- | ---------------------------------------------- | --------------------------- |
| `model_digest.lock`   | mission.md §infra-sinker-ollama                | infra-sinker §LOCKFILE READ |
| `README.md`           | mission-AGENTS.md "Off-limits" clause          | infra-sinker §Scope         |
| `traefik/`            | mission-AGENTS.md §Mission Boundaries addendum | infra-sinker §Feature #4    |
| `caddy/`              | mission-AGENTS.md §Mission Boundaries addendum | infra-sinker §Feature #5    |
| `modelfile.snippets/` | audit-pied-piper.md PP-1.3a                    | infra-sinker §Feature #3    |

## Per-feature rebars (canonical paths)

```
infra/sinker/sinker-ssh-gpu-probe/run_<UTC>.json
infra/sinker/sinker-ollama-standup/run_<UTC>.json
infra/sinker/sinker-model-pull-wayfarer-granite/run_<UTC>.json
infra/sinker/sinker-traefik-public/run_<UTC>.json
infra/sinker/sinker-caddy-oauth2-proxy/run_<UTC>.json
infra/sinker/sinker-dns-cname-records/run_<UTC>.json
```

Worker MUST write to these paths. orchestrator aggregates the contents to update
`validation-state.json` for the 11 VAL-INFRA-\* assertions once all 6 features
complete.
