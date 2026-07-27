/**
 * Schema types derived from the OpenAPI specification.
 *
 * Source: /src/pages/docs/api/_openapi.yaml
 *
 * These types are manually curated to match the OpenAPI schemas. In a fully
 * automated pipeline they would be regenerated from the spec via
 * `scripts/ci/generate-sdks.sh`.
 */

import type { QueryParamValue } from "./client.js";

// ──────────────────────────────────────────────────────────────────────────
// System
// ──────────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime?: number;
}

export interface VersionInfo {
  version: string;
  build: string;
  timestamp?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────────────────────────────────

export interface ErrorResponse {
  error?: string;
  message?: string;
  code?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Content / Search
// ──────────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  type: string;
  score: number;
}

export interface SearchContentResponse {
  results: SearchResult[];
}

// ──────────────────────────────────────────────────────────────────────────
// User
// ──────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  fullName?: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  createdAt: string;
  lastLogin?: string;
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
}

export interface UserProfileUpdate {
  fullName?: string;
  avatarUrl?: string;
  userMetadata?: Record<string, unknown>;
}

export interface UserProfileResponse {
  profile: UserProfile;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
}

export interface UserPreferencesUpdate {
  theme?: string;
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
}

export interface UserPreferencesResponse {
  preferences: UserPreferences;
}

// ──────────────────────────────────────────────────────────────────────────
// Bias Analysis
// ──────────────────────────────────────────────────────────────────────────

export interface BiasAnalysisRequest {
  text: string;
  context?: string;
  therapistId?: string;
  sessionId?: string;
  clientId?: string;
  demographics?: Record<string, unknown>;
  sessionType?: string;
  therapistNotes?: string;
}

export interface BiasDetection {
  type: string;
  confidence: number;
  evidence: string;
  suggestion: string;
}

export interface BiasAnalysisResult {
  id: string;
  biases: BiasDetection[];
  overallScore: number;
  recommendations: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Memory
// ──────────────────────────────────────────────────────────────────────────

export interface ProductMemoryRecord {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryTurnCreate {
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySession {
  id: string;
  turns: MemoryTurn[];
  metadata?: Record<string, unknown>;
}

export interface ListMemoriesParams {
  limit?: number;
  offset?: number;
  userId?: string;
  category?: string;
  tag?: string | string[];
  [key: string]: QueryParamValue | undefined;
}

export interface ListMemoriesResponse {
  success: boolean;
  memories: ProductMemoryRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface CreateMemoryRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMemoryResponse {
  success: boolean;
  memory_id: string;
  memory: ProductMemoryRecord;
}

export interface GetMemoryResponse {
  success: boolean;
  memory: ProductMemoryRecord;
}

export interface UpdateMemoryRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryResponse {
  success: boolean;
  memory: ProductMemoryRecord;
}

export interface SearchMemoriesParams {
  q: string;
  limit?: number;
  offset?: number;
  userId?: string;
  [key: string]: QueryParamValue | undefined;
}

export interface SearchMemoriesPostRequest {
  query: string;
  limit?: number;
  offset?: number;
  userId?: string;
}

export interface SearchMemoriesResponse {
  success: boolean;
  memories: ProductMemoryRecord[];
  query: string;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  user?: {
    id: string;
    role: string;
  };
}

export interface MemoryStatsResponse {
  success: boolean;
  stats: {
    totalMemories: number;
    categoryCounts: Record<string, number>;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Developer API Keys
// ──────────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  created: string;
  expires?: string;
  scopes: string[];
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
}

export interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  created: string;
}

export interface ListApiKeysResponse {
  keys: ApiKey[];
}

// ──────────────────────────────────────────────────────────────────────────
// Admin
// ──────────────────────────────────────────────────────────────────────────

export interface AdminUserView {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListAdminUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
  [key: string]: QueryParamValue | undefined;
}

export interface ListAdminUsersResponse {
  data: AdminUserView[];
  pagination: Pagination;
}
