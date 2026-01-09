# Zep Cloud Quick Reference Card

## Start Memory Server
```bash
uv run python ai/api/mcp_server/memory_server.py
# → Server on http://0.0.0.0:5003
# → Docs on http://localhost:5003/docs
```

## Create User (Python)
```python
import os
from zep_cloud import Zep
from ai.api.memory import get_zep_manager

zep = Zep(api_key=os.environ['ZEP_API_KEY'])
mgr = get_zep_manager(zep)

user = mgr.create_user(
    email="patient@pixelated.local",
    name="John Doe",
    role="patient"
)
```

## Create User (REST)
```bash
curl -X POST http://localhost:5003/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@pixelated.local",
    "name": "John Doe",
    "role": "patient"
  }'
```

## Add Message (Python)
```python
mem_mgr = get_memory_manager(zep)
mem_mgr.add_message(
    user_id="user-123",
    session_id="session-123",
    content="I'm experiencing anxiety",
    role="user"
)
```

## Add Message (REST)
```bash
curl -X POST http://localhost:5003/api/v1/memory/session-123/messages \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-123",
    "content": "I'"'"'m experiencing anxiety",
    "role": "user"
  }'
```

## Get Conversation History (Python)
```python
history = mem_mgr.get_conversation_history(
    user_id="user-123",
    session_id="session-123"
)
for msg in history:
    print(f"{msg.role}: {msg.content}")
```

## Get Conversation History (REST)
```bash
curl -X GET "http://localhost:5003/api/v1/memory/session-123/history?limit=50"
```

## Migrate User from mem0 (Python)
```python
from ai.api.memory import get_mem0_migrator

migrator = get_mem0_migrator(zep)

# Migrate user
user_id = migrator.migrate_user({
    "id": "mem0-user-123",
    "name": "Jane Doe",
    "email": "jane@example.com"
}, role="patient")

# Migrate conversation
migrator.migrate_conversation_history(
    session_id="zep-session-123",
    mem0_messages=[
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"}
    ]
)

# Validate
report = migrator.validate_migration(user_id, "zep-session-123")
print(f"Valid: {report['valid']}, Messages: {report['memory_count']}")
```

## Migrate User from mem0 (CLI)
```bash
# Single migration
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user mem0-user-123 \
  --session mem0-session-456

# Test migration (dry-run)
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user mem0-user-123 \
  --dry-run

# Validate migration result
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user zep-user-123 \
  --validate
```

## Store Emotional State (Python)
```python
mem_mgr.store_emotional_state(
    user_id="user-123",
    session_id="session-123",
    emotions={
        "anxiety": 0.7,
        "sadness": 0.4,
        "joy": 0.2
    },
    context="Discussing family relationships",
    triggers=["family", "expectations"]
)
```

## Store Emotional State (REST)
```bash
curl -X POST http://localhost:5003/api/v1/memory/session-123/emotional-state \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-123",
    "emotions": {
      "anxiety": 0.7,
      "sadness": 0.4
    },
    "context": "Discussing family relationships"
  }'
```

## Store Treatment Plan (Python)
```python
mem_mgr.store_treatment_plan(
    user_id="user-123",
    session_id="session-123",
    goals=["Reduce anxiety", "Improve sleep"],
    interventions=["CBT", "Relaxation exercises"],
    progress_metrics={"anxiety_score": "baseline"},
    duration_weeks=12
)
```

## Store Treatment Plan (REST)
```bash
curl -X POST http://localhost:5003/api/v1/memory/session-123/treatment-plan \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-123",
    "goals": ["Reduce anxiety"],
    "interventions": ["CBT"],
    "duration_weeks": 12
  }'
```

## Get Memory Statistics (Python)
```python
stats = mem_mgr.get_memory_stats("session-123")
print(f"Messages: {stats['total_messages']}")
print(f"Types: {stats['memory_types']}")
```

## Get Memory Statistics (REST)
```bash
curl -X GET http://localhost:5003/api/v1/memory/session-123/stats
```

## Health Check
```bash
curl -X GET http://localhost:5003/health
```

## List User Sessions (Python)
```python
sessions = user_mgr.list_user_sessions("user-123")
for session in sessions:
    print(f"Session: {session.session_id}, Created: {session.created_at}")
```

## List User Sessions (REST)
```bash
curl -X GET http://localhost:5003/api/v1/users/user-123/sessions
```

## Environment Setup
```bash
# Verify ZEP_API_KEY is set
echo $ZEP_API_KEY

# Or add to .env
echo "ZEP_API_KEY=your-key-here" >> .env
source .env
```

## Common Issues

### Connection Failed
```bash
# Verify key
echo $ZEP_API_KEY

# Test connection
uv run python -c "from zep_cloud import Zep; Zep(api_key=os.environ['ZEP_API_KEY']); print('✓ OK')"
```

### Port Already in Use
```bash
# Kill process using port 5003
lsof -i :5003
kill -9 <PID>

# Or use different port
MEMORY_SERVER_PORT=5004 uv run python ai/api/mcp_server/memory_server.py
```

### Migration Failed
```bash
# Dry-run to test
uv run python ai/scripts/migrate_mem0_to_zep.py --user test-user --dry-run

# Check logs
LOG_LEVEL=DEBUG uv run python ai/scripts/migrate_mem0_to_zep.py --user test-user
```

## Key Roles
- `patient` - Individual receiving therapy
- `therapist` - Licensed mental health professional
- `admin` - System administrator
- `support` - Support staff

## Key Memory Types
- `conversation` - Conversation history
- `session_summary` - Session summary
- `therapeutic_notes` - Therapeutic notes
- `emotional_state` - Emotional state snapshots
- `treatment_plan` - Treatment plan
- `crisis_context` - Crisis-related context
- `progress_notes` - Progress notes

## Key Message Roles
- `user` - User input
- `assistant` - AI assistant response
- `therapist` - Therapist input
- `system` - System/metadata

## Documentation Links
- **Complete Guide:** `ZEP_COMPLETE_INTEGRATION.md`
- **Migration Guide:** `MEM0_TO_ZEP_MIGRATION.md`
- **Implementation Summary:** `ZEP_INTEGRATION_COMPLETE_SUMMARY.md`
- **API Docs:** http://localhost:5003/docs (when server running)

## Files
- Memory Modules: `ai/api/memory/`
- Memory Server: `ai/api/mcp_server/memory_server.py`
- Migration Tool: `ai/scripts/migrate_mem0_to_zep.py`
- Configuration: `ai/api/mcp_server/config.py`, `mcp_config.json`

---

**Status:** ✅ Ready for Production  
**Last Updated:** January 2026
