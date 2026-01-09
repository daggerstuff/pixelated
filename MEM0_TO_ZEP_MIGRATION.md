# Mem0 to Zep Cloud Migration Guide

## Overview

This guide covers migrating from **mem0** (your current memory system) to **Zep Cloud**, which provides superior persistence, scalability, and compliance features for Pixelated Empathy.

## Why Migrate to Zep?

| Feature | mem0 | Zep Cloud |
|---------|------|-----------|
| **Persistence** | In-app memory | Cloud database |
| **Scalability** | Single instance | Distributed |
| **HIPAA Compliance** | Partial | Full** |
| **Session Management** | Basic | Advanced |
| **API** | SDK-based | REST + SDK |
| **Audit Trails** | Limited | Comprehensive |
| **Encryption** | App-level | In-transit + at-rest |

---

## Prerequisites

✅ **Already Completed:**
- Zep Cloud account created
- `ZEP_API_KEY` in `.env` file
- Zep packages installed (`zep-cloud>=3.14.0`)
- Memory management module created

---

## Migration Architecture

### Before (mem0)
```
┌─────────────────────┐
│  Pixelated Empathy  │
│    Application      │
├─────────────────────┤
│   mem0-mcp-server   │
│   (Local Memory)    │
└─────────────────────┘
```

### After (Zep Cloud)
```
┌─────────────────────┐
│  Pixelated Empathy  │
│    Application      │
├─────────────────────┤
│  Zep Memory Manager │
├─────────────────────┤
│   Memory API Server │
│   (FastAPI:5003)    │
├─────────────────────┤
│   Zep Cloud API     │
│   (getzep.com)      │
└─────────────────────┘
```

---

## Step-by-Step Migration

### 1. Verify Zep Configuration

```bash
# Check Zep API key is set
echo $ZEP_API_KEY

# Test Zep connection
uv run python -c "
from zep_cloud import Zep
client = Zep(api_key='${ZEP_API_KEY}')
print('✓ Connected to Zep Cloud')
"
```

**Expected output:**
```
✓ Connected to Zep Cloud
```

### 2. Start Memory Server

```bash
# Terminal 1: Start Zep memory server
uv run python ai/api/mcp_server/memory_server.py

# Output should show:
# INFO: Uvicorn running on http://0.0.0.0:5003
```

### 3. Test Basic Operations

```bash
# Terminal 2: Test user creation
uv run python -c "
import os
from ai.api.memory import get_zep_manager
from zep_cloud import Zep

zep = Zep(api_key=os.environ['ZEP_API_KEY'])
mgr = get_zep_manager(zep)

# Create test user
user = mgr.create_user(
    email='test@pixelated.local',
    name='Test User'
)
print(f'✓ Created user: {user.get(\"user_id\")}')
"
```

### 4. Migrate User Data

#### Option A: Single User Migration

```bash
# Migrate specific user
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user mem0-user-123 \
  --session mem0-session-456
```

#### Option B: Bulk Migration from Export

```bash
# Export from mem0
mem0 export --format json > mem0-export.json

# Migrate bulk data
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --file mem0-export.json
```

#### Option C: Programmatic Migration

```python
import os
from zep_cloud import Zep
from ai.api.memory.mem0_migration import get_mem0_migrator

# Initialize
zep = Zep(api_key=os.environ['ZEP_API_KEY'])
migrator = get_mem0_migrator(zep)

# Migrate user
mem0_user = {
    "id": "user-123",
    "name": "Jane Doe",
    "email": "jane@example.com"
}

zep_user_id = migrator.migrate_user(mem0_user, role="patient")
print(f"Migrated: {mem0_user['id']} -> {zep_user_id}")

# Migrate conversation history
messages = [
    {"role": "user", "content": "I've been feeling anxious"},
    {"role": "therapist", "content": "Tell me more about that..."}
]

success = migrator.migrate_conversation_history(
    session_id=zep_user_id,
    mem0_messages=messages
)

# Get migration report
report = migrator.get_migration_report()
print(f"Users: {report['users_migrated']}, Memories: {report['memories_migrated']}")
```

### 5. Validate Migration

```bash
# Validate migrated data
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user zep-user-123 \
  --session zep-session-456 \
  --validate
```

**Check points:**
- ✓ User exists in Zep
- ✓ Session memory loaded
- ✓ Message count matches
- ✓ Timestamps preserved
- ✓ Metadata intact

---

## Data Mapping Reference

### User Role Mapping

| mem0 | Zep | Notes |
|------|-----|-------|
| `user` | `patient` | Individual receiving therapy |
| `therapist` | `therapist` | Licensed mental health professional |
| `admin` | `admin` | System administrator |
| `support` | `support` | Support staff |

### Message Role Mapping

| mem0 | Zep | Meaning |
|------|-----|---------|
| `user` | `user` | User input |
| `assistant` | `assistant` | AI response |
| `ai` | `assistant` | AI response |
| `system` | `system` | System/metadata |
| `therapist` | `user` | Therapist input (treated as user) |

### Memory Type Mapping

| mem0 | Zep | Description |
|------|-----|-------------|
| `messages` | `CONVERSATION` | Conversation history |
| `insights` | `EMOTIONAL_STATE` | Emotional insights |
| `summary` | `SESSION_SUMMARY` | Session summary |
| `traits` | `TREATMENT_PLAN` | Client traits → treatment |
| `preferences` | Metadata | Stored in message metadata |

