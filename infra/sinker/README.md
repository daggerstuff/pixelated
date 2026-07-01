# `infra/sinker/` — Sinker-server (135.148.101.170) ollama facility

This directory holds the local-only committed artifacts of the
`infra-sinker-ollama` milestone. Workers write to it; orchestrator performs
control-of-record in `~/.factory/missions/98c15371-.../features.json`.

## Layout

```
infra/sinker/
├── README.md                  — this file
├── model_digest.lock          — orchestrator-seeded expected model + GPU floor
│                                (committed at plan time, read-only for workers)
├── sinker-ssh-gpu-probe/     — run rebars per feature
├── sinker-ollama-standup/
├── sinker-model-pull-wayfarer-granite/
├── sinker-traefik-public/
├── sinker-caddy-oauth2-proxy/
├── sinker-dns-cname-records/
├── traefik/                   — traefik files scp'd to sinker /srv/sinker-traefik/
├── caddy/                     — oauth2-proxy files scp'd to sinker /srv/sinker-caddy/
└── modelfile.snippets/        — captured modelfiles for reproducibility
```

## Reachable from

- orchestrator VM (where Mission Control runs)
- sinker VM (`vivi@135.148.101.170`, key `~/.ssh/tictactoe`)

## Committed but never pushed

Per orchestrator policy, the Droid-Shield push-block on Postgres connection
strings applies here too — workers commit locally and return
`successState: partial` if push-block fires. The artifact commits are
local-only.
