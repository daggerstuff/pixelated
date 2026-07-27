/**
 * Pixelated Empathy SDK
 * Official JavaScript/TypeScript SDK for the Pixelated Empathy API
 */
import { z } from "zod";
import { ForesightClient } from "./foresight";
export { ForesightClient, ForesightClientError, ForesightClientConfig, ForesightMemory, StoreMemoryInput, StoreMemoryOutput, GetMemoryInput, QueryMemoriesInput, ListMemoriesInput, ListMemoriesOutput, UpdateMemoryInput, DeleteMemoryInput, DeleteMemoryOutput, MemoryScope, RetentionPolicy, type UnifiedMemory, } from "./foresight";
export interface PixelatedConfig {
    baseUrl?: string;
    apiKey?: string;
    jwt?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}
export interface UserProfile {
    id: string;
    fullName?: string;
    email: string;
    role: string;
    avatarUrl?: string;
    createdAt: string;
    lastLogin?: string;
}
export declare const UserProfileSchema: z.ZodType<UserProfile>;
export declare const HealthSchema: z.ZodObject<{
    status: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodString;
    uptime: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const VersionSchema: z.ZodObject<{
    version: z.ZodString;
    build: z.ZodString;
    commit: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ApiKeyElementSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    key_prefix: z.ZodString;
    scopes: z.ZodArray<z.ZodString>;
    is_active: z.ZodBoolean;
    created_at: z.ZodString;
    expires_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_used_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const ApiKeyListSchema: z.ZodObject<{
    keys: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        key_prefix: z.ZodString;
        scopes: z.ZodArray<z.ZodString>;
        is_active: z.ZodBoolean;
        created_at: z.ZodString;
        expires_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        last_used_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ApiKeyCreateSchema: z.ZodObject<{
    key: z.ZodString;
    id: z.ZodString;
}, z.core.$strip>;
export declare const ApiKeyRevokeSchema: z.ZodOptional<z.ZodObject<{}, z.core.$strip>>;
export interface SearchResult {
    id: string;
    title: string;
    excerpt: string;
    url: string;
    type: string;
    score: number;
}
export declare const SearchResultSchema: z.ZodType<SearchResult>;
export interface BiasAnalysisParams {
    text: string;
    context?: string;
    therapistId?: string;
    sessionId?: string;
    clientId?: string;
    demographics?: Record<string, any>;
    sessionType?: string;
    therapistNotes?: string;
}
export interface BiasAnalysisResult {
    id: string;
    biases: Array<{
        type: string;
        confidence: number;
        evidence: string;
        suggestion: string;
    }>;
    overallScore: number;
    recommendations: string[];
}
export declare const BiasAnalysisResultSchema: z.ZodType<BiasAnalysisResult>;
export interface UserPreferences {
    theme?: "light" | "dark" | "system";
    language?: string;
    timezone?: string;
    notifications?: {
        email?: boolean;
        push?: boolean;
    };
}
export declare const UserPreferencesSchema: z.ZodType<UserPreferences>;
export interface MemoryTurn {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}
export declare const MemoryTurnSchema: z.ZodType<MemoryTurn>;
export interface MemorySession {
    id: string;
    turns: MemoryTurn[];
    metadata?: Record<string, any>;
}
export declare const MemorySessionSchema: z.ZodType<MemorySession>;
export interface RateLimitError extends Error {
    retryAfter: number;
    limit: number;
    remaining: number;
    resetTime: number;
}
export interface ApiError extends Error {
    status: number;
    code: string;
    details?: any;
}
export declare class PixelatedClient {
    private readonly baseUrl;
    private readonly apiKey?;
    private readonly jwt?;
    private readonly timeout;
    private readonly maxRetries;
    private readonly retryDelay;
    constructor(config?: PixelatedConfig);
    /**
     * Internal helper for API requests with retry logic
     */
    private request;
    private parseResponse;
    private sleep;
    /**
     * Bias Analysis API
     */
    get biasAnalysis(): {
        /**
         * Perform bias analysis on clinical text
         */
        analyze: (params: BiasAnalysisParams) => Promise<BiasAnalysisResult>;
    };
    /**
     * User API
     */
    get user(): {
        /**
         * Get the current user profile
         */
        getProfile: () => Promise<UserProfile>;
        /**
         * Update the current user profile
         */
        updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
        /**
         * Get user preferences
         */
        getPreferences: () => Promise<UserPreferences>;
        /**
         * Update user preferences
         */
        updatePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences>;
    };
    /**
     * Search API
     */
    get search(): {
        /**
         * Search content
         */
        query: (query: string, filters?: {
            type?: string;
            limit?: number;
        }) => Promise<SearchResult[]>;
    };
    /**
     * Memory/Sessions API
     */
    get memory(): {
        /**
         * Get a session by ID
         */
        getSession: (sessionId: string) => Promise<MemorySession>;
        /**
         * Create a new turn in a session
         */
        addTurn: (sessionId: string, turn: Omit<MemoryTurn, "id" | "timestamp">) => Promise<MemoryTurn>;
        /**
         * List sessions
         */
        listSessions: (params?: {
            limit?: number;
            offset?: number;
        }) => Promise<MemorySession[]>;
    };
    /**
     * Foresight memory client (typed memory operations via Foresight gateway)
     */
    get foresight(): ForesightClient;
    /**
     * Developer memory client (external developer API surface)
     *
     * Targets `/api/v1/developer/memory/*` and is intended for use with an
     * API key. The same typed memory operations are exposed as the Foresight
     * client, but routed through the developer-only endpoint.
     */
    get developer(): {
        memory: ForesightClient;
    };
    private createMemoryClient;
    /**
     * System API
     */
    get system(): {
        /**
         * Check API health
         */
        getHealth: () => Promise<{
            status: string;
            timestamp: string;
            version: string;
        }>;
        /**
         * Get API version info
         */
        getVersion: () => Promise<{
            version: string;
            build: string;
        }>;
    };
    /**
     * API Key management (for developers)
     */
    get apiKeys(): {
        /**
         * List API keys
         */
        list: () => Promise<Array<{
            id: string;
            name: string;
            key_prefix: string;
            scopes: string[];
            is_active: boolean;
            created_at: string;
            expires_at?: string | null | undefined;
            last_used_at?: string | null | undefined;
        }>>;
        /**
         * Create a new API key
         */
        create: (name: string, scopes?: string[]) => Promise<{
            key: string;
            id: string;
        }>;
        /**
         * Revoke an API key
         */
        revoke: (keyId: string) => Promise<void>;
    };
}
export default PixelatedClient;
