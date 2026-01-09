"""
ZEP INTEGRATION SETUP GUIDE

This document provides comprehensive instructions for setting up Zep Cloud
user management and memory system integration with the MCP server.
"""

# ============================================================================
# STEP 1: INSTALL DEPENDENCIES
# ============================================================================

# The zep-cloud package has already been added to pyproject.toml
# To complete the installation, run:

# From the ai/ directory:
cd ai
uv install

# This will install:
# - zep-cloud>=1.2.0
# - All other AI/ML dependencies

# ============================================================================
# STEP 2: CONFIGURE ZEP CLOUD CREDENTIALS
# ============================================================================

# 1. Sign up for Zep Cloud at: https://www.getzep.com
# 2. Create an API key from the dashboard
# 3. Copy your API key to .env file:

# Edit .env (or create from .env.example):
cat > .env << 'EOF'
# Zep Cloud Configuration
ZEP_API_KEY=your-api-key-from-getzep-dashboard
ZEP_API_URL=https://api.getzep.com
ZEP_ENABLED=true

# Memory Server
MEMORY_SERVER_PORT=5003
MEMORY_SERVER_HOST=0.0.0.0

# MCP Server
MCP_PORT=5001
MCP_HOST=0.0.0.0
MCP_ENV=development
EOF

# ============================================================================
# STEP 3: VERIFY INSTALLATION
# ============================================================================

# Test that zep-cloud is properly installed:
cd /home/vivi/pixelated/ai
uv run python -c "from zep_cloud import ZepClient; print('✓ zep-cloud installed successfully')"

# ============================================================================
# STEP 4: START THE MEMORY SERVER
# ============================================================================

# Option A: Start memory server in isolation
cd /home/vivi/pixelated
uv run python ai/api/mcp_server/memory_server.py

# Option B: Start with uvicorn (recommended for production)
cd /home/vivi/pixelated
uv run uvicorn ai.api.mcp_server.memory_server:app \
    --host 0.0.0.0 \
    --port 5003 \
    --reload

# Option C: Start via MCP configuration
# The memory server will be automatically started by the MCP config
# when using: mcp_config.json

# ============================================================================
# STEP 5: TEST THE INTEGRATION
# ============================================================================

# 5.1 Check memory server health
curl http://localhost:5003/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "pixelated-memory-server",
#   "timestamp": "2026-01-09T..."
# }

# 5.2 Create a test user
curl -X POST http://localhost:5003/api/memory/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "role": "patient",
    "metadata": {"test": true}
  }'

# Expected response:
# {
#   "success": true,
#   "user_id": "uuid-here",
#   "email": "test@example.com",
#   "name": "Test User",
#   "role": "patient",
#   "created_at": "2026-01-09T..."
# }

# 5.3 Create a session
curl -X POST http://localhost:5003/api/memory/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid-from-previous-response",
    "ip_address": "127.0.0.1",
    "timeout_minutes": 30
  }'

# Expected response:
# {
#   "success": true,
#   "session_id": "session-uuid",
#   "user_id": "user-uuid",
#   "created_at": "2026-01-09T...",
#   "expires_at": "2026-01-09T..."
# }

# 5.4 Add message to memory
curl -X POST http://localhost:5003/api/memory/messages \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "session_id": "session-uuid",
    "content": "Test message",
    "role": "user",
    "memory_type": "conversation",
    "metadata": {"test": true}
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Message added to memory"
# }

# 5.5 Retrieve conversation history
curl http://localhost:5003/api/memory/conversations/session-uuid?limit=10

# Expected response:
# {
#   "success": true,
#   "session_id": "session-uuid",
#   "messages": [
#     {
#       "content": "Test message",
#       "role": "user",
#       "timestamp": "2026-01-09T...",
#       "metadata": {"test": true}
#     }
#   ]
# }

# ============================================================================
# STEP 6: INTEGRATE WITH MCP SERVER
# ============================================================================

# The MCP server (memory_server.py) provides these main components:

# A. User Management Endpoints:
#    POST   /api/memory/users                    - Create user
#    GET    /api/memory/users/{user_id}          - Get user
#    PUT    /api/memory/users/{user_id}          - Update user
#    GET    /api/memory/users/{user_id}/sessions - List sessions

# B. Session Management Endpoints:
#    POST   /api/memory/sessions                 - Create session
#    GET    /api/memory/sessions/{session_id}    - Get session
#    POST   /api/memory/sessions/{session_id}/close - Close session

# C. Memory Operations Endpoints:
#    POST   /api/memory/messages                          - Add message
#    GET    /api/memory/conversations/{session_id}        - Get history
#    POST   /api/memory/sessions/{session_id}/summary      - Store summary
#    GET    /api/memory/sessions/{session_id}/emotional-state  - Get emotions
#    POST   /api/memory/sessions/{session_id}/emotional-state  - Store emotions
#    GET    /api/memory/sessions/{session_id}/treatment-plan   - Get plan
#    POST   /api/memory/sessions/{session_id}/treatment-plan   - Store plan
#    GET    /api/memory/sessions/{session_id}/stats       - Get stats

# ============================================================================
# STEP 7: ENVIRONMENT VARIABLES REFERENCE
# ============================================================================

ZEP_API_KEY
  - Your Zep Cloud API key from dashboard
  - Required: Yes
  - Default: None

ZEP_API_URL
  - Custom Zep API endpoint
  - Required: No
  - Default: https://api.getzep.com

ZEP_ENABLED
  - Enable/disable Zep integration
  - Required: No
  - Default: true

MEMORY_SERVER_PORT
  - Port for memory server
  - Required: No
  - Default: 5003

