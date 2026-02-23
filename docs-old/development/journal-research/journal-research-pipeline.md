## Journal Dataset Research Pipeline - Unified System Documentation

## Overview

The Journal Dataset Research Pipeline is a comprehensive, integrated system for discovering, evaluating, acquiring, and integrating therapeutic datasets from academic sources. The pipeline consists of three tightly integrated components that work together to provide a complete research automation solution.

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Production Ready

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Journal Dataset Research Pipeline                 │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Web Frontend    │  │   MCP Server     │  │  CLI Interface   │  │
│  │  (Astro+React)   │  │  (AI Agents)     │  │  (Python CLI)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                      │                      │            │
│           │ HTTP/REST            │ MCP Protocol         │ Direct     │
│           │ WebSocket/SSE        │ (JSON-RPC)          │ Python API │
│           │                      │                      │            │
│           └──────────────────────┼──────────────────────┘            │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                    │
│                    │   FastAPI HTTP Server      │                    │
│                    │   (API Endpoints)          │                    │
│                    └─────────────┬─────────────┘                    │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                    │
│                    │  CommandHandlerService     │                    │
│                    │  (Service Layer)           │                    │
│                    └─────────────┬─────────────┘                    │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                    │
│                    │  Research Orchestrator     │                    │
│                    │  (Workflow Coordination)   │                    │
│                    └─────────────┬─────────────┘                    │
│                                  │                                    │
│           ┌──────────────────────┼──────────────────────┐            │
│           │                      │                      │            │
│  ┌────────▼────────┐  ┌──────────▼──────────┐  ┌───────▼────────┐   │
│  │ Discovery       │  │ Evaluation         │  │ Acquisition    │   │
│  │ Service        │  │ Engine             │  │ Manager        │   │
│  └────────────────┘  └────────────────────┘  └────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Integration Planning Engine                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Overview

### 1. Web Frontend (Astro + React)

**Location**: `src/pages/journal-research/`, `src/components/journal-research/`

**Purpose**: User-friendly web interface for managing research operations

**Features**:
- Dashboard with session overview and progress tracking
- Session management (create, view, update, delete)
- Source discovery interface
- Dataset evaluation interface
- Acquisition management
- Integration planning interface
- Real-time progress updates via WebSocket
- Report generation and viewing

**Technology Stack**:
- Astro 5.x for page routing
- React 19.x for interactive components
- Zustand for state management
- React Query for data fetching
- UnoCSS for styling
- WebSocket for real-time updates

**Access**: Navigate to `/journal-research` in the web application

### 2. MCP Server (Model Context Protocol)

**Location**: `ai/journal_dataset_research/mcp/`

**Purpose**: Expose research operations to AI agents via MCP protocol

**Features**:
- Tool-based interface for research operations
- Resource access for progress and metrics
- Prompt templates for workflow guidance
- Authentication and authorization
- Rate limiting and security
- Progress streaming for async operations

**Technology Stack**:
- Python with MCP protocol implementation
- JSON-RPC 2.0 for communication
- CommandHandlerService for backend integration

**Access**: Configure MCP client to connect to the server

### 3. Backend Research System (Python)

**Location**: `ai/journal_dataset_research/`

**Purpose**: Core research automation engine

**Components**:
- **Research Orchestrator**: Coordinates workflow phases
- **Discovery Service**: Searches academic sources (PubMed, DOAJ, repositories)
- **Evaluation Engine**: Assesses dataset quality and relevance
- **Acquisition Manager**: Handles dataset downloads and access requests
- **Integration Planning Engine**: Creates preprocessing plans
- **CLI Interface**: Command-line access to all operations

**Technology Stack**:
- Python 3.11+
- FastAPI for API server
- Pydantic for data validation
- Rich for CLI output

**Access**: 
- CLI: `python -m ai.journal_dataset_research.cli.entry_point`
- API: HTTP endpoints at `/api/journal-research`
- Direct Python API: Import and use classes directly

## Data Flow

### Creating a Research Session

1. **User Action**: Create session via web UI, MCP tool, or CLI
2. **API/MCP/CLI**: Request routed to CommandHandlerService
3. **CommandHandlerService**: Creates session via ResearchOrchestrator
4. **ResearchOrchestrator**: Initializes session state and storage
5. **Response**: Session data returned to requesting interface

