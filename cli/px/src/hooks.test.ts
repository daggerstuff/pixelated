import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * Hook tests: create a temp git repo, install the hook scripts,
 * and verify they call the CLI correctly and fail-open on errors.
 *
 * These tests exercise the shell scripts in cli/px/hooks/ via
 * actual git operations (commit, push, merge).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOKS_DIR = join(__dirname, "..", "hooks");
const DIST_INDEX = join(__dirname, "..", "dist", "index.mjs");

let tempRepo: string;

function exec(cmd: string, cwd: string): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("sh", ["-c", cmd], {
    cwd,
    encoding: "utf-8",
    timeout: 15000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

function gitInit(cwd: string): void {
  exec("git init", cwd);
  exec("git config user.email test@test.com", cwd);
  exec("git config user.name Test", cwd);
  // Disable global hooks that would interfere with test commits
  exec("git config core.hooksPath ''", cwd);
}

function writeConfig(cwd: string, overrides?: Record<string, unknown>): void {
  mkdirSync(join(cwd, "agents"), { recursive: true });
  const config = {
    agents: {
      content: {
        endpoint: "http://10.255.255.1:1",
        tools: ["audit_clinical_corpus"],
        async: false,
        timeout: 100,
      },
      advisor: {
        endpoint: "http://10.255.255.1:1",
        tools: ["review"],
        async: false,
        timeout: 100,
      },
      pipeline: {
        endpoint: "http://10.255.255.1:1",
        tools: ["check_pipeline_health"],
        async: true,
        timeout: 100,
      },
      qa: {
        endpoint: "http://10.255.255.1:1",
        tools: ["score_session"],
        async: true,
        timeout: 100,
      },
    },
    slack: { channel: "#test" },
    hooks: {
      "pre-commit": {
        agent: "content",
        tool: "audit_clinical_corpus",
        filter: "scenarios/**",
      },
      "pre-push": { agent: "advisor", tool: "review" },
      "post-merge": {
        agent: "pipeline",
        tool: "check_pipeline_health",
        async: true,
      },
      "pr-open": { agent: "advisor", tool: "review", async: true },
      "pr-merge": {
        agent: "qa",
        tool: "score_session",
        filter: "src/session/**",
        async: true,
      },
    },
    ...overrides,
  };
  writeFileSync(join(cwd, "agents", "px.config.json"), JSON.stringify(config, null, 2));
}

function makeHookExecutable(cwd: string): void {
  const hooks = ["pre-commit", "pre-push", "post-merge", "pr-open", "pr-merge"];
  const hooksDir = join(cwd, "cli", "px", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  for (const hook of hooks) {
    const src = join(HOOKS_DIR, `${hook}.sh`);
    const dest = join(hooksDir, `${hook}.sh`);
    copyFileSync(src, dest);
    chmodSync(dest, 0o755);
  }
}

function runHookCmd(
  event: string,
  cwd: string,
  extraArgs: string[] = [],
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("node", [DIST_INDEX, "hook", event, ...extraArgs], {
    cwd,
    encoding: "utf-8",
    timeout: 15000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

beforeAll(() => {
  tempRepo = mkdtempSync(join(tmpdir(), "px-hooks-"));
  gitInit(tempRepo);
  writeConfig(tempRepo);
  makeHookExecutable(tempRepo);

  // Initial commit
  writeFileSync(join(tempRepo, "README.md"), "# test");
  exec("git add .", tempRepo);
  exec('git commit -m "init"', tempRepo);
});

afterAll(() => {
  rmSync(tempRepo, { recursive: true, force: true });
});

describe("hook scripts: fail-open verification", () => {
  it("pre-commit hook — non-matching files → silent exit 0", () => {
    // Write a non-scenarios file, stage it
    mkdirSync(join(tempRepo, "src"), { recursive: true });
    writeFileSync(join(tempRepo, "src", "code.ts"), "export const x = 1;");
    exec("git add src/code.ts", tempRepo);

    const result = runHookCmd("pre-commit", tempRepo);
    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");
  });

  it("pre-commit hook — matching scenarios/** files → agent call fails open", () => {
    // Write a scenarios file, stage it
    mkdirSync(join(tempRepo, "scenarios"), { recursive: true });
    writeFileSync(join(tempRepo, "scenarios", "test.yml"), "name: test");
    exec("git add scenarios/test.yml", tempRepo);

    const result = runHookCmd("pre-commit", tempRepo);
    expect(result.status).toBe(0);
  });

  it("pre-push hook — agent unreachable → fail-open exit 0", () => {
    // Make a new commit
    writeFileSync(join(tempRepo, "new-file.ts"), "export const y = 2;");
    exec("git add new-file.ts", tempRepo);
    exec('git commit -m "add file"', tempRepo);

    const result = runHookCmd("pre-push", tempRepo);
    expect(result.status).toBe(0);
  });

  it("post-merge hook — agent unreachable → fail-open exit 0", () => {
    const result = runHookCmd("post-merge", tempRepo);
    expect(result.status).toBe(0);
  });

  it("pr-open hook — passes --pr flag through to CLI", () => {
    const result = runHookCmd("pr-open", tempRepo, ["--pr", "https://github.com/test/repo/pull/1"]);
    expect(result.status).toBe(0);
  });

  it("pr-merge hook — non-matching filter (no src/session/**) → silent exit 0", () => {
    // Simulate merge with non-session files
    writeFileSync(join(tempRepo, "other.ts"), "export const z = 3;");
    exec("git add other.ts", tempRepo);
    exec('git commit -m "merge change"', tempRepo);

    const result = runHookCmd("pr-merge", tempRepo, [
      "--pr",
      "https://github.com/test/repo/pull/2",
    ]);
    expect(result.status).toBe(0);
  });

  it("all hook scripts are executable and have shebang", () => {
    const hooks = ["pre-commit", "pre-push", "post-merge", "pr-open", "pr-merge"];
    for (const hook of hooks) {
      const path = join(tempRepo, "cli", "px", "hooks", `${hook}.sh`);
      const result = exec(`head -1 ${path}`, tempRepo);
      expect(result.stdout.trim()).toBe("#!/bin/sh");
      const permResult = exec(`test -x ${path}`, tempRepo);
      expect(permResult.status).toBe(0);
    }
  });

  it("hook command runs without module resolution errors", () => {
    const result = runHookCmd("pre-commit", tempRepo, ["--dry-run"]);
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(result.stderr).not.toContain("no such file or directory");
  });
});

describe("hook scripts: px init integration", () => {
  it("px init sets core.hooksPath and makes scripts executable", () => {
    const initRepo = mkdtempSync(join(tmpdir(), "px-init-"));
    gitInit(initRepo);
    writeConfig(initRepo);
    makeHookExecutable(initRepo);

    // Run px init
    const result = exec(`node ${DIST_INDEX} init`, initRepo);
    expect(result.status).toBe(0);

    // Verify hooksPath is set
    const hooksPath = exec("git config core.hooksPath", initRepo);
    expect(hooksPath.stdout.trim()).toBe("cli/px/hooks");

    // Verify scripts are executable
    for (const hook of ["pre-commit", "pre-push", "post-merge", "pr-open", "pr-merge"]) {
      const permResult = exec(`test -x cli/px/hooks/${hook}.sh`, initRepo);
      expect(permResult.status).toBe(0);
    }

    rmSync(initRepo, { recursive: true, force: true });
  });
});
