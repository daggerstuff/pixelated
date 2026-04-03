import { describe, it, expect, vi, afterEach } from "vitest";
import { getProjectRoot } from "./path-security.js";

describe("getProjectRoot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return process.cwd() if it exists", () => {
    const mockCwd = "/mock/project/root";
    const originalCwd = process.cwd;

    try {
      process.cwd = vi.fn<any>().mockReturnValue(mockCwd);
      expect(getProjectRoot()).toBe(mockCwd);
      expect(process.cwd).toHaveBeenCalled();
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("should fallback to __dirname logic if process.cwd does not exist", () => {
    const originalCwd = process.cwd;
    const expectedRoot = originalCwd();

    try {
      // Temporarily remove process.cwd to trigger fallback
      Object.defineProperty(process, "cwd", { value: undefined, configurable: true });

      const result = getProjectRoot();
      expect(result).toBe(expectedRoot);
    } finally {
      // Restore
      Object.defineProperty(process, "cwd", { value: originalCwd, configurable: true });
    }
  });
});
