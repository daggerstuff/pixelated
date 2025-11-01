/**
 * Pixelated Empathy AI - Official TypeScript/JavaScript Client Library
 * Task 3A.3.3: Complete JavaScript/TypeScript Client Library
 * 
 * Enterprise-grade TypeScript SDK for accessing the Pixelated Empathy AI API.
 * Supports both Node.js and browser environments with comprehensive typing.
 */

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset_time: number;
  retry_after?: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  rate_limit_info?: RateLimitInfo;
}

export enum QualityTier {
  RESEARCH = "research",
  CLINICAL = "clinical",
  PROFESSIONAL = "professional",
  STANDARD = "standard",
  BASIC = "basic"
}

export enum ExportFormat {
  JSONL = "jsonl",
  PARQUET = "parquet",
  CSV = "csv",
  HUGGINGFACE = "huggingface",
  OPENAI = "openai"
}

export enum JobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface AdvancedQuery {
  dataset?: string;
  tier?: QualityTier;
  min_quality?: number;
  max_quality?: number;
  created_after?: Date;
  created_before?: Date;
  min_messages?: number;
  max_messages?: number;
  content_search?: string;
  role_filter?: string;
  min_therapeutic_accuracy?: number;
  min_emotional_authenticity?: number;
  min_safety_score?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface BulkExportRequest {
  dataset: string;
  format?: ExportFormat;
  filters?: AdvancedQuery;
  include_metadata?: boolean;
  include_quality_metrics?: boolean;
  batch_size?: number;
  notify_email?: string;
  callback_url?: string;
}

export interface Dataset {
  name: string;
  description: string;
  conversations: number;
  quality_score: number;
  tiers: QualityTier[];
}

export interface Conversation {
  id: string;
  messages: Message[];
  quality_score: number;
  tier: QualityTier;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface QualityMetrics {
  therapeutic_accuracy: number;
  conversation_coherence: number;
  emotional_authenticity: number;
  clinical_compliance: number;
  safety_score: number;
  overall_quality: number;
}

export interface ExportJobStatus {
  job_id: string;
  status: JobStatus;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_records?: number;
  processed_records?: number;
  failed_records?: number;
  download_url?: string;
  file_size?: number;
  expires_at?: string;
  error_message?: string;
  error_details?: Record<string, any>;
}

export interface UsageStatistics {
  user_statistics: {
    api_key_hash: string;
    account_created: string;
    total_requests: number;
    requests_today: number;
    last_request?: string;
    most_used_endpoint?: string;
    endpoint_usage_breakdown: Record<string, number>;
  };
  rate_limiting: {
    current_window_requests: number;
    hourly_limit: number;
    remaining_requests: number;
    window_reset_time: number;
    rate_limit_status: "within_limits" | "approaching_limit" | "rate_limited";
  };
  system_statistics: {
    total_active_users: number;
    total_requests_all_users: number;
    total_requests_today_all_users: number;
  };
  performance_metrics: {
    average_response_time_ms: number;
    system_uptime_hours: number;
    api_availability_percent: number;
  };
}

export class PixelatedEmpathyError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: any
  ) {
    super(message);
    this.name = 'PixelatedEmpathyError';
  }
}

export class RateLimitError extends PixelatedEmpathyError {
  constructor(
    message: string,
    public retryAfter?: number,
    statusCode?: number,
    responseData?: any
  ) {
    super(message, statusCode, responseData);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends PixelatedEmpathyError {
  constructor(message: string, statusCode?: number, responseData?: any) {
    super(message, statusCode, responseData);
    this.name = 'AuthenticationError';
  }
}

export interface ClientOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
}

/**
 * Enterprise-grade TypeScript client for Pixelated Empathy AI API
 * 
 * Features:
 * - Full TypeScript typing support
 * - Node.js and browser compatibility
 * - Automatic retry with exponential backoff
 * - Rate limit handling
 * - Comprehensive error handling
 * - Request/response logging
 * - Promise-based async operations
 * 
 * @example
 * ```typescript
 * // Node.js usage
 * import { PixelatedEmpathyClient, QualityTier, ExportFormat } from 'pixelated-empathy-client';
 * 
 * const client = new PixelatedEmpathyClient('your-api-key');
 * 
 * // List datasets
 * const datasets = await client.listDatasets();
 * 
 * // Query conversations
 * const conversations = await client.queryConversations({
 *   tier: QualityTier.PROFESSIONAL,
 *   min_quality: 0.8,
 *   limit: 10
 * });
 * 
 * // Create export
 * const jobId = await client.createBulkExport({
 *   dataset: "priority_complete_fixed",
 *   format: ExportFormat.JSONL
 * });
 * ```
 * 
 * @example
 * ```html
 * <!-- Browser usage -->
 * <script type="module">
 *   import { PixelatedEmpathyClient } from './dist/index.js';
 *   
 *   const client = new PixelatedEmpathyClient('your-api-key');
 *   const datasets = await client.listDatasets();
 *   console.log(datasets);
 * </script>
 * ```
 */
export class PixelatedEmpathyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly enableLogging: boolean;

