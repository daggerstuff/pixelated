/**
 * Auto-SDK HTTP client with auth and retry.
 *
 * Provides the low-level request layer used by all endpoint modules. Handles
 * authentication headers (API key or JWT), JSON encoding, rate-limit retries,
 * and structured error responses.
 */

import type { ErrorResponse } from "./types";

export interface AutoSdkConfig {
  /** Base URL including the API version prefix, e.g. https://api.pixelatedempathy.com/api/v1 */
  baseUrl?: string;
  /** API key for server-to-server calls (sent as X-API-Key). */
  apiKey?: string;
  /** JWT for browser session auth (sent as Authorization: Bearer). */
  jwt?: string;
  /** Per-request timeout in milliseconds. */
  timeout?: number;
  /** Max retries on 429 or transient network errors. */
  maxRetries?: number;
  /** Base delay for exponential backoff in milliseconds. */
  retryDelay?: number;
}

export class AutoSdkError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, opts: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = "AutoSdkError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

const DEFAULT_BASE_URL = "https://api.pixelatedempathy.com/api/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000;


/** Permissive query-param shape: each value is a primitive or undefined. */
export type QueryParamValue = string | number | string[] | undefined;
export type QueryParams = Record<string, QueryParamValue>;
export class AutoSdkClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly jwt?: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: AutoSdkConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.jwt = config.jwt;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    else if (this.jwt) h["Authorization"] = `Bearer ${this.jwt}`;
    return h;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute an HTTP request with retry-on-429 and structured error handling.
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: QueryParams;
    } = {},
    retryCount = 0,
  ): Promise<T> {
    const qs = this.buildQueryString(options.query);
    const url = `${this.baseUrl}${path}${qs}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.authHeaders(),
    };
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Retry on rate-limit with exponential backoff
      if (response.status === 429 && retryCount < this.maxRetries) {
        const retryAfterRaw = response.headers.get("Retry-After");
        const delay = retryAfterRaw
          ? Number.parseInt(retryAfterRaw, 10) * 1000
          : this.retryDelay * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(method, path, options, retryCount + 1);
      }

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as ErrorResponse;
        throw new AutoSdkError(errBody.error ?? response.statusText, {
          status: response.status,
          code: errBody.code ?? "UNKNOWN",
          details: errBody,
        });
      }

      // 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network/abort errors
      if (
        error instanceof Error &&
        retryCount < this.maxRetries &&
        (error.name === "AbortError" || /network|fetch/i.test(error.message))
      ) {
        await this.sleep(this.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(method, path, options, retryCount + 1);
      }

      throw error;
    }
  }

  private buildQueryString(query?: QueryParams): string {
    if (!query) return "";
    const parts: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.length === 0 ? "" : `?${parts.join("&")}`;
  }
}
