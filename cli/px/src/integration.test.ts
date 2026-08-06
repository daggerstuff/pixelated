import { spawnSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * Integration tests: spin up a mock eve agent HTTP server in a SEPARATE
 * child process (spawn, not spawnSync — spawnSync blocks the event loop
 * and prevents the server from handling requests), then call the compiled
 * CLI binary against it to verify end-to-end behavior.
 *
 * These tests require the CLI to be built (`tsup`). They run the
 * `dist/index.js` binary directly via node.
 */

let mockServer: ChildProcess;
let serverPort: number;
let tempRepo: string;

/**
 * Mock server script — runs in a separate process to avoid event loop
 * blocking from spawnSync.
 */
const MOCK_SERVER_SCRIPT = `
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/eve/v1/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.method === 'POST' && req.url?.startsWith('/eve/v1/')) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        result: { reviewed: true, score: 87, issues: [] },
        task_id: 'task-abc-123',
      }));
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
const port = parseInt(process.argv[2], 10);
server.listen(port, '127.0.0.1', () => {
  process.send({ ready: true, port });
});
process.on('message', (msg) => {
  if (msg === 'shutdown') { server.close(); process.exit(0); }
});
`;

function startMockServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(tmpdir(), "px-mock-server.cjs");
    writeFileSync(scriptPath, MOCK_SERVER_SCRIPT);

    mockServer = spawn("node", [scriptPath, String(port)], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    mockServer.on("error", reject);

    mockServer.on("message", (msg: { ready: boolean }) => {
      if (msg.ready) resolve();
    });

    mockServer.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Mock server exited with code ${code}`));
      }
    });

    // Timeout if server doesn't start
    setTimeout(() => reject(new Error("Mock server failed to start")), 5000);
  });
}

function runCli(
  args: string[],
  cwd: string,
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("node", [join(__dirname, "..", "dist", "index.mjs"), ...args], {
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

beforeAll(async () => {
  // Start mock server on a random port in a separate process
  serverPort = 4123 + Math.floor(Math.random() * 1000);
  await startMockServer(serverPort);

  // Create temp git repo with config pointing to mock server
  tempRepo = mkdtempSync(join(tmpdir(), "px-integration-"));
  mkdirSync(join(tempRepo, "agents"));

  // Init git repo
  spawnSync("git", ["init"], { cwd: tempRepo, encoding: "utf-8" });
  spawnSync("git", ["config", "user.email", "test@test.com"], {
    cwd: tempRepo,
    encoding: "utf-8",
  });
  spawnSync("git", ["config", "user.name", "Test"], {
    cwd: tempRepo,
    encoding: "utf-8",
  });
  // Disable global hooks that would interfere with test commits
  spawnSync("git", ["config", "core.hooksPath", ""], {
    cwd: tempRepo,
    encoding: "utf-8",
  });

  // Write config pointing to mock server
  const config = {
    agents: {
      advisor: {
        endpoint: `http://127.0.0.1:${serverPort}`,
        tools: ["review", "get_worktree", "read_file"],
        async: false,
        timeout: 5000,
      },
      content: {
        endpoint: `http://127.0.0.1:${serverPort}`,
        tools: [
          "audit_corpus",
          "audit_clinical_corpus",
          "score_thread",
          "curate_showcase",
          "gate_injection",
        ],
        async: false,
        timeout: 5000,
      },
      qa: {
        endpoint: `http://127.0.0.1:${serverPort}`,
        tools: [
          "score_session",
          "fetch_sessions",
          "detect_emotional_patterns",
          "flag_training_gap",
          "summarize_cohort",
          "generate_report",
        ],
        async: true,
        timeout: 5000,
      },
    },
    slack: {
      webhook: "https://hooks.slack.com/services/fake",
      channel: "#test-results",
    },
    hooks: {
      "pre-commit": {
        agent: "content",
        tool: "audit_clinical_corpus",
        filter: "scenarios/**",
      },
      "pre-push": { agent: "advisor", tool: "review" },
      "post-merge": { agent: "qa", tool: "score_session", async: true },
    },
  };
  writeFileSync(join(tempRepo, "agents", "px.config.json"), JSON.stringify(config, null, 2));

  // Make an initial commit so git is usable
  writeFileSync(join(tempRepo, "README.md"), "# test repo");
  spawnSync("git", ["add", "."], { cwd: tempRepo, encoding: "utf-8" });
  spawnSync("git", ["commit", "-m", "init"], {
    cwd: tempRepo,
    encoding: "utf-8",
  });
});