  constructor(apiKey: string, options: ClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl || 'https://api.pixelated-empathy.ai').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableLogging = options.enableLogging !== false;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pixelated-empathy-typescript-client/1.0.0'
    };

    // Convert dates to ISO strings in data
    const processedData = this.serializeDates(data);

    let lastError: Error;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (this.enableLogging) {
          console.log(`API Request: ${method} ${url.toString()}`);
        }

        const startTime = Date.now();
        
        // Use fetch for both Node.js and browser compatibility
        const response = await this.fetchWithTimeout(url.toString(), {
          method,
          headers,
          body: data ? JSON.stringify(processedData) : undefined
        });

        const responseTime = Date.now() - startTime;
        
        if (this.enableLogging) {
          console.log(`API Response: ${method} ${url.toString()} -> ${response.status} (${responseTime}ms)`);
        }

        const responseData = await response.json();

        if (!response.ok) {
          if (response.status === 429 && attempt < this.maxRetries) {
            // Handle rate limiting
            const retryAfter = responseData.rate_limit_info?.retry_after || 60;
            await this.delay(Math.min(retryAfter * 1000, 300000)); // Max 5 minutes
            continue;
          }

          this.handleErrorResponse(responseData, response.status);
        }

        return responseData;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries && !this.isNonRetryableError(error)) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          if (this.enableLogging) {
            console.warn(`Request failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error);
          }
          await this.delay(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw new PixelatedEmpathyError(`Request failed after ${this.maxRetries} retries: ${lastError?.message}`);
  }

  /**
   * Fetch with timeout support for both Node.js and browser
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private serializeDates(obj: any): any {
    if (!obj) return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(item => this.serializeDates(item));
    if (typeof obj === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serializeDates(value);
      }
      return serialized;
    }
    return obj;
  }

  private isNonRetryableError(error: any): boolean {
    return error instanceof AuthenticationError || 
           (error instanceof PixelatedEmpathyError && error.statusCode === 400);
  }

  private handleErrorResponse(responseData: any, statusCode: number): never {
    const message = responseData.message || 'Unknown API error';
    
    if (statusCode === 401) {
      throw new AuthenticationError(message, statusCode, responseData);
    } else if (statusCode === 429) {
      const retryAfter = responseData.rate_limit_info?.retry_after;
      throw new RateLimitError(message, retryAfter, statusCode, responseData);
    } else {
      throw new PixelatedEmpathyError(message, statusCode, responseData);
    }
  }

  // PUBLIC METHODS

  /**
   * List all available datasets
   */
  async listDatasets(): Promise<Dataset[]> {
    const response = await this.request<APIResponse<{ datasets: Dataset[] }>>('GET', '/v1/datasets');
    return response.data!.datasets;
  }

  /**
   * Get detailed information about a specific dataset
   */
  async getDatasetInfo(datasetName: string): Promise<any> {
    const response = await this.request<APIResponse>('GET', `/v1/datasets/${datasetName}`);
    return response.data;
  }

  /**
   * Query conversations with advanced filtering
   */
  async queryConversations(query: AdvancedQuery): Promise<any> {
    const response = await this.request<APIResponse>('POST', '/v1/conversations/query', query);
    return response.data;
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await this.request<APIResponse<Conversation>>('GET', `/v1/conversations/${conversationId}`);
    return response.data!;
  }

  /**
   * Create a bulk export job
   */
  async createBulkExport(exportRequest: BulkExportRequest): Promise<string> {
    const response = await this.request<APIResponse<{ job_id: string }>>('POST', '/v1/export/bulk', exportRequest);
    return response.data!.job_id;
  }

  /**
   * Get status of a bulk export job
   */
  async getExportStatus(jobId: string): Promise<ExportJobStatus> {
    const response = await this.request<APIResponse<ExportJobStatus>>('GET', `/v1/export/jobs/${jobId}/status`);
    return response.data!;
  }

  /**
   * List export jobs with optional status filtering
   */
  async listExportJobs(status?: JobStatus, limit: number = 50): Promise<ExportJobStatus[]> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (status) {
      params.status = status;
    }

    const response = await this.request<APIResponse<{ jobs: ExportJobStatus[] }>>('GET', '/v1/export/jobs', undefined, params);
    return response.data!.jobs;
  }

  /**
   * Cancel a running export job
   */
  async cancelExportJob(jobId: string): Promise<any> {
    const response = await this.request<APIResponse>('DELETE', `/v1/export/jobs/${jobId}`);
    return response.data;
  }

  /**
   * Get comprehensive usage statistics
   */
  async getUsageStatistics(): Promise<UsageStatistics> {
    const response = await this.request<APIResponse<UsageStatistics>>('GET', '/v1/monitoring/usage');
    return response.data!;
  }

  /**
   * Get current rate limiting information
   */
  async getRateLimitInfo(): Promise<any> {
    const response = await this.request<APIResponse>('GET', '/v1/monitoring/rate-limits');
    return response.data;
  }

  /**
   * Get quality metrics for datasets or tiers
   */
  async getQualityMetrics(dataset?: string, tier?: QualityTier): Promise<any> {
    const params: Record<string, string> = {};
    if (dataset) params.dataset = dataset;
    if (tier) params.tier = tier;

    const response = await this.request<APIResponse>('GET', '/v1/quality/metrics', undefined, params);
    return response.data;
  }

  /**
   * Validate conversation quality
   */
  async validateConversationQuality(conversation: Partial<Conversation>): Promise<any> {
    const response = await this.request<APIResponse>('POST', '/v1/quality/validate', conversation);
    return response.data;
  }

  /**
   * Search conversations using advanced filters
   */
  async searchConversations(query: string, filters?: Record<string, any>, limit: number = 100, offset: number = 0): Promise<any> {
    const searchRequest = {
      query,
      filters: filters || {},
      limit,
      offset
    };

    const response = await this.request<APIResponse>('POST', '/v1/search', searchRequest);
    return response.data;
  }

  /**
   * Get system statistics overview
   */
  async getStatisticsOverview(): Promise<any> {
    const response = await this.request<APIResponse>('GET', '/v1/statistics/overview');
    return response.data;
  }

  /**
   * Get detailed system health check
   */
  async getDetailedHealthCheck(): Promise<any> {
    const response = await this.request<APIResponse>('GET', '/v1/monitoring/health/detailed');
    return response.data;
  }

  // HELPER METHODS

  /**
   * Wait for export job to complete
   */
  async waitForExportCompletion(
    jobId: string,
    pollInterval: number = 30000,
    timeout: number = 3600000
  ): Promise<ExportJobStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getExportStatus(jobId);

      if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(status.status)) {
        return status;
      }

      if (this.enableLogging) {
        console.log(`Export job ${jobId}: ${status.status} (${status.progress.toFixed(1)}%)`);
      }

      await this.delay(pollInterval);
    }

    throw new PixelatedEmpathyError(`Export job ${jobId} did not complete within ${timeout}ms`);
  }

  /**
   * Create export job and wait for completion
   */
  async exportAndWait(
    exportRequest: BulkExportRequest,
    pollInterval: number = 30000,
    timeout: number = 3600000
  ): Promise<ExportJobStatus> {
    const jobId = await this.createBulkExport(exportRequest);
    return await this.waitForExportCompletion(jobId, pollInterval, timeout);
  }
}

// Convenience functions for quick usage

/**
 * Quick conversation query without creating a client instance
 */
export async function quickQuery(apiKey: string, query: AdvancedQuery): Promise<any> {
  const client = new PixelatedEmpathyClient(apiKey);
  return await client.queryConversations(query);
}

/**
 * Quick export job creation without creating a client instance
 */
export async function quickExport(
  apiKey: string, 
  dataset: string, 
  format: ExportFormat = ExportFormat.JSONL
): Promise<string> {
  const client = new PixelatedEmpathyClient(apiKey);
  return await client.createBulkExport({ dataset, format });
}

// Default export for CommonJS compatibility
export default PixelatedEmpathyClient;