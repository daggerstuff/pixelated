/**
 * Redis-backed PubSub Adapter for GraphQL Subscriptions — PIX-4064
 *
 * Replaces the in-memory createPubSub with a Redis-backed pub/sub adapter.
 * Uses ioredis duplicate connections (publisher + subscriber) to avoid
 * the constraint that ioredis can't subscribe on a command connection.
 *
 * Fallback: if Redis is unavailable (dev without Redis), falls back to
 * an in-memory EventEmitter-based pub/sub so subscriptions still work
 * in local development.
 *
 * Channels:
 * - graphql:sessionUpdated
 * - graphql:emotionAnalysisCreated
 * - graphql:conversationTurnAdded
 */

import type { Redis } from "ioredis";
type RedisClient = Redis;
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-redis-pubsub");

// ──────────────────────────────────────────────
// Topic type
// ──────────────────────────────────────────────

export type PubSubTopic = "sessionUpdated" | "emotionAnalysisCreated" | "conversationTurnAdded";

export type PubSubPayload = Record<string, unknown>;

interface PubSubTopics {
  sessionUpdated: { sessionUpdated: PubSubPayload };
  emotionAnalysisCreated: { emotionAnalysisCreated: PubSubPayload };
  conversationTurnAdded: { conversationTurnAdded: PubSubPayload };
}

// ──────────────────────────────────────────────
// In-memory fallback pub/sub
// ──────────────────────────────────────────────

interface InMemorySubscriber {
  topic: string;
  push: (payload: unknown) => void;
}

class InMemoryPubSub {
  private subscribers: InMemorySubscriber[] = [];
  private idCounter = 0;

  subscribe(topic: string): AsyncIterable<{ [key: string]: unknown }> {
    const queue: unknown[] = [];
    let resolveNext:
      | ((value: { done: false; value: unknown } | { done: true; value: undefined }) => void)
      | null = null;
    const subId = ++this.idCounter;

    const push = (payload: unknown) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ done: false, value: { [topic]: payload } });
      } else {
        queue.push(payload);
      }
    };

    this.subscribers.push({ topic, push });

    return {
      [Symbol.asyncIterator]: () => ({
        next: (): Promise<IteratorResult<{ [key: string]: unknown }>> => {
          if (queue.length > 0) {
            return Promise.resolve({
              done: false,
              value: { [topic]: queue.shift() },
            });
          }
          return new Promise((resolve) => {
            resolveNext = resolve as typeof resolveNext;
          });
        },
        return: (): Promise<IteratorResult<{ [key: string]: unknown }>> => {
          this.subscribers = this.subscribers.filter(
            (_, i) => i !== this.subscribers.findIndex((s) => s.push === push),
          );
          logger.debug("InMemory subscription closed", { topic, subId });
          return Promise.resolve({ done: true, value: undefined });
        },
      }),
    };
  }

  publish(topic: string, payload: unknown): void {
    for (const sub of this.subscribers) {
      if (sub.topic === topic) {
        sub.push(payload);
      }
    }
  }
}

// ──────────────────────────────────────────────
// Redis-backed PubSub
// ──────────────────────────────────────────────

class RedisPubSub {
  private publisher: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private readonly topicHandlers: Map<string, Set<(payload: unknown) => void>> = new Map();
  private initialized = false;

  /**
   * Initialize Redis pub/sub connections.
   * Lazily called on first subscribe/publish to avoid connecting
   * when GraphQL subscriptions aren't used.
   */
  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Import redis service lazily to avoid circular deps and build issues
      const { redisService } = await import("@/lib/redis");
      const client = redisService.getClient();
      if (!client) {
        logger.warn("Redis client not available, using in-memory fallback");
        return false;
      }

      // Create duplicate connections for pub/sub
      // ioredis requires a dedicated connection for subscribing
      const Redis = (await import("ioredis")).default;
      const redisUrl = (process.env['REDIS_URL'] ?? process.env['UPSTASH_REDIS_REST_URL']) || "";

