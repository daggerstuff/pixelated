#!/usr/bin/env tsx
/**
 * @file scripts/generate-memory-openapi.ts
 *
 * Generates an OpenAPI 3.1 spec YAML file from the Zod schemas in
 * src/lib/memory/contract/v1.ts and src/lib/memory/contract/errors.ts.
 *
 * Run: npx tsx scripts/generate-memory-openapi.ts
 * Output: docs/api/memory-v1.openapi.yaml
 *
 * This script imports the Zod schemas for type-level verification but
 * constructs the OpenAPI object explicitly (no zod-to-openapi dependency).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

// ---------------------------------------------------------------------------
// Import Zod schemas for type-level verification
// ---------------------------------------------------------------------------
import {
  MemoryScope,
  RetentionPolicy,
  MemoryApiScope,
  MemoryApiRole,
} from "../apps/web/src/lib/memory/contract/v1.js";

import { MemoryApiErrorCode } from "../apps/web/src/lib/memory/contract/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const OUTPUT = resolve(ROOT, "docs/api/memory-v1.openapi.yaml");

// ---------------------------------------------------------------------------
// Build the OpenAPI spec as a plain JSON object
// ---------------------------------------------------------------------------

function buildSpec(): Record<string, unknown> {
  // --- Enums ---
  const memoryScopeEnum = [...MemoryScope.options];
  const retentionPolicyEnum = [...RetentionPolicy.options];
  const memoryApiScopeEnum = [...MemoryApiScope.options];
  const memoryApiRoleEnum = [...MemoryApiRole.options];
  const errorCodeValues = Object.values(MemoryApiErrorCode);

  // --- Schema definitions ---
  const schemas: Record<string, unknown> = {
    MemoryScope: {
      type: "string",
      enum: memoryScopeEnum,
      description: "Logical lifecycle boundary of a memory.",
    },
    RetentionPolicy: {
      type: "string",
      enum: retentionPolicyEnum,
      description: "Retention / eviction policy.",
    },
    MemoryApiScope: {
      type: "string",
      enum: memoryApiScopeEnum,
      description: "API scope dimension.",
    },
    MemoryApiRole: {
      type: "string",
      enum: memoryApiRoleEnum,
      description: "Role within the workspace scope.",
    },
    IdentityScope: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace identifier.", minLength: 1 },
        userId: { type: "string", description: "User identifier.", minLength: 1 },
        scope: { $ref: "#/components/schemas/MemoryApiScope" },
        role: { $ref: "#/components/schemas/MemoryApiRole" },
      },
      additionalProperties: false,
      description: "Identity and scope envelope resolved from the authenticated session.",
    },
    PublicMemory: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid", description: "UUID v4 — globally unique." },
        content: {
          type: "string",
          description: "The memory content.",
          minLength: 1,
          maxLength: 64000,
        },
        scope: { $ref: "#/components/schemas/MemoryScope" },
        retention: { $ref: "#/components/schemas/RetentionPolicy" },
        category: {
          type: "string",
          description: "Free-form category for filtering.",
          minLength: 1,
          maxLength: 64,
        },
        tags: {
          type: "array",
          description: "Free-form tags for ad-hoc filtering.",
          items: { type: "string", minLength: 1, maxLength: 64 },
          maxItems: 64,
        },
        version: {
          type: "integer",
          description: "Monotonically increasing version counter.",
          minimum: 0,
        },
        importance: {
          type: "number",
          description: "Current importance score (0.0 → 1.0).",
          minimum: 0,
          maximum: 1,
        },
        createdAt: {
          type: "string",
          format: "date-time",
          description: "ISO 8601 — when this memory was first created.",
        },
        updatedAt: {
          type: "string",
          format: "date-time",
          nullable: true,
          description: "ISO 8601 — when this memory was last mutated.",
        },
      },
      additionalProperties: false,
      description: "A public memory record — strict subset of the internal UnifiedMemory type.",
    },
    Pagination: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Maximum items per page.", minimum: 1 },
        offset: { type: "integer", description: "Number of items skipped.", minimum: 0 },
        total: {
          type: "integer",
          description: "Total number of items matching the query.",
          minimum: 0,
        },
      },
      additionalProperties: false,
      description: "Pagination metadata.",
    },
    MemoryApiErrorCode: {
      type: "string",
      enum: errorCodeValues,
      description: "Stable machine-readable error codes.",
    },
    MemoryApiError: {
      type: "object",
      properties: {
        error: { type: "string", description: "Machine-readable error code.", minLength: 1 },
        message: { type: "string", description: "Human-readable error message.", minLength: 1 },
        code: {
          $ref: "#/components/schemas/MemoryApiErrorCode",
          description: "Canonical error code.",
        },
        details: {
          type: "object",
          description: "Additional error details.",
          additionalProperties: true,
        },
        requestId: { type: "string", description: "Request identifier for debugging." },
      },
      additionalProperties: false,
      description: "Canonical error envelope returned on failure.",
    },
    CreateMemoryRequest: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The memory content.",
          minLength: 1,
          maxLength: 64000,
        },
        scope: { $ref: "#/components/schemas/MemoryScope" },
        retention: { $ref: "#/components/schemas/RetentionPolicy" },
        category: {
          type: "string",
          description: "Free-form category.",
          minLength: 1,
          maxLength: 64,
        },
        tags: {
          type: "array",
          description: "Free-form tags.",
          items: { type: "string", minLength: 1, maxLength: 64 },
          maxItems: 64,
        },
        importance: {
          type: "number",
          description: "Initial importance score (0.0 → 1.0).",
          minimum: 0,
          maximum: 1,
        },
      },
      additionalProperties: false,
      required: ["content"],
      description: "Request body for creating a memory.",
    },
    UpdateMemoryRequest: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The memory content.",
          minLength: 1,
          maxLength: 64000,
        },
        scope: { $ref: "#/components/schemas/MemoryScope" },
        retention: { $ref: "#/components/schemas/RetentionPolicy" },
        category: {
          type: "string",
          description: "Free-form category.",
          minLength: 1,
          maxLength: 64,
        },
        tags: {
          type: "array",
          description: "Free-form tags.",
          items: { type: "string", minLength: 1, maxLength: 64 },
          maxItems: 64,
        },
        importance: {
          type: "number",
          description: "Updated importance score (0.0 → 1.0).",
          minimum: 0,
          maximum: 1,
        },
      },
      additionalProperties: false,
      required: ["content"],
      description: "Request body for updating a memory.",
    },
    SearchMemoriesRequest: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query string.", minLength: 1, maxLength: 1000 },
        limit: {
          type: "integer",
          description: "Maximum results to return.",
          minimum: 1,
          maximum: 100,
        },
        offset: { type: "integer", description: "Number of results to skip.", minimum: 0 },
      },
      additionalProperties: false,
      required: ["q"],
      description: "Request body for searching memories.",
    },
    CreateMemoryResponse: {
      type: "object",
      properties: {
        data: { $ref: "#/components/schemas/PublicMemory" },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for creating a memory.",
    },
    GetMemoryResponse: {
      type: "object",
      properties: {
        data: { $ref: "#/components/schemas/PublicMemory" },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for getting a memory.",
    },
    UpdateMemoryResponse: {
      type: "object",
      properties: {
        data: { $ref: "#/components/schemas/PublicMemory" },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for updating a memory.",
    },
    DeleteMemoryResponse: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Contains the id of the deleted memory.",
          properties: {
            id: { type: "string", format: "uuid", description: "UUID of the deleted memory." },
          },
          additionalProperties: false,
        },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for deleting a memory.",
    },
    ListMemoriesResponse: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "Array of memory records.",
          items: { $ref: "#/components/schemas/PublicMemory" },
        },
        pagination: { $ref: "#/components/schemas/Pagination" },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for listing memories.",
    },
    SearchMemoriesResponse: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "Array of matching memory records.",
          items: { $ref: "#/components/schemas/PublicMemory" },
        },
        query: { type: "string", description: "The search query that produced these results." },
        pagination: { $ref: "#/components/schemas/Pagination" },
        identity: { $ref: "#/components/schemas/IdentityScope" },
      },
      additionalProperties: false,
      description: "Response for searching memories.",
    },
  };

  // --- Helper to build a success response ---
  function successResponse(description: string, schemaName: string): Record<string, unknown> {
    return {
      description,
      headers: {
        "X-Memory-Contract-Version": {
          schema: { type: "string" },
          description: "The memory API contract version.",
        },
      },
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        },
      },
    };
  }

  // --- Helper to build an error response ---
  function errorResponse(description: string): Record<string, unknown> {
    return {
      description,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/MemoryApiError" },
        },
      },
    };
  }

  // --- Common gateway errors that apply to every endpoint ---
  const gatewayErrors: Record<string, Record<string, unknown>> = {
    "502": errorResponse("Upstream unavailable."),
    "504": errorResponse("Upstream timeout."),
  };

  // --- Paths ---
  const paths: Record<string, unknown> = {};

  // GET /api/v1/memory (List)
  paths["/api/v1/memory"] = {
    get: {
      operationId: "listMemories",
      summary: "List memories",
      description: "Retrieve a paginated list of memories for the authenticated user.",
      tags: ["Memory"],
      parameters: [
        {
          name: "limit",
          in: "query",
          description: "Maximum results to return (1-100).",
          schema: { type: "integer", minimum: 1, maximum: 100 },
          required: false,
        },
        {
          name: "offset",
          in: "query",
          description: "Number of results to skip.",
          schema: { type: "integer", minimum: 0 },
          required: false,
        },
        {
          name: "category",
          in: "query",
          description: "Filter by category.",
          schema: { type: "string", maxLength: 64 },
          required: false,
        },
        {
          name: "tags",
          in: "query",
          description: "Filter by tags (comma-separated or repeated).",
          schema: { type: "array", items: { type: "string" } },
          required: false,
        },
      ],
      responses: {
        "200": successResponse("Paginated list of memories.", "ListMemoriesResponse"),
        "400": errorResponse("Bad request."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
        ...gatewayErrors,
      },
    },
    post: {
      operationId: "createMemory",
      summary: "Create a memory",
      description: "Create a new memory record.",
      tags: ["Memory"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateMemoryRequest" },
          },
        },
      },
      responses: {
        "201": successResponse("Memory created successfully.", "CreateMemoryResponse"),
        "400": errorResponse("Bad request / validation failed."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "409": errorResponse("Conflict."),
        "413": errorResponse("Payload too large."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
        ...gatewayErrors,
      },
    },
  };

  // GET/PATCH/DELETE /api/v1/memory/{memoryId}
  const memoryIdPathParam = {
    name: "memoryId",
    in: "path",
    required: true,
    description: "UUID of the memory.",
    schema: { type: "string", format: "uuid" },
  };

  paths["/api/v1/memory/{memoryId}"] = {
    get: {
      operationId: "getMemory",
      summary: "Get a memory by ID",
      description: "Retrieve a single memory record by its UUID.",
      tags: ["Memory"],
      parameters: [memoryIdPathParam],
      responses: {
        "200": successResponse("Memory record.", "GetMemoryResponse"),
        "400": errorResponse("Bad request."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "404": errorResponse("Memory not found."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
      },
    },
    patch: {
      operationId: "updateMemory",
      summary: "Update a memory",
      description: "Update an existing memory record.",
      tags: ["Memory"],
      parameters: [memoryIdPathParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateMemoryRequest" },
          },
        },
      },
      responses: {
        "200": successResponse("Memory updated successfully.", "UpdateMemoryResponse"),
        "400": errorResponse("Bad request / validation failed."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "404": errorResponse("Memory not found."),
        "409": errorResponse("Conflict."),
        "413": errorResponse("Payload too large."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
      },
    },
    delete: {
      operationId: "deleteMemory",
      summary: "Delete a memory",
      description: "Delete a memory record by its UUID.",
      tags: ["Memory"],
      parameters: [memoryIdPathParam],
      responses: {
        "200": successResponse("Memory deleted successfully.", "DeleteMemoryResponse"),
        "400": errorResponse("Bad request."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "404": errorResponse("Memory not found."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
      },
    },
  };

  // GET/POST /api/v1/memory/search
  paths["/api/v1/memory/search"] = {
    get: {
      operationId: "searchMemoriesGet",
      summary: "Search memories (query string)",
      description: "Search memories using a query string parameter.",
      tags: ["Memory"],
      parameters: [
        {
          name: "q",
          in: "query",
          required: true,
          description: "Search query.",
          schema: { type: "string", minLength: 1, maxLength: 1000 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          description: "Maximum results to return (1-100).",
          schema: { type: "integer", minimum: 1, maximum: 100 },
        },
        {
          name: "offset",
          in: "query",
          required: false,
          description: "Number of results to skip.",
          schema: { type: "integer", minimum: 0 },
        },
      ],
      responses: {
        "200": successResponse("Search results.", "SearchMemoriesResponse"),
        "400": errorResponse("Bad request."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
      },
    },
    post: {
      operationId: "searchMemoriesPost",
      summary: "Search memories (JSON body)",
      description: "Search memories using a JSON request body.",
      tags: ["Memory"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SearchMemoriesRequest" },
          },
        },
      },
      responses: {
        "200": successResponse("Search results.", "SearchMemoriesResponse"),
        "400": errorResponse("Bad request / validation failed."),
        "401": errorResponse("Unauthorized."),
        "403": errorResponse("Forbidden."),
        "413": errorResponse("Payload too large."),
        "429": errorResponse("Rate limited."),
        "500": errorResponse("Internal server error."),
      },
    },
  };

  // --- Assemble the full spec ---
  return {
    openapi: "3.1.0",
    info: {
      title: "Pixelated Empathy Memory API",
      version: "1.0.0",
      description:
        "Public Memory API for Pixelated Empathy. See docs/api/memory-v1-contract.md for the full contract specification.",
    },
    servers: [
      {
        url: "https://api.pixelatedempathy.com",
        description: "Production",
      },
    ],
    paths,
    components: {
      securitySchemes: {
        SessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "session",
          description: "Session cookie for authentication.",
        },
      },
      schemas,
    },
    security: [{ SessionCookie: [] }],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const spec = buildSpec();
  const yaml = YAML.stringify(spec, { lineWidth: 120, indent: 2 });
  writeFileSync(OUTPUT, yaml, "utf-8");
  console.log(`✅ OpenAPI 3.1 spec written to ${OUTPUT}`);
}

main();
