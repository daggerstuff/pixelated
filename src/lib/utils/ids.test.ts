import { describe, it, expect, vi, afterEach } from "vitest";
import { generateUUID, generateId, generatePrefixedId, generateTimestampId } from "./ids";

describe("ids", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("generateUUID", () => {
    it("generates a valid UUID string", () => {
      const mockRandomUUID = vi.fn<() => string>().mockReturnValue("12345678-1234-4234-8234-1234567890ab");
      const originalCrypto = global.crypto;
      vi.stubGlobal("crypto", { ...originalCrypto, randomUUID: mockRandomUUID });

      const uuid = generateUUID();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(uuid).toBe("12345678-1234-4234-8234-1234567890ab");
    });
  });

  describe("generateId", () => {
    it("generates an ID of default length 16", () => {
      expect(generateId().length).toBe(16);
    });
    it("generates an ID of custom length", () => {
      expect(generateId(8).length).toBe(8);
    });
  });

  describe("generatePrefixedId", () => {
    it("generates an ID with the prefix", () => {
      const mockRandomUUID = vi.fn<() => string>().mockReturnValue("12345678-1234-4234-8234-1234567890ab");
      const originalCrypto = global.crypto;
      vi.stubGlobal("crypto", { ...originalCrypto, randomUUID: mockRandomUUID });

      const id = generatePrefixedId("test");
      expect(id).toBe("test-12345678-1234-4234-8234-1234567890ab");
    });
  });

  describe("generateTimestampId", () => {
    it("generates a timestamp-based ID", () => {
      const id1 = generateTimestampId();
      expect(typeof id1).toBe("string");
    });
  });
});
