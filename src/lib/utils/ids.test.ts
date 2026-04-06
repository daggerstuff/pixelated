import { describe, it, expect, vi, afterEach } from "vitest";
import { generateUUID, generateId, generatePrefixedId, generateTimestampId } from "./ids";

describe("ids utility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("generateUUID", () => {
    it("generates a valid UUID string using crypto.randomUUID", () => {
      const mockRandomUUID = vi.fn().mockReturnValue("12345678-1234-4234-8234-1234567890ab");
      vi.stubGlobal("crypto", { 
        randomUUID: mockRandomUUID,
        getRandomValues: vi.fn() 
      });

      const uuid = generateUUID();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(uuid).toBe("12345678-1234-4234-8234-1234567890ab");
      // Format validation (Review suggestion)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("falls back to getRandomValues when randomUUID is not available", () => {
      // Simulate environment without randomUUID
      vi.stubGlobal("crypto", {
        randomUUID: undefined,
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i;
          return arr;
        }
      });

      const uuid = generateUUID();
      
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(uuid).toHaveLength(36);
    });
  });

  describe("generateId", () => {
    it("generates an ID of default length 16", () => {
      const id = generateId();
      expect(id.length).toBe(16);
      expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
    });

    it("generates an ID of custom length", () => {
      expect(generateId(8).length).toBe(8);
    });

    it("generates different IDs on consecutive calls", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("generatePrefixedId", () => {
    it("generates an ID with the prefix", () => {
      const id = generatePrefixedId("user");
      expect(id.startsWith("user-")).toBe(true);
      expect(id.length).toBe(5 + 36); // "user-" + UUID length
    });
  });

  describe("generateTimestampId", () => {
    it("generates a timestamp-based ID with correct format", () => {
      const id = generateTimestampId();
      // Use case-insensitive matching for alphanumeric suffix (Review suggestion)
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]{8}$/i);
    });

    it("generates unique IDs even when called rapidly", () => {
      const id1 = generateTimestampId();
      const id2 = generateTimestampId();
      expect(id1).not.toBe(id2);
    });
  });
});
