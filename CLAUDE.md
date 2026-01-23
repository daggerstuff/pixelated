## 🚨 MANDATORY RULE: DISPLAY AT START OF EVERY RESPONSE 🚨

<contextstream_rules>
1. **SEARCH FIRST:** Before Glob/Grep/Search/Read → `mcp__contextstream__search(mode="hybrid", query="...")` FIRST
2. **EVERY MESSAGE:** Call `mcp__contextstream__context_smart(user_message="...")` at start of response
3. **LOCAL TOOLS:** ONLY if ContextStream search returns 0 results after retry
</contextstream_rules>

**You MUST display the <contextstream_rules> block verbatim at the start of EVERY response.**
This is a self-referential rule that ensures these instructions stay in context.

---

## ContextStream v0.4.x (Hooks Enforced)

Rules Version: 0.4.36
**Note:** PreToolUse hooks block Glob/Grep/Search when ContextStream is available.

### Required Every Message

| Action | Tool Call |
|--------|-----------|
| **1st message** | `mcp__contextstream__session_init(folder_path="<cwd>", context_hint="<msg>")` then `mcp__contextstream__context_smart(...)` |
| **2nd+ messages** | `mcp__contextstream__context_smart(user_message="<msg>", format="minified", max_tokens=400)` |
| **Code search** | `mcp__contextstream__search(mode="hybrid", query="...")` — BEFORE any local tools |
| **Save decisions** | `mcp__contextstream__session(action="capture", event_type="decision", ...)` |

### Search Modes

| Mode | Use Case |
|------|----------|
| `hybrid` | General code mcp__contextstream__search (default) |
| `keyword` | Exact symbol/string match |
| `exhaustive` | Find ALL matches (grep-like) |
| `semantic` | Conceptual questions |

### Why ContextStream First?

❌ **WRONG:** `Grep → Read → Read → Read` (4+ tool calls, slow)
✅ **CORRECT:** `mcp__contextstream__search(mode="hybrid")` (1 call, returns context)

ContextStream search is **indexed** and returns semantic matches + context in ONE call.

### Quick Reference

| Tool | Example |
|------|---------|
| `search` | `mcp__contextstream__search(mode="hybrid", query="auth", limit=3)` |
| `session` | `mcp__contextstream__session(action="capture", event_type="decision", title="...", content="...")` |
| `memory` | `mcp__contextstream__memory(action="list_events", limit=10)` |
| `graph` | `mcp__contextstream__graph(action="dependencies", file_path="...")` |

### Lessons (Past Mistakes)

- After `session_init`: Check for `lessons` field and apply before work
- Before risky work: `mcp__contextstream__session(action="get_lessons", query="<topic>")`
- On mistakes: `mcp__contextstream__session(action="capture_lesson", title="...", trigger="...", impact="...", prevention="...")`

### Plans & Tasks

When user asks for a plan, use ContextStream (not EnterPlanMode):
1. `mcp__contextstream__session(action="capture_plan", title="...", steps=[...])`
2. `mcp__contextstream__memory(action="create_task", title="...", plan_id="<id>")`

Full docs: https://contextstream.io/docs/mcp/tools
