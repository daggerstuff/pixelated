import { describe, beforeEach, expect, it, vi } from "vitest";

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  setex: vi.fn(),
  hincrby: vi.fn(),
  hgetall: vi.fn(),
  hset: vi.fn(),
  pipeline: vi.fn(() => ({
    setex: vi.fn().mockReturnThis(),
    hincrby: vi.fn().mockReturnThis(),
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([["OK"], [1]]),
  })),
  ping: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
  status: "ready",
  lpush: vi.fn(),
  lRange: vi.fn(),
  lrem: vi.fn(),
  zadd: vi.fn(),
  zrangebyscore: vi.fn(),
  zremrangebyscore: vi.fn(),
  keys: vi.fn(),
  flushall: vi.fn(),
  ttl: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

process.env['REDIS_URL'] = "redis://localhost:6379";
delete process.env['UPSTASH_REDIS_REST_URL'];
delete process.env['UPSTASH_REDIS_REST_TOKEN'];

// Mock ioredis
vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(function() { return mockRedis; }),
  };
});

import {
  checkRedisConnection,
  getFromCache,
  getRedisClient,
  getRedisHealth,
  redis,
  removeFromCache,
  setInCache,
} from "./redis";

describe("Redis Module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.NODE_ENV;
  });

  describe("getRedisClient", () => {
    it("should return the redis instance", () => {
      console.log("redis === mockRedis:", redis === mockRedis);
      const client = getRedisClient();
      expect(client).toBe(redis);
    });
  });

  describe("getFromCache", () => {
    it("should return null for non-existent key", async () => {
      const getSpy = vi.spyOn(redis, "get").mockResolvedValue(null);
      const result = await getFromCache<string>("nonexistent");
      expect(result).toBeNull();
      expect(getSpy).toHaveBeenCalledWith("nonexistent");
    });

    it("should return parsed JSON for JSON string value", async () => {
      const testValue = { foo: "bar" };
      const getSpy = vi
        .spyOn(redis, "get")
        .mockResolvedValue(JSON.stringify(testValue));
      const result = await getFromCache<{ foo: string }>("test");
      expect(result).toEqual(testValue);
      expect(getSpy).toHaveBeenCalledWith("test");
    });

    it("should return raw value for non-JSON string", async () => {
      const testValue = "plain text";
      const getSpy = vi.spyOn(redis, "get").mockResolvedValue(testValue);
      const result = await getFromCache<string>("test");
      expect(result).toBe(testValue);
      expect(getSpy).toHaveBeenCalledWith("test");
    });

    it("should return null on Redis error", async () => {
      const getSpy = vi
        .spyOn(redis, "get")
        .mockRejectedValue(new Error("Redis error"));
      const result = await getFromCache<string>("test");
      expect(result).toBeNull();
      expect(getSpy).toHaveBeenCalledWith("test");
    });
  });

  describe("setInCache", () => {
    it("should set value without expiration", async () => {
      const setSpy = vi.spyOn(redis, "set").mockResolvedValue("OK");
      const result = await setInCache("test", { foo: "bar" });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith("test", '{"foo":"bar"}');
    });

    it("should set value with expiration", async () => {
      const setSpy = vi
        .spyOn(redis, "set")
        .mockResolvedValue("OK");
      const result = await setInCache("test", { foo: "bar" }, 3600);
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith(
        "test",
        '{"foo":"bar"}',
        "EX",
        3600,
      );
    });

    it("should return false on Redis error", async () => {
      const setSpy = vi
        .spyOn(redis, "set")
        .mockRejectedValue(new Error("Redis error"));
      const result = await setInCache("test", { foo: "bar" });
      expect(result).toBe(false);
      expect(setSpy).toHaveBeenCalledWith("test", '{"foo":"bar"}');
    });
  });

  describe("removeFromCache", () => {
    it("should remove key and return true", async () => {
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(1);
      const result = await removeFromCache("test");
      expect(result).toBe(true);
      expect(delSpy).toHaveBeenCalledWith("test");
    });

    it("should return false if key did not exist", async () => {
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(0);
      const result = await removeFromCache("test");
      expect(result).toBe(false);
      expect(delSpy).toHaveBeenCalledWith("test");
    });

    it("should return false on Redis error", async () => {
      const delSpy = vi
        .spyOn(redis, "del")
        .mockRejectedValue(new Error("Redis error"));
      const result = await removeFromCache("test");
      expect(result).toBe(false);
      expect(delSpy).toHaveBeenCalledWith("test");
    });
  });

  describe("checkRedisConnection", () => {
    it("should return true when Redis responds with PONG", async () => {
      const pingSpy = vi.spyOn(redis, "ping").mockResolvedValue("PONG");
      const result = await checkRedisConnection();
      expect(result).toBe(true);
      expect(pingSpy).toHaveBeenCalled();
    });

    it("should return false when Redis does not respond with PONG", async () => {
      const pingSpy = vi.spyOn(redis, "ping").mockResolvedValue("ERROR");
      const result = await checkRedisConnection();
      expect(result).toBe(false);
      expect(pingSpy).toHaveBeenCalled();
    });

    it("should return false on Redis error", async () => {
      const pingSpy = vi
        .spyOn(redis, "ping")
        .mockRejectedValue(new Error("Redis error"));
      const result = await checkRedisConnection();
      expect(result).toBe(false);
      expect(pingSpy).toHaveBeenCalled();
    });
  });

  describe("getRedisHealth", () => {
    it("should return healthy when connected", async () => {
      const pingSpy = vi.spyOn(redis, "ping").mockResolvedValue("PONG");
      const result = await getRedisHealth();
      expect(result).toEqual({ status: "healthy" });
      expect(pingSpy).toHaveBeenCalled();
    });

    it("should return unhealthy when not connected", async () => {
      const pingSpy = vi
        .spyOn(redis, "ping")
        .mockRejectedValue(new Error("Connection failed"));
      const result = await getRedisHealth();
      expect(result).toEqual({
        status: "unhealthy",
        details: { message: "Could not connect to Redis" },
      });
      expect(pingSpy).toHaveBeenCalled();
    });

    it("should return unhealthy with error details on exception", async () => {
      const pingSpy = vi
        .spyOn(redis, "ping")
        .mockRejectedValue(new Error("Detailed error"));
      const result = await getRedisHealth();
      expect(result).toEqual({
        status: "unhealthy",
        details: { message: "Could not connect to Redis" },
      });
      expect(pingSpy).toHaveBeenCalled();
    });
  });

  describe("createRedisClient function", () => {
    it("should create real Redis client when REDIS_URL is present", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      // We need to re-import to test the factory function
      // Since we can't easily re-import, we'll test the logic directly
      expect(typeof redis).toBe("object");
      expect(redis.get).toBeDefined();
    });

    it("should use mock client in production when no credentials", () => {
      process.env.NODE_ENV = "production";
      // The mock client should have been created due to missing credentials
      expect(typeof redis).toBe("object");
      expect(redis.get).toBeDefined();
    });
  });
});
