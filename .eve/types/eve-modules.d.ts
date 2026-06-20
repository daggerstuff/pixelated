// Ambient module declarations for the Eve framework.
// These provide type information for eve imports used across all agents.
// Place alongside .eve/**/*.d.ts in each agent's tsconfig include.

import type { z } from "zod";

// ── eve (core) ─────────────────────────────────────────────────────

declare module "eve" {
  export interface AgentConfig {
    model?: string | unknown;
    description?: string;
    outputSchema?: z.ZodType;
    compaction?: {
      thresholdPercent?: number;
    };
  }

  export function defineAgent(config: AgentConfig): AgentConfig;
}

// ── eve/tools ──────────────────────────────────────────────────────

declare module "eve/tools" {
  export interface ToolConfig<T extends z.ZodType = z.ZodType> {
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>) => Promise<Record<string, unknown>> | Record<string, unknown>;
    needsApproval?: () => unknown;
  }

  export function defineTool<T extends z.ZodType>(config: ToolConfig<T>): ToolConfig<T>;
}

// ── eve/tools/approval ─────────────────────────────────────────────

declare module "eve/tools/approval" {
  export function always(): () => void;
}

// ── eve/channels ───────────────────────────────────────────────────

declare module "eve/channels" {
  export interface RouteContext {
    send(message: string, options?: Record<string, unknown>): Promise<{ id: string }>;
    getSession(sessionId: string): { getEventStream(): Promise<ReadableStream> };
    params: Record<string, string>;
  }

  export type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response> | Response;

  export interface Route {
    pattern: string;
    handler: RouteHandler;
  }

  export interface ChannelConfig {
    routes: Route[];
  }

  export function defineChannel(config: ChannelConfig): ChannelConfig;
  export function POST(path: string, handler: RouteHandler): Route;
  export function GET(path: string, handler: RouteHandler): Route;
}

// ── eve/channels/eve ───────────────────────────────────────────────

declare module "eve/channels/eve" {
  export type AuthProviderType = "localDev" | "placeholderAuth" | "vercelOidc" | "none";

  export interface AuthProvider {
    type: AuthProviderType;
  }

  export interface EveChannelConfig {
    auth?: AuthProvider[];
  }

  export function eveChannel(config: EveChannelConfig): EveChannelConfig;
}

// ── eve/channels/auth ──────────────────────────────────────────────

declare module "eve/channels/auth" {
  export interface AuthProvider {
    type: "localDev" | "placeholderAuth" | "vercelOidc" | "none";
  }

  export function localDev(): AuthProvider;
  export function placeholderAuth(): AuthProvider;
  export function vercelOidc(): AuthProvider;
  export function none(): AuthProvider;
}

// ── eve/channels/linear ────────────────────────────────────────────

declare module "eve/channels/linear" {
  export interface LinearChannelConfig {
    credentials?: Record<string, unknown>;
  }

  export function linearChannel(config: LinearChannelConfig): LinearChannelConfig;
}

// ── eve/channels/slack ─────────────────────────────────────────────

declare module "eve/channels/slack" {
  export interface SlackChannelConfig {
    credentials?: Record<string, unknown>;
  }

  export function slackChannel(config: SlackChannelConfig): SlackChannelConfig;
}

// ── eve/connections ────────────────────────────────────────────────

declare module "eve/connections" {
  export interface McpClientConnectionConfig {
    url: string;
    description?: string;
    headers?: Record<string, string>;
    auth?: {
      getToken: () => Promise<{ token: string }>;
    };
  }

  export function defineMcpClientConnection(
    config: McpClientConnectionConfig,
  ): McpClientConnectionConfig;
}

// ── eve/hooks ──────────────────────────────────────────────────────

declare module "eve/hooks" {
  export interface HookEventData {
    message?: string;
    data?: {
      message?: string;
      status?: unknown;
      [key: string]: unknown;
    };
    type?: unknown;
  }

  export type HookEvent = (event: HookEventData, ctx: unknown) => void;

  export interface HookConfig {
    events: Record<string, HookEvent>;
  }

  export function defineHook(config: HookConfig): HookConfig;
}

// ── eve/schedules ──────────────────────────────────────────────────

declare module "eve/schedules" {
  export interface ScheduleConfig {
    cron: string;
    markdown?: string;
    description?: string;
  }

  export function defineSchedule(config: ScheduleConfig): ScheduleConfig;
}

// ── eve/evals ──────────────────────────────────────────────────────

declare module "eve/evals" {
  export interface EvalTestContext {
    send(message: string): Promise<void>;
    completed(): void;
    calledTool(name: string): void;
    check(actual: unknown, matcher: unknown): void;
    reply: string;
  }

  export interface EvalConfig {
    description: string;
    test: (t: EvalTestContext) => Promise<void>;
  }

  export interface EvalConfigWrapper {
    judge?: { model?: string };
  }

  export function defineEval(config: EvalConfig): EvalConfig;
  export function defineEvalConfig(config: EvalConfigWrapper): EvalConfigWrapper;
}

// ── eve/evals/expect ───────────────────────────────────────────────

declare module "eve/evals/expect" {
  export function includes(value: string): unknown;
}
