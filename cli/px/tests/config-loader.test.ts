import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadConfig, loadConfigFile } from "../src/lib/config-loader.js";
import { parsePxConfig } from "../src/lib/config-schema.js";
import { deepMerge } from "../src/lib/deep-merge.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "..");
const repoDefaultConfig = join(packageRoot, "..", "..", "agents", "px.config.json");

describe("config schema", () => {
  it("validates the repo default config", () => {
    const config = loadConfigFile(repoDefaultConfig);
    expect(config.agents.content?.tools).toContain("audit_corpus");
    expect(config.hooks?.["pre-commit"]?.agent).toBe("content");
  });

  it("rejects invalid agent endpoints", () => {
    expect(() =>
      parsePxConfig({
        agents: {
          bad: { endpoint: "not-a-url", tools: ["x"] },
        },
      }),
    ).toThrow();
  });
});

describe("deepMerge", () => {
  it("merges nested objects without clobbering siblings", () => {
    const merged = deepMerge(
      {
        agents: {
          content: { endpoint: "http://localhost:2002", tools: ["audit_corpus"] },
        },
      },
      {
        agents: {
          content: { timeout: 60_000 },
        },
      },
    );

    expect(merged.agents.content.endpoint).toBe("http://localhost:2002");
    expect(merged.agents.content.timeout).toBe(60_000);
    expect(merged.agents.content.tools).toEqual(["audit_corpus"]);
  });
});

describe("loadConfig precedence", () => {
  it("applies default < user < repo < cli overrides", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "px-config-repo-"));
    const userDir = mkdtempSync(join(tmpdir(), "px-config-user-"));

    mkdirSync(join(repoRoot, "agents"));
    mkdirSync(join(repoRoot, ".px"));
    mkdirSync(join(repoRoot, ".git"));
    mkdirSync(userDir, { recursive: true });
    mkdirSync(join(userDir, ".px"), { recursive: true });

    writeFileSync(
      join(repoRoot, "agents", "px.config.json"),
      JSON.stringify({
        agents: {
          content: {
            endpoint: "http://default:2000",
            tools: ["audit_corpus"],
            async: false,
            timeout: 30000,
          },
        },
      }),
    );

    writeFileSync(
      join(userDir, ".px", "config.json"),
      JSON.stringify({
        agents: {
          content: {
            endpoint: "http://user:2000",
          },
        },
      }),
    );

    writeFileSync(
      join(repoRoot, ".px", "config.json"),
      JSON.stringify({
        agents: {
          content: {
            endpoint: "http://repo:2000",
          },
        },
      }),
    );

    const originalHome = process.env.HOME;
    process.env.HOME = userDir;

    try {
      const loaded = loadConfig({
        cwd: repoRoot,
        cliOverrides: {
          agent: "content",
          endpoint: "http://cli:2000",
        },
      });

      expect(loaded.config.agents.content?.endpoint).toBe("http://cli:2000");
      expect(loaded.sources.default).toContain("agents/px.config.json");
      expect(loaded.sources.user).toContain(".px/config.json");
      expect(loaded.sources.repo).toContain(".px/config.json");
      expect(loaded.sources.cli).toBe("cli flags");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
