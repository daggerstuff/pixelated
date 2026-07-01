/**
 * API client stub for analytics endpoints.
 * Replace with real HTTP client when backend is available.
 */

export interface ApiClient {
  get<T>(url: string): Promise<T>;
}

async function request<T>(url: string, _options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ..._options,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const api: ApiClient = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },
};
