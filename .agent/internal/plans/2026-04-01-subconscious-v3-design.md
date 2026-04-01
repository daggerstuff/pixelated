# Claude Subconscious v3 Design

## Goal
Replace broken v1/v2 architecture with async-first, no-global-state memory injection using contextvars.

## Architecture

### Core Mechanism: Context Variables
Python's `contextvars` provides async-safe value propagation without globals:

```python
# Set at session start
token = set_subconscious(config, user_id="alice")

# Any downstream code can access
state = get_subconscious()
if state:
    enriched = await state.enrich(message)

# Cleanup at session end
await reset_subconscious(token)  # Triggers reflection
```

### Components

1. **SubconsciousConfig** - Frozen dataclass, all defaults from environment
2. **SubconsciousState** - Holds conversation, triggers reflection on close
3. **MemoryProvider** - Abstract interface (LocalHindsight, Mock implementations)
4. **SubconsciousClient** - Explicit API for programmatic use

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transparent injection | Context variables | Native async-safe, no monkey patching |
| Memory backend | Pluggable (SQLite default) | Testable, future-proof |
| Reflection timing | Session end + manual | Simpler than step counting, better context |
| Crisis detection | Removed | Out of scope for memory system |
| Memory blocks | Unified (no blocks) | Simpler, semantic search handles all |

### File Structure

```
ai/memory/v3/
├── __init__.py      # Public exports
├── config.py        # SubconsciousConfig (frozen)
├── context.py       # SubconsciousState + contextvars API
├── client.py        # SubconsciousClient (explicit API)
├── provider.py      # MemoryProvider interface + implementations
└── tests/
    └── test_v3.py   # 13 tests, all passing
```

### Usage Examples

**Transparent (Claude Code sessions):**
```python
from ai.memory import SubconsciousConfig, set_subconscious, get_subconscious, reset_subconscious

async def session_handler(user_id: str):
    config = SubconsciousConfig.from_env()
    token = set_subconscious(config, user_id)

    try:
        # ... session work ...

        # Any code can check for context
        state = get_subconscious()
        if state:
            enriched = await state.enrich(user_message)
    finally:
        await reset_subconscious(token)  # Auto-reflection
```

**Explicit (Direct API):**
```python
from ai.memory import SubconsciousClient, SubconsciousConfig

async def direct_call():
    client = await SubconsciousClient.create(
        config=SubconsciousConfig.from_env(),
        user_id="alice",
    )

    response = await client.chat([
        {"role": "user", "content": "What did we discuss last time?"}
    ])

    await client.close()  # Triggers reflection
```

### What Was Removed

- No monkey patching of OpenAI/Anthropic `__init__`
- No `asyncio.get_event_loop()` gymnastics
- No global state (`_subconscious_active`, `_user_id`, `_bootstrap`)
- No step counting during conversation
- No crisis detection
- No memory block categories

### Test Results

```
13 passed in 0.08s
```

Tests cover:
- Config immutability
- Memory store/recall/delete
- User isolation
- Enrichment with/without memories
- Context nesting
- Full integration flow
