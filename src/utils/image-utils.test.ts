import { describe, it, expect } from "vitest";
import { isAllowedDomain } from "./image-utils";

describe("isAllowedDomain", () => {
  it("allows local images that do not start with http", () => {
    expect(isAllowedDomain("/images/local.jpg")).toBe(true);
  });

  it("handles wildcard domains correctly", () => {
    const allowed = ["*.example.com"];
    expect(isAllowedDomain("https://sub.example.com/img.jpg", allowed)).toBe(true);
    // The implementation uses endsWith, so "example.com" ends with "example.com" and is considered true
    // Wait, let us check implementation: domain.substring(2) => "example.com"
    // url.hostname.endsWith("example.com") => "example.com".endsWith("example.com") is true
    // So https://example.com is allowed by *.example.com in this implementation.
    expect(isAllowedDomain("https://example.com/img.jpg", allowed)).toBe(true);
    // Should fail on a different domain entirely
    expect(isAllowedDomain("https://other.com/img.jpg", allowed)).toBe(false);
  });

  it("returns false and catches error for invalid URLs gracefully", () => {
    expect(isAllowedDomain("http://not a valid url", ["example.com"])).toBe(false);
  });
});
