#!/usr/bin/env python3
"""Run a validation command in an E2B sandbox for the AutoReview merge gate.

Usage:
  python3 scripts/e2b-validate.py <owner/repo> <ref> [--command "..."] [--timeout SECONDS]

Env:
  E2B_API_KEY   (required) — falls back to the repo .env for local runs
  GITHUB_TOKEN  (required) — used to clone the PR ref inside the sandbox

Emits a single JSON object to stdout:
  {"exit_code": 0|1|2, "stdout": "...", "stderr": "...", "duration_ms": int}

exit_code semantics: 0 = validation passed, 1 = validation failed,
2 = wrapper/setup error (missing keys, sandbox create failure).
"""

import json
import os
import sys
import time

DEFAULT_COMMAND = "pnpm install --frozen-lockfile && pnpm test && pnpm lint"
DEFAULT_TIMEOUT = 300


def read_env(key):
    value = os.environ.get(key)
    if value:
        return value
    env_file = os.environ.get("ENV_FILE", "/home/vivi/pixelated/.env")
    try:
        with open(env_file, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


def emit(exit_code, stdout, stderr, duration_ms):
    print(
        json.dumps(
            {
                "exit_code": exit_code,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": duration_ms,
            }
        )
    )


def parse_args(argv):
    repo = None
    ref = None
    command = DEFAULT_COMMAND
    timeout = DEFAULT_TIMEOUT
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg == "--command" and i + 1 < len(argv):
            command = argv[i + 1]
            i += 2
        elif arg == "--timeout" and i + 1 < len(argv):
            try:
                timeout = int(argv[i + 1])
            except ValueError:
                timeout = DEFAULT_TIMEOUT
            i += 2
        elif repo is None:
            repo = arg
            i += 1
        elif ref is None:
            ref = arg
            i += 1
        else:
            i += 1
    return repo, ref, command, timeout


def main():
    repo, ref, command, timeout = parse_args(sys.argv)
    if not repo or not ref:
        emit(2, "", "usage: e2b-validate.py <owner/repo> <ref>", 0)
        return

    api_key = read_env("E2B_API_KEY")
    token = read_env("GITHUB_TOKEN")
    if not api_key or not token:
        emit(2, "", "E2B_API_KEY and GITHUB_TOKEN are required", 0)
        return

    os.environ["E2B_API_KEY"] = api_key
    started = time.time()

    from e2b import Sandbox

    try:
        sandbox = Sandbox.create(template="base", timeout=timeout)
    except Exception as exc:
        emit(2, "", f"sandbox create failed: {exc}", int((time.time() - started) * 1000))
        return

    clone_url = f"https://x-access-token:{token}@github.com/{repo}.git"
    script = f"""#!/bin/bash
set -eo pipefail
export GIT_TERMINAL_PROMPT=0
rm -rf /tmp/repo
git -c core.hooksPath=/dev/null clone --no-tags --depth 1 "{clone_url}" /tmp/repo 2>&1 | tail -5
cd /tmp/repo
git -c core.hooksPath=/dev/null fetch origin {ref} --no-tags 2>&1 | tail -3
git -c core.hooksPath=/dev/null checkout {ref} 2>&1 | tail -5
echo "--- HEAD ---"
git rev-parse HEAD
echo "--- validation ---"
set +e
{command}
EXIT_CODE=$?
echo "VALIDATION_EXIT=$EXIT_CODE"
exit $EXIT_CODE
"""
    try:
        sandbox.files.write("/home/user/validate.sh", script)
        result = sandbox.commands.run("bash /home/user/validate.sh")
        emit(
            result.exit_code if result.exit_code is not None else 1,
            result.stdout or "",
            result.stderr or "",
            int((time.time() - started) * 1000),
        )
    except Exception as exc:
        emit(2, "", f"validation run failed: {exc}", int((time.time() - started) * 1000))
    finally:
        try:
            sandbox.kill()
        except Exception:
            pass


if __name__ == "__main__":
    main()
