# 🎯 ZEP INTEGRATION INDEX

**Quick access to all Zep Cloud integration resources**

---

## 📖 Documentation (Read These First)

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[ZEP_SETUP_GUIDE.md](ZEP_SETUP_GUIDE.md)** | Complete step-by-step setup instructions | 15 min |
| **[ZEP_INTEGRATION_SUMMARY.md](ZEP_INTEGRATION_SUMMARY.md)** | Features, architecture, quick start | 10 min |
| **[COMPLETION_REPORT.md](COMPLETION_REPORT.md)** | Full implementation details & verification | 10 min |

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Get Zep API key from https://www.getzep.com

# 2. Configure environment
cp .env.example .env
echo "ZEP_API_KEY=your-key-here" >> .env

# 3. Start memory server
uv run python ai/api/mcp_server/memory_server.py

# 4. Test installation
curl http://localhost:5003/health

# 5. Create a test user
curl -X POST http://localhost:5003/api/memory/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","role":"patient"}'
```

---

## 📁 Code Structure

### Memory Module
```
ai/api/memory/
├── __init__.py                  # Module exports
├── zep_user_manager.py          # User & session management
└── memory_manager.py            # Memory operations
```

### Memory Server
```
ai/api/mcp_server/
└── memory_server.py             # FastAPI server (18+ endpoints)
```

### Configuration
```
ai/pyproject.toml                # Added zep-cloud>=3.14.0
ai/api/mcp_server/config.py      # Added Zep configuration
mcp_config.json                  # Registered memory server
.env.example                     # Added Zep environment variables
```

---

## 🔑 Key Classes & Functions

### User Management
```python
from ai.api.memory import get_zep_manager, UserRole, UserStatus

# Initialize
manager = get_zep_manager(api_key="your-key")

# Create user
user = manager.create_user(
    email="patient@example.com",
    name="John Doe",
    role=UserRole.PATIENT
)

# Create session
session = manager.create_session(user.user_id)

# List sessions
sessions = manager.list_user_sessions(user.user_id)

# Close session
manager.close_session(session.session_id)
```

### Memory Operations
```python
from ai.api.memory import get_memory_manager, MemoryType, MessageRole

# Initialize
mem_manager = get_memory_manager(manager.client)

# Add message
mem_manager.add_message(
    user_id=user.user_id,
    session_id=session.session_id,
    content="I've been feeling anxious",
    role=MessageRole.USER,
    memory_type=MemoryType.CONVERSATION
)

# Get conversation history
messages = mem_manager.get_conversation_history(
    user_id=user.user_id,
    session_id=session.session_id
)

# Store emotional state
mem_manager.store_emotional_state(
    user_id=user.user_id,
    session_id=session.session_id,
    emotions={"anxiety": 0.7, "sadness": 0.3},
    context="Patient discussing work stress",
    triggers=["deadlines"]
)

# Get memory statistics
stats = mem_manager.get_memory_stats(session.session_id)
```

---

## 🔌 API Endpoints

### User Management
- `POST /api/memory/users` - Create user
- `GET /api/memory/users/{user_id}` - Get user profile
- `PUT /api/memory/users/{user_id}` - Update user
- `GET /api/memory/users/{user_id}/sessions` - List user sessions

### Session Management
- `POST /api/memory/sessions` - Create session
- `GET /api/memory/sessions/{session_id}` - Get session
- `POST /api/memory/sessions/{session_id}/close` - Close session

### Memory Operations
- `POST /api/memory/messages` - Add message to memory
- `GET /api/memory/conversations/{session_id}` - Get conversation history
- `POST /api/memory/sessions/{session_id}/summary` - Store session summary
- `GET /api/memory/sessions/{session_id}/emotional-state` - Get emotional state
- `POST /api/memory/sessions/{session_id}/emotional-state` - Store emotional state
- `GET /api/memory/sessions/{session_id}/treatment-plan` - Get treatment plan
- `POST /api/memory/sessions/{session_id}/treatment-plan` - Store treatment plan
- `GET /api/memory/sessions/{session_id}/stats` - Get memory statistics
- `POST /api/memory/sessions/{session_id}/clear` - Clear session memory (privacy)

### Health
- `GET /health` - Server health check

---

## 🧪 Verification

Run the automated verification script:
```bash
./verify-zep-integration.sh
```

Expected output:
```
✅ All checks passed!
  ✅ zep-cloud installed
  ✅ Memory modules available
  ✅ Configuration files updated
  ✅ Documentation complete
  ✅ File structure correct
```

---

## 📋 Environment Variables

```bash
# Required
ZEP_API_KEY=your-api-key-from-getzep

# Optional (with defaults)
ZEP_API_URL=https://api.getzep.com
ZEP_ENABLED=true
MEMORY_SERVER_PORT=5003
MEMORY_SERVER_HOST=0.0.0.0
MEMORY_CACHE_ENABLED=true
MEMORY_CACHE_TTL_SECONDS=3600
```

---

## 🐳 Docker Deployment

```bash
# Build image
docker build -f ai/Dockerfile -t pixelated-ai:latest .

# Run with Zep
docker run \
  -e ZEP_API_KEY=your-key \
  -p 5003:5003 \
  pixelated-ai:latest

# Docker Compose (see ZEP_SETUP_GUIDE.md)
docker-compose -f docker-compose.memory.yml up -d
```

---

## 📊 Features Summary

### ✅ User Management
- Create, read, update users
- Role-based access (patient, therapist, admin, support)
- User status tracking (active, inactive, suspended, deleted)
- Metadata and preferences storage
- Last login tracking

### ✅ Session Management
- Session creation and tracking
- Configurable session timeout
- Session expiration cleanup
- Multiple concurrent sessions per user
- IP and user-agent tracking

### ✅ Memory Operations
- Conversation history persistence
- Session summaries and notes
- Emotional state snapshots
- Treatment plan storage
- Progress tracking
- Memory statistics

### ✅ Security & Compliance
- HIPAA-compliant audit logging
- User data encryption support
- Session isolation
- No PII in logs
- Access control integration

---

## 🛠️ Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| API key not found | Check .env file and source it |
| Port 5003 refused | Verify server running, check firewall |
| Zep auth failed | Verify API key, check Zep status |
| Import errors | Run `uv pip install -e .` in ai/ directory |

See **ZEP_SETUP_GUIDE.md** for detailed troubleshooting.

---

## 📚 Additional Resources

- **Zep Cloud Docs:** https://docs.getzep.com
- **Zep Python SDK:** https://github.com/getzep/zep-python
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Model Context Protocol:** https://modelcontextprotocol.io

---

## ✨ Support

For comprehensive instructions: **ZEP_SETUP_GUIDE.md**  
For architecture overview: **ZEP_INTEGRATION_SUMMARY.md**  
For implementation details: **COMPLETION_REPORT.md**  
For verification: **verify-zep-integration.sh**

---

**Status:** ✅ Complete & Verified  
**Ready:** Yes - All systems operational  
**Last Updated:** January 9, 2026