### Discovery Workflow

1. **User Action**: Initiate discovery via any interface
2. **CommandHandlerService**: Calls orchestrator's discovery phase
3. **ResearchOrchestrator**: Coordinates DiscoveryService
4. **DiscoveryService**: 
   - Searches PubMed Central
   - Searches DOAJ journals
   - Queries repositories (Dryad, Zenodo, ClinicalTrials.gov)
   - Deduplicates and categorizes sources
5. **Progress Updates**: Streamed via WebSocket/MCP resources
6. **Results**: Sources stored in session, returned to interface

### Evaluation Workflow

1. **User Action**: Evaluate discovered sources
2. **CommandHandlerService**: Calls evaluation phase
3. **ResearchOrchestrator**: Coordinates EvaluationEngine
4. **EvaluationEngine**:
   - Assesses therapeutic relevance (1-10)
   - Evaluates data structure quality (1-10)
   - Checks training integration potential (1-10)
   - Verifies ethical accessibility (1-10)
   - Calculates overall score and priority tier
5. **Results**: Evaluations stored, displayed in interface

### Acquisition Workflow

1. **User Action**: Acquire high-priority datasets
2. **CommandHandlerService**: Calls acquisition phase
3. **ResearchOrchestrator**: Coordinates AcquisitionManager
4. **AcquisitionManager**:
   - Determines access method (direct, API, request form)
   - Downloads datasets securely
   - Verifies integrity (checksums)
   - Organizes storage
5. **Progress**: Download progress streamed in real-time
6. **Results**: Acquired datasets stored, metadata updated

### Integration Planning Workflow

1. **User Action**: Create integration plans for acquired datasets
2. **CommandHandlerService**: Calls integration phase
3. **ResearchOrchestrator**: Coordinates IntegrationPlanningEngine
4. **IntegrationPlanningEngine**:
   - Analyzes dataset structure
   - Maps fields to training pipeline schema
   - Estimates complexity (low, medium, high)
   - Generates preprocessing scripts
5. **Results**: Integration plans stored, scripts generated

## Session Storage

All three components share the same session storage:

**Location**: `ai/journal_dataset_research/sessions/` (configurable)

**Format**: JSON files, one per session

**Structure**:
- Session metadata (ID, dates, targets, keywords)
- Current phase and progress metrics
- Discovered sources
- Evaluations
- Acquisition records
- Integration plans
- Activity logs

**Access**: All components read/write to the same storage directory, ensuring consistency across interfaces.

## Configuration

### Shared Configuration

All components use consistent configuration for:
- Session storage path
- API base URLs
- Authentication settings
- Logging levels

### Environment Variables

**API Server** (`ai/journal_dataset_research/api/config.py`):
- `HOST`, `PORT` - Server configuration
- `CORS_ORIGINS` - Allowed frontend origins
- `JWT_SECRET` - Authentication secret
- `SESSION_STORAGE_PATH` - Session storage location

**MCP Server** (`ai/journal_dataset_research/mcp/config.py`):
- `MCP_HOST`, `MCP_PORT` - Server configuration
- `MCP_AUTH_ENABLED` - Authentication toggle
- `SESSION_STORAGE_PATH` - Must match API server

**Frontend** (`src/config/env.config.ts`):
- `PUBLIC_JOURNAL_RESEARCH_API_URL` - API server URL

**CLI** (`ai/journal_dataset_research/cli/config.py`):
- `SESSION_STORAGE_PATH` - Must match other components

## Authentication & Authorization

### Web Frontend
- Uses platform authentication (Better Auth or Supabase)
- JWT tokens passed to API server
- Role-based access control (RBAC)

### MCP Server
- API key or JWT token authentication
- RBAC for tool access
- Configurable per-tool permissions

### API Server
- JWT token validation
- RBAC middleware
- Permission-based endpoint access

### CLI
- No authentication (local execution)
- File system permissions control access

## Real-Time Updates

### WebSocket (Web Frontend)

**Endpoint**: `ws://api/journal-research/ws/progress/{session_id}`

**Message Types**:
- `progress_update` - Progress metrics changed
- `status_update` - Session status changed
- `notification` - Important events

**Implementation**: `src/lib/hooks/journal-research/useWebSocket.ts`

### MCP Resources (MCP Server)

