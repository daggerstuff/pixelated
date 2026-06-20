# Skills Index (Hub-and-Spoke Lazy Loading)

*Generated: 2026-06-20 15:18:37*
*Total skills: 35 | Populated: 35 | Empty/missing: 0*

## Purpose

This index enables **lazy loading** of skill definitions. Instead of loading all skill files at startup (which consumes 70-100K tokens), only this lightweight index is loaded initially. Individual skill details are loaded on-demand when referenced.

## Lazy Loading Directive

**When a skill is invoked:**
1. Check this index for the skill name and path
2. Load only THAT skill's SKILL.md file (typical: ~2-5K tokens)
3. Cache the loaded skill for session reuse

**Expected token reduction:**
- Startup: Index only (~5-10K tokens) vs all skills (~70-100K tokens)
- Savings: **60-70% reduction** in initial context consumption

## Skills Catalog

### Workflow Pillars (orchestrators load these first)

- **droid-workflow** (`unspecified` · vunversioned · scope=local)
  > Structures Droid (and other agents') work using Factory's two main workflows: Specification Mode (`/spec` or Shift+Ta...
  > Path: `.agent/skills/droid-workflow/SKILL.md`

### Populated Skills (with documentation)

- **agents-sdk** (`unspecified` · vunversioned · scope=global)
  > Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, re...
  > Path: `/home/vivi/.agents/skills/agents-sdk/SKILL.md`

- **article-extractor** (`unspecified` · vunversioned · scope=local)
  > Extract clean article content from URLs (blog posts, articles, tutorials) and save as readable text. Use when user wa...
  > Path: `.agent/skills/article-extractor/SKILL.md`

- **astro** (`unspecified` · v0.0.1 · scope=legacy_local)
  > Skill for building with the Astro web framework. Helps create Astro components and pages, configure SSR adapters, set...
  > Path: `.agents/skills/astro/SKILL.md`

- **cloudflare** (`unspecified` · vunversioned · scope=global)
  > Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Age...
  > Path: `/home/vivi/.agents/skills/cloudflare/SKILL.md`

- **cloudflare-deploy** (`unspecified` · vunversioned · scope=legacy_local)
  > Consolidated skill for building on the Cloudflare platform. Use decision trees below to find the right product, then ...
  > Path: `.agents/skills/cloudflare-deploy/SKILL.md`

- **cloudflare-email-service** (`unspecified` · vunversioned · scope=global)
  > Send and receive transactional emails with Cloudflare Email Service (Email Sending + Email Routing). Use when buildin...
  > Path: `/home/vivi/.agents/skills/cloudflare-email-service/SKILL.md`

- **cloudflare-one** (`unspecified` · vunversioned · scope=global)
  > Guides Cloudflare One Zero Trust and SASE work across Access, Gateway, WARP, Tunnel, Cloudflare WAN, DLP, CASB, devic...
  > Path: `/home/vivi/.agents/skills/cloudflare-one/SKILL.md`

- **cloudflare-one-migrations** (`unspecified` · vunversioned · scope=global)
  > Plans migrations from Zscaler ZIA/ZPA, Palo Alto, legacy VPN, SWG, or SASE stacks to Cloudflare One. Use for migratio...
  > Path: `/home/vivi/.agents/skills/cloudflare-one-migrations/SKILL.md`

- **composio-cli** (`unspecified` · vunversioned · scope=global)
  > Help users operate the published Composio CLI to find the right tool, connect accounts, inspect schemas, execute tool...
  > Path: `/home/vivi/.agents/skills/composio-cli/SKILL.md`

- **dotagents** (`unspecified` · vunversioned · scope=legacy_local)
  > Manage agent skill dependencies with dotagents. Use when asked to "add a skill", "install skills", "remove a skill", ...
  > Path: `.agents/skills/dotagents/SKILL.md`

- **durable-objects** (`unspecified` · vunversioned · scope=global)
  > Create and review Cloudflare Durable Objects. Use when building stateful coordination (chat rooms, multiplayer games,...
  > Path: `/home/vivi/.agents/skills/durable-objects/SKILL.md`

- **find-skills** (`unspecified` · vunversioned · scope=global)
  > Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is...
  > Path: `/home/vivi/.agents/skills/find-skills/SKILL.md`

- **git-lint** (`unspecified` · vunversioned · scope=local)
  > Runs lint and auto-format on all changed files (staged + unstaged) across all 4 repos in the Pixelated workspace. Cov...
  > Path: `.agent/skills/git-lint/SKILL.md`

- **git-push** (`unspecified` · vunversioned · scope=local)
  > Intelligently groups, stages, commits, and pushes all 4 repos in the Pixelated workspace (ai, docs, foresight-mcp sub...
  > Path: `.agent/skills/git-push/SKILL.md`

- **prompt-refiner** (`unspecified` · vunversioned · scope=global_relay)
  > Improve prompts before sending them to get better results. Use when the user wants to refine a task description, befo...
  > Path: `/home/vivi/.factory/skills/prompt-refiner/SKILL.md`

- **sandbox-sdk** (`unspecified` · vunversioned · scope=global)
  > Build sandboxed applications for secure code execution. Load when building AI code execution, code interpreters, CI/C...
  > Path: `/home/vivi/.agents/skills/sandbox-sdk/SKILL.md`

- **sentry-browser-sdk** (`unspecified` · vunversioned · scope=global)
  > Full Sentry SDK setup for browser JavaScript. Use when asked to "add Sentry to a website", "install @sentry/browser",...
  > Path: `/home/vivi/.agents/skills/sentry-browser-sdk/SKILL.md`

- **sentry-code-review** (`unspecified` · vunversioned · scope=global)
  > Analyze and resolve Sentry comments on GitHub Pull Requests. Use this when asked to review or fix issues identified b...
  > Path: `/home/vivi/.agents/skills/sentry-code-review/SKILL.md`

- **sentry-create-alert** (`unspecified` · vunversioned · scope=global)
  > Create Sentry alerts using the workflow engine API. Use when asked to create alerts, set up notifications, configure ...
  > Path: `/home/vivi/.agents/skills/sentry-create-alert/SKILL.md`

- **sentry-feature-setup** (`unspecified` · vunversioned · scope=global)
  > Configure specific Sentry features beyond basic SDK setup. Use when asked to monitor AI/LLM calls, set up OpenTelemet...
  > Path: `/home/vivi/.agents/skills/sentry-feature-setup/SKILL.md`

- **sentry-fix-issues** (`unspecified` · vunversioned · scope=global)
  > Find and fix issues from Sentry using MCP. Use when asked to fix Sentry errors, debug production issues, investigate ...
  > Path: `/home/vivi/.agents/skills/sentry-fix-issues/SKILL.md`

- **sentry-node-sdk** (`unspecified` · vunversioned · scope=global)
  > Full Sentry SDK setup for Node.js, Bun, and Deno. Use when asked to "add Sentry to Node.js", "add Sentry to Bun", "ad...
  > Path: `/home/vivi/.agents/skills/sentry-node-sdk/SKILL.md`

- **sentry-pr-code-review** (`unspecified` · vunversioned · scope=global)
  > Review a project's PRs to check for issues detected in code review by Seer Bug Prediction. Use when asked to review o...
  > Path: `/home/vivi/.agents/skills/sentry-pr-code-review/SKILL.md`

- **sentry-python-sdk** (`unspecified` · vunversioned · scope=global)
  > Full Sentry SDK setup for Python. Use when asked to "add Sentry to Python", "install sentry-sdk", "setup Sentry in Py...
  > Path: `/home/vivi/.agents/skills/sentry-python-sdk/SKILL.md`

- **sentry-react-sdk** (`unspecified` · vunversioned · scope=global)
  > Full Sentry SDK setup for React. Use when asked to "add Sentry to React", "install @sentry/react", or configure error...
  > Path: `/home/vivi/.agents/skills/sentry-react-sdk/SKILL.md`

- **sentry-sdk-setup** (`unspecified` · vunversioned · scope=global)
  > Set up Sentry in any language or framework. Detects the user's platform and loads the right SDK skill. Use when asked...
  > Path: `/home/vivi/.agents/skills/sentry-sdk-setup/SKILL.md`

- **sentry-sdk-upgrade** (`unspecified` · vunversioned · scope=global)
  > Upgrade the Sentry JavaScript SDK across major versions. Use when asked to upgrade Sentry, migrate to a newer version...
  > Path: `/home/vivi/.agents/skills/sentry-sdk-upgrade/SKILL.md`

- **sentry-setup-ai-monitoring** (`unspecified` · vunversioned · scope=global)
  > Setup Sentry AI Agent Monitoring in any project. Use when asked to monitor LLM calls, track AI agents, track conversa...
  > Path: `/home/vivi/.agents/skills/sentry-setup-ai-monitoring/SKILL.md`

- **sentry-workflow** (`unspecified` · vunversioned · scope=global)
  > Fix production issues and review code with Sentry context. Use when asked to fix Sentry errors, debug issues, triage ...
  > Path: `/home/vivi/.agents/skills/sentry-workflow/SKILL.md`

- **similarweb-analytics** (`unspecified` · vunversioned · scope=local)
  > Analyze websites and domains using SimilarWeb traffic data. Get traffic metrics, engagement stats, global rankings, t...
  > Path: `.agent/skills/similarweb-analytics/SKILL.md`

- **turnstile-spin** (`unspecified` · vunversioned · scope=global)
  > Set up Cloudflare Turnstile end-to-end in a project — scan the codebase, create the widget via the Cloudflare API, de...
  > Path: `/home/vivi/.agents/skills/turnstile-spin/SKILL.md`

- **web-perf** (`unspecified` · vunversioned · scope=global)
  > Analyzes web performance using Chrome DevTools MCP. Measures Core Web Vitals (LCP, INP, CLS) and supplementary metric...
  > Path: `/home/vivi/.agents/skills/web-perf/SKILL.md`

- **workers-best-practices** (`unspecified` · vunversioned · scope=global)
  > Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewi...
  > Path: `/home/vivi/.agents/skills/workers-best-practices/SKILL.md`

- **wrangler** (`unspecified` · vunversioned · scope=global)
  > Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI...
  > Path: `/home/vivi/.agents/skills/wrangler/SKILL.md`

## Sources

Skills come from one of:
- `local`: this repo's `.agent/skills/` (highest precedence)
- `legacy_local`: this repo's `.agents/skills/`
- `global`: `~/.agents/skills/` (canonical user-level catalog)
- `global_relay`: `~/.factory/skills/` (symlink farm to global)

## Implementation Notes

This index replaces the eager loading pattern in `START_HERE.md`. The startup sequence should:
1. Load ONLY this index file (and `.agent/skills-index-compressed.json` for machine reads)
2. Preload any skill listed under **Workflow Pillars**
3. When a skill is requested via `task(load_skills=[...])` or `skill` tool, load the specific SKILL.md files from the paths listed
4. Cache loaded skills in memory for the session duration
5. If a skill is not in this index, fall back to scanning the directory (rare; for new skills not yet indexed)

**No changes required** to individual SKILL.md files — this index is the hub, the SKILL.md files are the spokes.

---

*End of Skills Index*