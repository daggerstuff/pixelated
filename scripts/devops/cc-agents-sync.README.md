# Command Code × dotagents setup

How Command Code (the `cmd` CLI) is wired to the [dotagents.io](https://dotagents.io)
`.agents/` layout, which parts are native, which need a workaround, and the
commands that verify it.

## What dotagents is

`npx @sentry/dotagents` manages skills, subagents, plugins, MCP servers, and
hooks declared in `agents.toml`, then writes them into each agent tool's native
paths. Two scopes:

| Scope | Config | Managed tree |
| --- | --- | --- |
| Global (default) | `~/.agents/agents.toml` | `~/.agents/skills/` |
| Project (`--project`) | `<repo>/agents.toml` | `<repo>/.agents/skills/` |

This repo uses both: a project `agents.toml` and a global one. `AGENTS.md` at
the repo root is Command Code's memory file and is read natively — that part
already works.

## Support matrix for Command Code

dotagents has no `commandcode` target. Its registry is `claude`, `cursor`,
`codex`, `vscode`, `opencode`, `copilot`, `pi`, `antigravity` — so anything
dotagents writes per-agent lands somewhere `cmd` does not read, except skills.

| Artifact | Command Code support | Action needed |
| --- | --- | --- |
| Skills | **Native.** Reads `.agents/skills/` (project) and `~/.agents/skills/` (user) | None |
| `AGENTS.md` | **Native** memory file | None |
| MCP servers | **Not read** from `.agents/mcp.json` | `make agents-sync` |
| Subagents | Different format (`~/.commandcode/agents/*.md`) | Manual, see below |
| Hooks | Different matchers (`shell`/`read`/`write`/`edit`) | Manual, see below |

### Skills: native, but do not add a symlink farm

Command Code discovers both its own location and the dotagents one, and
`.commandcode/skills/` **outranks** `.agents/skills/` on name conflicts. Now that
`.agents/skills/` is read directly, a `.commandcode/skills/` symlink into
`~/.agents/skills/` makes every skill appear twice — the `.commandcode/` copy
wins and the `.agents/` copy is reported as a duplicate.

That is what had been configured here: `.commandcode/skills` was a symlink to
`/home/vivi/.agents/skills`, and `~/.commandcode/skills` held 82 per-skill
symlinks into the same tree. Result: 156 skills loaded, **161 reported skipped**
for duplicate names, and four dangling links (`configure`, `debug`, `research`,
`fireworks-training`) pointing at skills that had been parked in
`~/.agents/skills-disabled/`.

Removing both farms leaves only the genuine project/user shadowing.

```bash
# The correct state: neither farm exists, as a directory or a dangling link
[ ! -e .commandcode/skills ] && [ ! -L .commandcode/skills ] &&
    [ ! -e ~/.commandcode/skills ] && [ ! -L ~/.commandcode/skills ] && echo clean
cmd skills list          # no duplicate warnings
```

Skills live in `~/.agents/skills/` (user) and `.agents/skills/` (project); let
Command Code read them there. Do not recreate the farms.

Project-scope modifications are ignored by git in this repo
(`.commandcode` and `.agents/` are both in `.gitignore`), so this is a local
machine setting, not something a checkout inherits.

#### Do not declare the same skill in both scopes

A skill declared in both `agents.toml` files is installed into both trees, and
Command Code then reports the project copy as shadowing the user copy. Keep each
skill in exactly one scope. Prefer the global declaration for anything you want
available in every project.

Declaring a skill in only one `agents.toml` is not enough on its own: a copy can
still linger in the other scope's skills directory with no declaration backing
it. Those leftovers are what actually produce the duplicate warnings.

```bash
# Directories with no dotagents declaration behind them
comm -13 \
  <(grep -E '^name = ' ~/.agents/agents.toml | sed 's/name = //;s/"//g' | sort) \
  <(ls -1 ~/.agents/skills | sort)
```

A hit does **not** mean orphan. On this machine, of 28 undeclared directories, 13
belong to another system and deleting or parking them breaks that owner:

| Owner | Evidence | Entries found |
| --- | --- | --- |
| `morph` CLI | `morph --version`; installed by its own skill installer | `code-research`, `colab-operator`, `explore`, `fast-apply`, `feature-research`, `morph-cli`, `morph-feedback`, `morph-migrate` |
| Repo `skills-lock.json` | key present in that manifest | `agents-sdk`, `cloudflare-email-service`, `durable-objects`, `workers-best-practices`, `wrangler` |

The remaining 15 have no manifest entry at all (`basin`, `cf-cli`,
`cloudflare-app-bootstrap`, `cloudflare-one`, `cloudflare-one-migrations`,
`frameworks-on-cloudflare`, `gateway-workers`, `k2`, `nextjs-on-cloudflare`,
`sandbox-migrate-to-next`, `sandbox-next`, `sandbox-stable`, `turnstile-spin`,
`workers-development`, `workers-profiling`). They are plausibly leftovers from a
past install, but nothing proves it — confirm with their owner before moving
them, and prefer parking to deleting:

```bash
mkdir -p ~/.agents/skills-disabled
mv ~/.agents/skills/<name> ~/.agents/skills-disabled/<name>
```

Re-check after any change; a manifest may only claim a name once that tool has
run again.

`npx @sentry/dotagents remove <name>` is the tool for a *declared* skill; it
edits `agents.toml`, deletes the managed files, and updates the lockfile. It
refuses to act on an undeclared leftover ("Skill or plugin ... not found in
agents.toml"), which is why true orphans need the manual move above.

> **`dotagents sync` mutates config.** It adopts undeclared skills into
> `agents.toml` as `path:skills/<name>` entries ("Adopted N orphan(s)"). Running
> it to *inspect* state will silently rewrite your global config and make
> duplication worse. Use `list` to inspect and `install` to apply; only run
> `sync` when adoption is what you want.

### MCP: needs the bridge

`cmd` stores MCP servers in three scopes and never reads `.agents/mcp.json`:

| Scope | File |
| --- | --- |
| `user` | `~/.commandcode/mcp.json` |
| `project` | `.mcp.json` (gitignored here) |
| `local` | `~/.commandcode/projects/<slug>/mcp.json` |

`scripts/devops/cc-agents-sync.sh` merges `~/.agents/mcp.json` into
`~/.commandcode/mcp.json`:

```bash
make agents-status    # report only
make agents-sync      # write it (backup at ~/.commandcode/mcp.json.bak)
```

The merge is additive and conservative:

- never deletes a Command Code server;
- never overwrites a same-named server with a different definition — it reports
  a conflict instead (currently `skill-route`: this machine pins a local build
  at `~/.skillroute/skill-route/mcp/build/index.js`, while `.agents` declares
  the `npx @skillroute/mcp-server` form);
- compares the **full connection spec** — `command`, `args`, `env`, and for
  HTTP also `url` and `headers` — so two servers differing only in an env var
  are treated as different, while true aliases are skipped so they do not spawn
  duplicate processes (`skillroute` vs `skill-route`);
- preserves every other key in the target document, top-level and per-server.

Exit codes: `0` success or nothing to do, `1` source file missing, `2` bad
usage or unparseable/invalid JSON in either file.

Note that `npx @sentry/dotagents mcp add` writes to each configured agent's own
file (`~/.claude.json`, `~/.codex/config.toml`, …), not to
`~/.agents/mcp.json`. The bridge reads **JSON only**: point it at a JSON file
dotagents wrote (`~/.claude.json`), not at the Codex TOML config, which it
cannot parse.

```bash
CC_AGENTS_MCP_SOURCE=~/.claude.json make agents-sync
```

Keep the target in user scope. `env` and `headers` values are copied verbatim, so
a project-scoped `.mcp.json` puts the source's credentials in the working tree.
This repository ignores `.mcp.json` (`.gitignore:54`), but a checkout that does
not would commit them.

For one-off servers, use the native command rather than the bridge:

```bash
cmd mcp add --transport http notion https://mcp.notion.com/mcp
cmd mcp add --scope user playwright -- npx -y @playwright/mcp@latest
cmd mcp list
```

### Subagents: portable markdown, different frontmatter

dotagents emits subagent files with a `# Generated by dotagents. Edit
agents.toml instead.` marker in the frontmatter, plus a `tools` list in Claude
Code's casing (`Bash, Read, Grep, Glob`). Command Code reads
`.commandcode/agents/*.md` and `~/.commandcode/agents/*.md` and expects its own
tool ids (`shell_command`, `read_file`, `grep`, `glob`, …). A copied file loads,
but the tool allowlist silently matches nothing, so the subagent gets no tools.

Map the names when porting a subagent:

| Claude Code | Command Code |
| --- | --- |
| `Read` | `read_file` |
| `Write` | `write_file` |
| `Edit` | `edit_file` |
| `Bash` | `shell_command` |
| `Grep` | `grep` |
| `Glob` | `glob` |
| `WebSearch` / `WebFetch` | `web_search` / `web_fetch` |

`agents.toml` has no `commandcode` target, so declaring `[[subagents]]` with
`targets = ["claude", ...]` will not produce a Command Code file. Treat
subagents as manual ports.

### Hooks: same shape, different matchers

dotagents writes hooks into `.claude/settings.json` / `.cursor/hooks.json`.
Command Code reads `hooks` from `.commandcode/settings.json` (project) or
`~/.commandcode/settings.json` (user). The JSON envelope is close to Claude
Code's, but the matchers are different literals:

| Command Code matcher | Covers |
| --- | --- |
| `shell` | shell commands |
| `read` | file reads |
| `write` | writes |
| `edit` | in-place edits |

Events are `PreToolUse`, `PostToolUse`, `Stop`, and `SessionStart`. Pass
`matcher` only on the two tool events — on `Stop`/`SessionStart` a matcher
prevents the hook from firing entirely. dotagents has no hook projection for
Command Code, so hook declarations are a manual copy.

## Verification

```bash
cmd skills list                 # no duplicate warnings
cmd mcp list                    # bridged servers present
make agents-status              # no pending MCP additions
npx @sentry/dotagents list      # dotagents' own view
```

## Reproducing on another host

1. Restore the global manifest first: `~/.agents/agents.toml` and its
   `agents.lock` (copy them from the old host, or recreate the declarations).
   `install` only materialises what that file declares, so a host without it
   installs nothing. Then `npx @sentry/dotagents install` (global) and
   `npx @sentry/dotagents --project install` (repo) to populate `.agents/`.
   Do not use `sync` for this — it also adopts orphans into `agents.toml`.
2. Do **not** create `.commandcode/skills` or `~/.commandcode/skills` symlinks;
   Command Code reads `.agents/skills/` directly.
3. Keep each skill declared in exactly one scope, and park orphans in the other
   scope's `skills-disabled/` rather than deleting them.
4. `make agents-sync` bridges MCP servers into user scope, and it reads
   `~/.agents/mcp.json` unless `CC_AGENTS_MCP_SOURCE` names another file; with no such
   file the bridge script exits 1 (`No dotagents MCP config at … — nothing to bridge.`), so
   `make` reports 2. Step 1 restores the skill manifests only, so copy `~/.agents/mcp.json`
   from the old host, or point the bridge at a config that already declares the servers —
   `CC_AGENTS_MCP_SOURCE=~/.claude.json make agents-sync` — then run it.
5. Port subagents and hooks by hand if you need them, mapping tool ids and
   matchers as above.