MEMORY_SERVER_HOST
  - Host for memory server
  - Required: No
  - Default: 0.0.0.0

MEMORY_CACHE_ENABLED
  - Enable in-memory caching
  - Required: No
  - Default: true

MEMORY_CACHE_TTL_SECONDS
  - Cache time-to-live
  - Required: No
  - Default: 3600

MCP_ENV
  - Environment: development, production, testing
  - Required: No
  - Default: development

MCP_PORT
  - MCP server port
  - Required: No
  - Default: 5001

MCP_HOST
  - MCP server host
  - Required: No
  - Default: 0.0.0.0

# ============================================================================
# STEP 8: DOCKER DEPLOYMENT
# ============================================================================

# Build with memory server support:
docker build -f ai/Dockerfile -t pixelated-ai:latest .

# Run with Zep integration:
docker run -e ZEP_API_KEY=your-key \
           -e MEMORY_SERVER_PORT=5003 \
           -p 5003:5003 \
           pixelated-ai:latest

# Docker Compose example:
cat > docker-compose.memory.yml << 'EOF'
version: '3.8'

services:
  pixelated-memory:
    build:
      context: .
      dockerfile: ai/Dockerfile
    environment:
      - ZEP_API_KEY=${ZEP_API_KEY}
      - ZEP_API_URL=https://api.getzep.com
      - MEMORY_SERVER_PORT=5003
      - MEMORY_SERVER_HOST=0.0.0.0
      - LOG_LEVEL=INFO
    ports:
      - "5003:5003"
    depends_on:
      - redis
    healthcheck:
      test: `["CMD", "curl", "-f", "http://localhost:5003/health"]`
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
EOF

# Start services:
docker-compose -f docker-compose.memory.yml up -d

# ============================================================================
# STEP 9: MONITORING AND LOGGING
# ============================================================================

# View memory server logs:
docker-compose -f docker-compose.memory.yml logs -f pixelated-memory

# Monitor memory server performance:
curl http://localhost:5003/api/memory/sessions/session-id/stats

# Check health status:
curl http://localhost:5003/health

# ============================================================================
# STEP 10: PRODUCTION DEPLOYMENT
# ============================================================================

# Production checklist:
# ✓ Set MCP_ENV=production
# ✓ Set secure MCP_SECRET_KEY
# ✓ Set secure JWT_SECRET_KEY
# ✓ Set secure ZEP_API_KEY from Secrets Manager
# ✓ Enable audit logging: ENABLE_AUDIT_LOGGING=true
# ✓ Enable encryption: ENCRYPT_SENSITIVE_DATA=true
# ✓ Configure backup for session data
# ✓ Setup monitoring and alerting
# ✓ Enable rate limiting

# Production environment file:
cat > .env.production << 'EOF'
MCP_ENV=production
MCP_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
ZEP_API_KEY=<from-aws-secrets-manager>
ZEP_ENABLED=true
ENABLE_AUDIT_LOGGING=true
ENCRYPT_SENSITIVE_DATA=true
MEMORY_SERVER_PORT=5003
MEMORY_CACHE_ENABLED=true
LOG_LEVEL=INFO
EOF

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

# Issue: "ZEP_API_KEY environment variable not set"
# Solution: 
#   1. Check .env file has ZEP_API_KEY=<your-key>
#   2. Load environment: source .env
#   3. Verify: echo $ZEP_API_KEY

# Issue: Connection refused on port 5003
# Solution:
#   1. Check port is not in use: lsof -i :5003
#   2. Check firewall rules
#   3. Verify service is running: curl http://localhost:5003/health

# Issue: Zep API authentication failed
# Solution:
#   1. Verify API key is correct (no trailing spaces)
#   2. Check Zep Cloud dashboard for key status
#   3. Regenerate key if needed

# Issue: Memory operations returning 500 errors
# Solution:
#   1. Check Zep API status at https://status.getzep.com
#   2. Review logs: docker-compose logs -f pixelated-memory
#   3. Verify network connectivity to Zep API

# ============================================================================
# API EXAMPLES
# ============================================================================

# Python client example:
from ai.api.memory import get_zep_manager, get_memory_manager
import os

# Initialize
api_key = os.environ.get("ZEP_API_KEY")
manager = get_zep_manager(api_key=api_key)

# Create user
user = manager.create_user(
    email="patient@example.com",
    name="John Doe",
    role="patient"
)

# Create session
session = manager.create_session(user.user_id)

# Add memory message
mem_manager = get_memory_manager(manager.client)
mem_manager.add_message(
    user_id=user.user_id,
    session_id=session.session_id,
    content="I've been feeling anxious lately",
    role="user"
)

# Get conversation history
history = mem_manager.get_conversation_history(
    user_id=user.user_id,
    session_id=session.session_id
)

# Store emotional state
mem_manager.store_emotional_state(
    user_id=user.user_id,
    session_id=session.session_id,
    emotions={"anxiety": 0.7, "sadness": 0.3},
    context="Patient discussing workplace stress",
    triggers=`["work deadlines", "meetings"]`
)

# Get memory statistics
stats = mem_manager.get_memory_stats(session.session_id)
print(f"Total messages: {stats`['total_messages']`}")

# ============================================================================
# REFERENCE DOCUMENTATION
# ============================================================================

# Zep Cloud Documentation:
# https://docs.getzep.com

# Zep Python SDK:
# https://github.com/getzep/zep-python

# Model Context Protocol:
# https://modelcontextprotocol.io

# FastAPI Documentation:
# https://fastapi.tiangolo.com

# ============================================================================