---

## Migration Strategies

### Strategy 1: Parallel Run (Recommended)

Run both systems simultaneously during transition:

```python
# Configure in your application
MEMORY_BACKEND = "zep"  # Switch when ready
MEM0_FALLBACK = True    # Keep mem0 as backup temporarily

# Implementation
from ai.api.memory import get_zep_manager, get_memory_manager

try:
    # Try Zep first
    memory_mgr = get_memory_manager(zep_client)
    result = memory_mgr.add_message(...)
except Exception:
    if MEM0_FALLBACK:
        # Fall back to mem0 temporarily
        result = mem0_client.add(...) 
    else:
        raise
```

### Strategy 2: Phased Migration

**Phase 1: New users → Zep**
- New accounts created in Zep
- Existing users still on mem0

**Phase 2: Gradual User Migration**
- Migrate users in batches
- Validate each batch before moving to next
- Monitor error rates

**Phase 3: Archive mem0**
- Keep mem0 data for 30 days as backup
- Decommission mem0 after validation

### Strategy 3: One-Time Bulk Migration

- Export all mem0 data
- Validate completeness
- Bulk import to Zep
- Switch over immediately
- Keep mem0 archive for 90 days

---

## Troubleshooting

### Issue: "ZEP_API_KEY environment variable not set"

```bash
# Solution: Set the key in .env
echo "ZEP_API_KEY=your-key-from-getzep.com" >> .env

# Verify
source .env
echo $ZEP_API_KEY
```

### Issue: "Failed to connect to Zep"

```bash
# Check your API key is valid
# Log in to https://app.getzep.com and verify

# Test connection
uv run python -c "
from zep_cloud import Zep
try:
    z = Zep(api_key='YOUR_KEY')
    print('✓ Connected')
except Exception as e:
    print(f'✗ Error: {e}')
"
```

### Issue: Messages not appearing after migration

```bash
# Check memory was stored
uv run python -c "
from zep_cloud import Zep
z = Zep(api_key='...')
memory = z.memory.get('session-id', limit=50)
print(f'Messages in session: {len(memory.messages)}')
"

# Verify migration was successful
uv run python ai/scripts/migrate_mem0_to_zep.py \
  --user user-id \
  --validate
```

### Issue: Timeout during migration

```bash
# For large datasets, increase timeout
uv run python -c "
from zep_cloud import Zep
z = Zep(api_key='...', timeout=60)  # 60 second timeout
"

# Or migrate in smaller batches
uv run python -c "
from ai.api.memory.mem0_migration import get_mem0_migrator

migrator = get_mem0_migrator(zep)

# Process 100 messages at a time
batch_size = 100
for i in range(0, total_messages, batch_size):
    batch = messages[i:i+batch_size]
    migrator.migrate_conversation_history(session_id, batch)
    print(f'Migrated batch {i//batch_size + 1}')
"
```

---

## Validation Checklist

- [ ] Zep API key configured in `.env`
- [ ] Memory server running on port 5003
- [ ] Can create users in Zep
- [ ] Can store messages in Zep
- [ ] Can retrieve message history
- [ ] Timestamps preserved correctly
- [ ] User metadata migrated
- [ ] Message metadata intact
- [ ] No errors in logs
- [ ] Migration report shows 0 errors

---

## Post-Migration Tasks

### 1. Update Configuration

```bash
# Switch primary memory backend to Zep
# In ai/api/mcp_server/config.py

MEMORY_BACKEND = "zep"  # Was "mem0"
MEM0_ENABLED = False     # Disable mem0
```

### 2. Monitoring

```bash
# Monitor Zep usage
curl -X GET "http://localhost:5003/api/v1/health"

# Check memory stats
curl -X GET "http://localhost:5003/api/v1/memory/stats/session-id"
```

### 3. Decommission mem0

```bash
# Keep mem0 running for 30 days as backup
# After validation period, remove dependency

# Remove from pyproject.toml
# Remove from mcp_config.json
# Remove mem0-mcp-server package
```

---

## Next Steps

1. **Complete migration** using one of the strategies above
2. **Validate all data** is in Zep
3. **Monitor performance** - Zep should be faster
4. **Update documentation** with new memory system
5. **Train team** on new memory management APIs

---

## Migration API Reference

### Core Methods

```python
from ai.api.memory.mem0_migration import get_mem0_migrator
from zep_cloud import Zep

zep = Zep(api_key=os.environ['ZEP_API_KEY'])
migrator = get_mem0_migrator(zep)

# Migrate user
user_id = migrator.migrate_user(mem0_user_data, role="patient")

# Migrate conversation
success = migrator.migrate_conversation_history(session_id, messages)

# Migrate memory snapshot
success = migrator.migrate_memory_snapshot(
    session_id=session_id,
    memory_type="insights",
    content={"emotions": [...]}
)

# Validate
report = migrator.validate_migration(user_id, session_id)

# Get report
report = migrator.get_migration_report()
```

---

## Support & Resources

- **Zep Documentation:** https://help.getzep.com
- **Memory API Docs:** http://localhost:5003/docs (when server running)
- **Migration Tool Help:** `uv run python ai/scripts/migrate_mem0_to_zep.py --help`
- **Issues:** Check logs in `.env` LOG_LEVEL

---

**Last Updated:** January 2026  
**Status:** Production Ready ✓