**Resources**:
- `progress://metrics/{session_id}` - Current progress metrics
- `progress://history/{session_id}` - Progress history
- `session://state/{session_id}` - Session state

**Implementation**: `ai/journal_dataset_research/mcp/resources/`

### Progress Streaming

All components use the same progress tracking system:
- ResearchOrchestrator maintains progress state
- Updates broadcast via WebSocket manager
- MCP resources query orchestrator directly
- Frontend subscribes to WebSocket updates

## Error Handling

### Consistent Error Responses

All interfaces return errors in a consistent format:

```json
{
  "detail": "Error message",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

### Error Propagation

1. **Backend Error**: ResearchOrchestrator raises exception
2. **Service Layer**: CommandHandlerService catches and formats
3. **Interface Layer**: API/MCP/CLI formats for interface
4. **User Interface**: Displays user-friendly error message

### Recovery Strategies

- **Retry Logic**: Automatic retries with exponential backoff
- **Checkpointing**: Session state saved at each phase
- **Resume Capability**: Can resume interrupted workflows
- **Error Logging**: All errors logged for debugging

## Deployment

### Development

```bash
# Start API server
uv run python -m ai.journal_dataset_research.api.server

# Start frontend dev server
pnpm dev

# MCP server (if testing with AI agents)
uv run python -m ai.journal_dataset_research.mcp.server
```

### Production

See deployment guides:
- `docs/guides/technical-guides/deployment/journal-research-deployment.md` - API server
- `docs/guides/technical-guides/deployment/mcp-server-deployment.md` - MCP server
- Frontend deployed with main application

### Docker

```bash
# API server
docker-compose -f docker/journal-research-api/docker-compose.yml up -d

# MCP server
docker-compose -f docker/journal-research-mcp-server/docker-compose.yml up -d
```

## Testing

### Unit Tests

```bash
# Backend tests
uv run pytest ai/journal_dataset_research/tests/

# MCP tests
uv run pytest ai/journal_dataset_research/tests/mcp/

# Frontend tests
pnpm test:all
```

### Integration Tests

- Backend ↔ MCP: `tests/mcp/test_integration_server.py`
- Backend ↔ API: API endpoint tests
- API ↔ Frontend: E2E tests

### End-to-End Tests

Full workflow tests verify:
- Session creation across all interfaces
- Discovery operation completion
- Evaluation and acquisition workflows
- Integration planning
- Report generation

## Monitoring & Logging

### Logging

All components use consistent logging:
- **Backend**: Python logging to files
- **API Server**: FastAPI logging middleware
- **MCP Server**: MCP-specific audit logs
- **Frontend**: Browser console + error tracking

### Health Checks

- **API Server**: `GET /health`
- **MCP Server**: MCP protocol health check
- **Frontend**: Component error boundaries

### Metrics

Tracked metrics:
- Session creation rate
- Discovery success rate
- Evaluation completion time
- Acquisition success rate
- Integration plan generation time

## Troubleshooting

### Common Issues

**Session Not Found**:
- Verify session storage path is consistent across components
- Check file permissions on session directory
- Ensure session ID is correct

**WebSocket Connection Failed**:
- Verify API server is running
- Check CORS configuration
- Verify authentication token is valid

**MCP Tool Execution Failed**:
- Check CommandHandlerService connection
- Verify session storage path matches
- Check authentication and permissions

**Frontend API Errors**:
- Verify `PUBLIC_JOURNAL_RESEARCH_API_URL` is set correctly
- Check API server is accessible
- Verify authentication token is included

### Debug Mode

Enable debug logging:
- **API Server**: Set `DEBUG=true`
- **MCP Server**: Set `MCP_DEBUG=true`
- **Frontend**: Check browser DevTools console

## Related Documentation

- [API Documentation](./api/journal-research-api.md) - Detailed API reference
- [MCP Server Documentation](./api/mcp-server/README.md) - MCP server guide
- [User Guide](./user-guides/journal-research-guide.md) - End-user documentation
- [Deployment Guide](./deployment/journal-research-deployment.md) - Deployment instructions
- [Component Documentation](./components/journal-research-components.md) - Frontend components

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review component-specific documentation
3. Check logs for error details
4. Open an issue with system information

---

**Document Version**: 1.0.0  
**Last Updated**: January 2025  
**Maintained By**: Pixelated Empathy Team

