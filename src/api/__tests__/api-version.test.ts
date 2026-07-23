import { getApiVersion, requireApiVersion, apiVersionResolver } from "../middleware/api-version";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("getApiVersion", () => {
  it("should extract version from URL path", () => {
    const req = { path: "/api/v2/users" } as unknown as Request;
    expect(getApiVersion(req)).toBe("2");
  });

  it("should extract version from Accept header", () => {
    const req = {
      path: "/api/users",
      get: (header: string) => {
        if (header === "Accept") return "application/vnd.pixelated.v3+json";
        return null;
      },
    } as unknown as Request;
    expect(getApiVersion(req)).toBe("3");
  });

  it("should default to version 1 when no version specified", () => {
    const req = {
      path: "/api/users",
      get: () => null,
    } as unknown as Request;
    expect(getApiVersion(req)).toBe("1");
  });

  it("should prioritize URL path over Accept header", () => {
    const req = {
      path: "/api/v2/users",
      get: (header: string) => {
        if (header === "Accept") return "application/vnd.pixelated.v3+json";
        return null;
      },
    } as unknown as Request;
    expect(getApiVersion(req)).toBe("2");
  });
});

describe("apiVersionResolver", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("should set req.apiVersion from URL path", () => {
    req = { path: "/api/v2/users" };
    apiVersionResolver()(req as Request, res as Response, next as unknown as NextFunction);
    expect(req.apiVersion).toBe("2");
  });

  it("should set req.apiVersion from Accept header", () => {
    req = {
      path: "/api/users",
      get: (header: string) => {
        if (header === "Accept") return "application/vnd.pixelated.v3+json";
        return null;
      },
    } as unknown as Request;
    apiVersionResolver()(req as Request, res as Response, next as unknown as NextFunction);
    expect(req.apiVersion).toBe("3");
  });

  it("should rewrite URL when version is in path", () => {
    req = { path: "/api/v2/users/123" };
    apiVersionResolver()(req as Request, res as Response, next as unknown as NextFunction);
    expect(req.url).toBe("/api/users/123");
  });

  it("should not rewrite URL when no version in path", () => {
    req = { path: "/api/users/123" };
    apiVersionResolver()(req as Request, res as Response, next as unknown as NextFunction);
    expect(req.url).toBe("/api/users/123");
  });

  it("should call next", () => {
    req = { path: "/api/users" };
    apiVersionResolver()(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireApiVersion", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("should call next when version meets minimum requirement", () => {
    req = { path: "/api/v2/users" };
    requireApiVersion("1")(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it("should return 426 when version is below minimum requirement", () => {
    req = { path: "/api/v1/users" };
    requireApiVersion("2")(req as Request, res as Response, next as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(426);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "UPGRADE_REQUIRED",
        message: "API version 2 is required",
        minVersion: "2",
      },
    });
  });

  // Note: the invalid version format branch (isNaN check) is unreachable via
  // normal inputs since getApiVersion's regex only captures \d+. The defensive
  // code remains in case the regex changes, but can't be exercised via mocking
  // due to ES module lexical scoping (requireApiVersion calls getApiVersion
  // directly, not through module exports).
});
