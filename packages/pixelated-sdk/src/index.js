/**
 * Pixelated Empathy SDK
 * Official JavaScript/TypeScript SDK for the Pixelated Empathy API
 */
import { z } from "zod";
import { ForesightClient, } from "./foresight";
export { ForesightClient, ForesightClientError, ForesightMemory, StoreMemoryInput, StoreMemoryOutput, GetMemoryInput, QueryMemoriesInput, ListMemoriesInput, ListMemoriesOutput, UpdateMemoryInput, DeleteMemoryInput, DeleteMemoryOutput, MemoryScope, RetentionPolicy, } from "./foresight";
export const UserProfileSchema = z.object({
    id: z.string(),
    fullName: z.string().optional(),
    email: z.string(),
    role: z.string(),
    avatarUrl: z.string().optional(),
    createdAt: z.string(),
    lastLogin: z.string().optional(),
});
export const HealthSchema = z.object({
    status: z.string(),
    timestamp: z.string(),
    version: z.string(),
    uptime: z.number().optional(),
});
export const VersionSchema = z.object({
    version: z.string(),
    build: z.string(),
    commit: z.string().optional(),
});
export const ApiKeyElementSchema = z.object({
    id: z.string(),
    name: z.string(),
    key_prefix: z.string(),
    scopes: z.array(z.string()),
    is_active: z.boolean(),
    created_at: z.string(),
    expires_at: z.string().nullable().optional(),
    last_used_at: z.string().nullable().optional(),
});
export const ApiKeyListSchema = z.object({
    keys: z.array(ApiKeyElementSchema),
});
export const ApiKeyCreateSchema = z.object({
    key: z.string(),
    id: z.string(),
});
export const ApiKeyRevokeSchema = z.object({}).optional();
export const SearchResultSchema = z.object({
    id: z.string(),
    title: z.string(),
    excerpt: z.string(),
    url: z.string(),
    type: z.string(),
    score: z.number(),
});
export const BiasAnalysisResultSchema = z.object({
    id: z.string(),
    biases: z.array(z.object({
        type: z.string(),
        confidence: z.number(),
        evidence: z.string(),
        suggestion: z.string(),
    })),
    overallScore: z.number(),
    recommendations: z.array(z.string()),
});
export const UserPreferencesSchema = z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
    notifications: z
        .object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
    })
        .optional(),
});
export const MemoryTurnSchema = z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    timestamp: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const MemorySessionSchema = z.object({
    id: z.string(),
    turns: z.array(MemoryTurnSchema),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export class PixelatedClient {
    baseUrl;
    apiKey;
    jwt;
    timeout;
    maxRetries;
    retryDelay;
    constructor(config = {}) {
        this.baseUrl = config.baseUrl ?? "https://api.pixelatedempathy.com/api/v1";
        this.apiKey = config.apiKey;
        this.jwt = config.jwt;
        this.timeout = config.timeout ?? 30000;
        this.maxRetries = config.maxRetries ?? 3;
        this.retryDelay = config.retryDelay ?? 1000;
    }
    /**
     * Internal helper for API requests with retry logic
     */
    async request(endpoint, schema, options = {}, retryCount = 0) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };
        if (this.apiKey) {
            headers["X-API-Key"] = this.apiKey;
        }
        else if (this.jwt) {
            headers["Authorization"] = `Bearer ${this.jwt}`;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            // Handle rate limiting with exponential backoff
            if (response.status === 429 && retryCount < this.maxRetries) {
                const retryAfter = response.headers.get("Retry-After");
                const delay = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : this.retryDelay * Math.pow(2, retryCount);
                await this.sleep(delay);
                return this.request(endpoint, schema, options, retryCount + 1);
            }
            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                let errorData = {};
                try {
                    errorData = errorText ? JSON.parse(errorText) : {};
                }
                catch {
                    /* leave errorData as {} */
                }
                const error = {
                    name: "ApiError",
                    message: errorData.error ?? "API Error: " + response.statusText,
                    status: response.status,
                    code: errorData.code ?? "UNKNOWN",
                    details: errorData.details,
                };
                throw error;
            }
            return await this.parseResponse(response, schema);
        }
        catch (error) {
            clearTimeout(timeoutId);
            // Retry on network errors
            if (error instanceof Error && retryCount < this.maxRetries) {
                if (error.message.includes("abort") || error.message.includes("network")) {
                    await this.sleep(this.retryDelay * Math.pow(2, retryCount));
                    return this.request(endpoint, schema, options, retryCount + 1);
                }
            }
            throw error;
        }
    }
    async parseResponse(response, schema) {
        const text = await response.text();
        try {
            const parsed = text ? JSON.parse(text) : {};
            return schema.parse(parsed);
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                const summary = err.issues
                    .map((i) => (i.path.length ? i.path.join(".") + ": " : "") + i.message)
                    .join("; ");
                throw new Error("Response schema mismatch: " + summary);
            }
            throw err;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Bias Analysis API
     */
    get biasAnalysis() {
        return {
            /**
             * Perform bias analysis on clinical text
             */
            analyze: async (params) => {
                return this.request("/bias-analysis/analyze", BiasAnalysisResultSchema, {
                    method: "POST",
                    body: JSON.stringify(params),
                });
            },
        };
    }
    /**
     * User API
     */
    get user() {
        return {
            /**
             * Get the current user profile
             */
            getProfile: async () => {
                const response = await this.request("/profile", z.object({ profile: UserProfileSchema }));
                return response.profile;
            },
            /**
             * Update the current user profile
             */
            updateProfile: async (updates) => {
                const response = await this.request("/profile", z.object({ profile: UserProfileSchema }), {
                    method: "PUT",
                    body: JSON.stringify(updates),
                });
                return response.profile;
            },
            /**
             * Get user preferences
             */
            getPreferences: async () => {
                const response = await this.request("/preferences", z.object({ preferences: UserPreferencesSchema }));
                return response.preferences;
            },
            /**
             * Update user preferences
             */
            updatePreferences: async (updates) => {
                const response = await this.request("/preferences", z.object({ preferences: UserPreferencesSchema }), {
                    method: "PUT",
                    body: JSON.stringify(updates),
                });
                return response.preferences;
            },
        };
    }
    /**
     * Search API
     */
    get search() {
        return {
            /**
             * Search content
             */
            query: async (query, filters) => {
                const params = new URLSearchParams({ q: query });
                if (filters?.type)
                    params.append("type", filters.type);
                if (filters?.limit)
                    params.append("limit", filters.limit.toString());
                const response = await this.request(`/search?${params}`, z.object({ results: z.array(SearchResultSchema) }));
                return response.results;
            },
        };
    }
    /**
     * Memory/Sessions API
     */
    get memory() {
        return {
            /**
             * Get a session by ID
             */
            getSession: async (sessionId) => {
                const response = await this.request(`/memory/sessions/${sessionId}`, z.object({ session: MemorySessionSchema }));
                return response.session;
            },
            /**
             * Create a new turn in a session
             */
            addTurn: async (sessionId, turn) => {
                const response = await this.request(`/memory/sessions/${sessionId}/turns`, z.object({ turn: MemoryTurnSchema }), {
                    method: "POST",
                    body: JSON.stringify(turn),
                });
                return response.turn;
            },
            /**
             * List sessions
             */
            listSessions: async (params) => {
                const queryParams = new URLSearchParams();
                if (params?.limit)
                    queryParams.append("limit", params.limit.toString());
                if (params?.offset)
                    queryParams.append("offset", params.offset.toString());
                const response = await this.request(`/memory/sessions?${queryParams}`, z.object({ sessions: z.array(MemorySessionSchema) }));
                return response.sessions;
            },
        };
    }
    /**
     * Foresight memory client (typed memory operations via Foresight gateway)
     */
    get foresight() {
        return this.createMemoryClient("/api/v1/memory");
    }
    /**
     * Developer memory client (external developer API surface)
     *
     * Targets `/api/v1/developer/memory/*` and is intended for use with an
     * API key. The same typed memory operations are exposed as the Foresight
     * client, but routed through the developer-only endpoint.
     */
    get developer() {
        return {
            memory: this.createMemoryClient("/api/v1/developer/memory"),
        };
    }
    createMemoryClient(basePath) {
        return new ForesightClient({
            baseUrl: this.baseUrl.replace("/api/v1", basePath),
            getHeaders: () => {
                const h = {};
                if (this.apiKey)
                    h["X-API-Key"] = this.apiKey;
                else if (this.jwt)
                    h["Authorization"] = `Bearer ${this.jwt}`;
                return h;
            },
        });
    }
    /**
     * System API
     */
    get system() {
        return {
            /**
             * Check API health
             */
            getHealth: async () => {
                return this.request("/health", HealthSchema);
            },
            /**
             * Get API version info
             */
            getVersion: async () => {
                return this.request("/version", VersionSchema);
            },
        };
    }
    /**
     * API Key management (for developers)
     */
    get apiKeys() {
        return {
            /**
             * List API keys
             */
            list: async () => {
                const response = await this.request("/developer/api-keys", ApiKeyListSchema);
                return response.keys;
            },
            /**
             * Create a new API key
             */
            create: async (name, scopes) => {
                const response = await this.request("/developer/api-keys", ApiKeyCreateSchema, {
                    method: "POST",
                    body: JSON.stringify({ name, scopes }),
                });
                return response;
            },
            /**
             * Revoke an API key
             */
            revoke: async (keyId) => {
                await this.request(`/developer/api-keys/${keyId}`, ApiKeyRevokeSchema, {
                    method: "DELETE",
                });
            },
        };
    }
}
// Default export
export default PixelatedClient;