afterAll(() => {
  if (mockServer) {
    try {
      mockServer.send("shutdown");
    } catch {
      /* ignore */
    }
    mockServer.kill("SIGTERM");
  }
  rmSync(tempRepo, { recursive: true, force: true });
  rmSync(join(tmpdir(), "px-mock-server.cjs"), { force: true });
});

describe("integration: CLI against mock eve server", () => {
  it("px list shows all agents from config", () => {
    const { stdout, status } = runCli(["list"], tempRepo);
    expect(status).toBe(0);
    expect(stdout).toContain("advisor");
    expect(stdout).toContain("content");
    expect(stdout).toContain("qa");
    expect(stdout).toContain("review");
    expect(stdout).toContain("audit_corpus");
  });

  it("px config shows resolved config with sources", () => {
    const { stdout, status } = runCli(["config"], tempRepo);
    expect(status).toBe(0);
    expect(stdout).toContain("advisor");
    expect(stdout).toContain("#test-results");
  });

  it("px advisor review — interactive call returns formatted response", () => {
    const { stdout, status } = runCli(["advisor", "review"], tempRepo);
    expect(status).toBe(0);
    expect(stdout).toContain("ok");
    expect(stdout).toContain("87");
  });

  it("px advisor review --json — returns raw JSON", () => {
    const { stdout, status } = runCli(["advisor", "review", "--json"], tempRepo);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe("ok");
    expect(parsed.result.score).toBe(87);
  });

  it("px advisor review --dry-run — prints intent without calling", () => {
    const { stdout, status } = runCli(["advisor", "review", "--dry-run"], tempRepo);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.method).toBe("POST");
    expect(parsed.agent).toBe("advisor");
    expect(parsed.tool).toBe("review");
    expect(parsed.url).toContain("/eve/v1/review");
  });

  it("px qa score_session — async mode returns task ID", () => {
    const { stdout, status } = runCli(["qa", "score_session"], tempRepo);
    expect(status).toBe(0);
    expect(stdout).toContain("task-abc-123");
    expect(stdout).toContain("#test-results");
  });

  it("px health — pings mock server health endpoint", () => {
    const { stdout, status } = runCli(["health"], tempRepo);
    expect(status).toBe(0);
    expect(stdout).toContain("advisor");
    // All agents point to same mock server — should show ok
    expect(stdout).toContain("✓");
  });

  it("px hook pre-push --dry-run — prints payload with git context", () => {
    // Make a new commit so there are unpushed commits
    writeFileSync(join(tempRepo, "test-file.ts"), "export const x = 1;");
    spawnSync("git", ["add", "."], { cwd: tempRepo, encoding: "utf-8" });
    spawnSync("git", ["commit", "-m", "add test file"], {
      cwd: tempRepo,
      encoding: "utf-8",
    });

    const { stdout, status } = runCli(["hook", "pre-push", "--dry-run"], tempRepo);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.agent).toBe("advisor");
    expect(parsed.tool).toBe("review");
    expect(parsed.body).toHaveProperty("event", "pre-push");
    expect(parsed.body).toHaveProperty("branch");
  });

  it("px hook pre-commit --dry-run — filter excludes non-scenarios files", () => {
    // Stage a non-scenarios file
    writeFileSync(join(tempRepo, "regular-code.ts"), "export const y = 2;");
    spawnSync("git", ["add", "regular-code.ts"], {
      cwd: tempRepo,
      encoding: "utf-8",
    });

    const { stdout, status } = runCli(["hook", "pre-commit", "--dry-run"], tempRepo);
    expect(status).toBe(0);
    // Filter is scenarios/** — regular-code.ts doesn't match → silent exit, no output
    expect(stdout.trim()).toBe("");
  });

  it("px hook post-merge --dry-run — async hook prints payload", () => {
    const { stdout, status } = runCli(["hook", "post-merge", "--dry-run"], tempRepo);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.agent).toBe("qa");
    expect(parsed.tool).toBe("score_session");
    expect(parsed.async).toBe(true);
    expect(parsed.body).toHaveProperty("event", "post-merge");
  });

  it("px advisor review --timeout 1 — timeout exits with error (interactive)", () => {
    // Use a non-responsive port to trigger timeout
    const slowConfig = {
      agents: {
        advisor: {
          endpoint: "http://10.255.255.1:1",
          tools: ["review"],
          async: false,
          timeout: 1,
        },
      },
    };
    mkdirSync(join(tempRepo, ".px"), { recursive: true });
    writeFileSync(join(tempRepo, ".px", "config.json"), JSON.stringify(slowConfig));

    const { stderr, status } = runCli(["advisor", "review"], tempRepo);
    expect(status).toBe(1);
    expect(stderr).toContain("px:");

    // Clean up override
    rmSync(join(tempRepo, ".px"), { recursive: true, force: true });
  });
});