      if (redisUrl) {
        this.publisher = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);
      } else {
        // Try duplicating existing connection
        this.publisher = client.duplicate();
        this.subscriber = client.duplicate();
      }

      // Set up message handler
      this.subscriber.on("message", (channel: string, message: string) => {
        void (async () => {
        try {
          const payload = JSON.parse(message) as unknown;
          const handlers = this.topicHandlers.get(channel);
          if (handlers) {
            for (const handler of handlers) {
              handler(payload);
            }
          }
        } catch (err) {
          logger.error("Failed to parse Redis pub/sub message", {
            channel,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      });

      this.initialized = true;
      logger.info("Redis pub/sub initialized");
      return true;
    } catch (err) {
      logger.error("Redis pub/sub initialization failed, using in-memory fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private channelFor(topic: PubSubTopic): string {
    return `graphql:${topic}`;
  }

  async subscribe(topic: PubSubTopic): Promise<AsyncIterable<{ [key: string]: unknown }>> {
    const redisReady = await this.ensureInitialized();

    if (!redisReady || !this.subscriber) {
      // Fallback to in-memory
      return inMemoryFallback.subscribe(this.channelFor(topic));
    }

    const channel = this.channelFor(topic);
    await this.subscriber.subscribe(channel);

    const queue: unknown[] = [];
    let resolveNext:
      | ((value: { done: false; value: unknown } | { done: true; value: undefined }) => void)
      | null = null;

    const handler = (payload: unknown) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ done: false, value: { [topic]: payload } });
      } else {
        queue.push(payload);
      }
    };

    if (!this.topicHandlers.has(channel)) {
      this.topicHandlers.set(channel, new Set());
    }
    this.topicHandlers.get(channel)!.add(handler);

    return {
      [Symbol.asyncIterator]: () => ({
        next: (): Promise<IteratorResult<{ [key: string]: unknown }>> => {
          if (queue.length > 0) {
            return Promise.resolve({
              done: false,
              value: { [topic]: queue.shift() },
            });
          }
          return new Promise((resolve) => {
            resolveNext = resolve as typeof resolveNext;
          });
        },
        return: (): Promise<IteratorResult<{ [key: string]: unknown }>> => {
          this.topicHandlers.get(channel)?.delete(handler);
          if (this.topicHandlers.get(channel)?.size === 0) {
            this.topicHandlers.delete(channel);
            void this.subscriber?.unsubscribe(channel);
          }
          return Promise.resolve({ done: true, value: undefined });
        },
      }),
    };
  }

  async publish(topic: PubSubTopic, payload: PubSubPayload): Promise<void> {
    const redisReady = await this.ensureInitialized();

    if (!redisReady || !this.publisher) {
      inMemoryFallback.publish(this.channelFor(topic), payload);
      return;
    }

    const channel = this.channelFor(topic);
    await this.publisher.publish(channel, JSON.stringify(payload));
  }
}

// ──────────────────────────────────────────────
// Singleton instances
// ──────────────────────────────────────────────

const inMemoryFallback = new InMemoryPubSub();
const redisPubSub = new RedisPubSub();

// ──────────────────────────────────────────────
// Public API — implements graphql-yoga PubSub interface
// ──────────────────────────────────────────────

/**
 * PubSub adapter for graphql-yoga subscriptions.
 *
 * Uses Redis when available, falls back to in-memory EventEmitter
 * when Redis is not configured (dev environment).
 *
 * Usage in server.ts:
 *   subscribe: (topic) => graphqlPubSub.subscribe(topic),
 *   publish: (topic, payload) => graphqlPubSub.publish(topic, payload),
 */
export const graphqlPubSub = {
  subscribe: (topic: PubSubTopic): Promise<AsyncIterable<{ [key: string]: unknown }>> =>
    redisPubSub.subscribe(topic),

  publish: (topic: PubSubTopic, payload: PubSubPayload): Promise<void> =>
    redisPubSub.publish(topic, payload),
};
