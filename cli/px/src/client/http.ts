export interface AgentRequest {
  endpoint: string;
  tool: string;
  body: Record<string, unknown>;
  timeoutMs: number;
}

export interface AgentResponse {
  ok: boolean;
  status: number;
  data: unknown;
  headers: Headers;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public endpoint: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function callAgent(
  req: AgentRequest,
): Promise<AgentResponse> {
  const url = `${req.endpoint.replace(/\/$/, '')}/eve/v1/${req.tool}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    const data = await res
      .json()
      .catch(() => ({ error: 'non-JSON response' }));

    if (!res.ok) {
      throw new HttpError(
        `agent returned ${res.status}`,
        res.status,
        req.endpoint,
      );
    }

    return {
      ok: true,
      status: res.status,
      data,
      headers: res.headers,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new TimeoutError(
        `request timed out after ${req.timeoutMs}ms`,
        req.endpoint,
      );
    }
    // Network / connection error
    throw new HttpError(
      e instanceof Error ? e.message : 'fetch failed',
      0,
      req.endpoint,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function pingHealth(
  endpoint: string,
  timeoutMs: number = 5000,
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const url = `${endpoint.replace(/\/$/, '')}/eve/v1/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    return {
      ok: res.ok,
      status: res.status,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, status: 0, detail: 'timeout' };
    }
    return {
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
