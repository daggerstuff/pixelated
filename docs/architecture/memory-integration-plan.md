# Frontend & Platform Integration Plan: Mem0 + Gemini + MCP

## Overview

This document outlines the strategy for integrating the `mem0+Gemini` memory system into the Pixelated Empathy platform.
The core goal is to enable **Long-Term Memory**, **PII Filtering**, and **Crisis Detection** across the application stack.

## Components

1. **Backend (MCP Server)**: `ai/api/mcp_server/memory_server.py`
   * **Role**: Central memory authority.
   * **Status**: Updated to use `GeminiMem0Manager` (with PII/Safety filters).
   * **Endpoints**: `/api/memory/add`, `/api/memory/search`, etc.

2. **Platform Logic**: `ai/api/pixel_inference_service.py`
   * **Role**: Main conversational intelligence (Pixel Model).
   * **Status**: Currently uses mock `PixelBaseModel`. Needs update to use `GeminiMem0Manager` for generation.

3. **Frontend Service**: `src/lib/pixel-conversation-integration.ts`
   * **Role**: Orchestrates chat on the client-side.
   * **Status**: Sends `conversation_history` to `infer` endpoint.

4. **Frontend Client**: `src/lib/memory/mem0-platform-client.ts`
   * **Role**: Handles direct memory operations (View/Edit/Delete) for the Dashboard.
   * **Status**: Includes `MCPMemoryClient` which is compatible with the Memory Server.

## Integration Strategy

### 1. Unified Memory Backend

The `PixelInferenceService` should become the primary consumer of `GeminiMem0Manager` for conversational context.

* **Action**: Update `PixelInferenceEngine` in `pixel_inference_service.py`.
* **Logic**:
  1. Initialize `GeminiMem0Manager` on startup.
  2. In `generate_response`:
     * Call `manager.search_memories(query, user_id)` to get relevant context.
     * Inject memories into the prompt/context.
     * Generate response (using Gemini or Pixel model).
     * Call `manager.add_memory(interaction, user_id)` to store the turn (with PII filtering).

### 2. Frontend Chat Integration (`PixelConversationIntegration`)

The frontend service requires minimal changes if the backend handles memory state.

* **Current Flow**: `User Input -> local conversationHistory -> /infer endpoint`.
* **Proposed Flow**:
  * `User Input -> /infer endpoint`.
  * Backend `GeminiMem0Manager` retrieves long-term memory + session history.
  * Backend generates response.
  * Frontend updates local state.

* **Visualizing Memory**:
  * Use `MCPMemoryClient` in `PixelConversationIntegration` to fetch "relevant memories" for the *current* turn and display them in a "Memory Context" sidebar (optional but helpful for trainees).

### 3. Dashboard Integration

The Memory Dashboard should use `MCPMemoryClient` to manage the user's long-term data.

* **Action**: Configure `MemoryDashboard.tsx` to use `MCPMemoryClient` when `USE_MCP_SERVER=true`.
* **Config**: Ensure `NEXT_PUBLIC_MCP_SERVER_URL` (or equivalent) points to `http://localhost:5003`.

## Data Flow Diagram

```mermaid
graph TD
    User[User] -->|Chat Input| FE[Frontend (PixelConversationIntegration)]
    FE -->|/infer request| API[Pixel Inference Service]
    FE -->|Manage Memories| MCP_Client[MCPMemoryClient]

    MCP_Client -->|HTTP| MCP_Server[MCP Memory Server]
    API -->|Internal Call| Manager[GeminiMem0Manager]
    MCP_Server -->|Internal Call| Manager

    Manager -->|Store/Retrieve| Mem0[Mem0 Vector Store]
    Manager -->|Filter/Generate| Gemini[Google Gemini API]
```

## Implementation Steps

1. **Verify MCP Server**: Ensure `memory_server.py` is running and accessible.
   * Command: `uv run ai/api/mcp_server/memory_server.py`
2. **Update Pixel Service**: Refactor `PixelInferenceService` to import and use `GeminiMem0Manager`.
3. **Frontend Config**: Update `.env.local` to point to the correct memory server URL.
4. **Test**:
   * Send a chat message with PII (e.g. "My phone is 555-0199").
   * Verify PII is redacted in storage (via `MCPMemoryClient.searchMemories`).
   * Verify the AI remembers the context in the next turn.

## Environment Variables

Ensure these are set for both Backend and Frontend (if using SSR):

* `GEMINI_API_KEY`: Required for PII filtering/Generation.
* `MEM0_API_KEY`: Required for Vector Storage.
* `MEMORY_SERVER_PORT`: Default `5003`.
* `PIXEL_API_PORT`: Default `8001`.
