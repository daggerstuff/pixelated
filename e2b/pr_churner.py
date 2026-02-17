#!/usr/bin/env python3
"""
PR Churner: E2B-Powered PR Automation for Pixelated Empathy.

This script automates the validation and "churning" of the GitHub PR backlog.
Each PR is processed in a fresh, isolated E2B sandbox mirroring the dev stack.

Usage:
    # Ensure .env contains GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_INSTALLATION_ID
    uv run e2b/pr_churner.py [--limit 5] [--dry-run] [--fix]
"""

import argparse
import json
import logging
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any

# Third-party imports
import jwt
import requests
from dotenv import load_dotenv

try:
    from e2b import Sandbox
except ImportError:
    Sandbox = None

try:
    from agents.pr_fixer import PRFixerAgent
except ImportError:
    from e2b.agents.pr_fixer import PRFixerAgent

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("pr_churner")

# --- Constants ---
TEMPLATE_NAME = "pixelated-empathy"  # Fallback to base, use 'pixelated-empathy' if built locally
FALLBACK_TEMPLATE = "base"
WORKSPACE_DIR = "/home/user/pixelated"
MAX_PR_LIMIT = 50

# --- Data Structures ---


@dataclass
class PRInfo:
    number: int
    title: str
    head_ref: str
    base_ref: str
    author: str
    mergeable: bool
    status_checks: list[dict[str, Any]]


@dataclass
class ValidationResult:
    pr_number: int
    passed: bool
    lint_ok: bool
    typecheck_ok: bool
    tests_ok: bool
    logs: str = ""
    error: str | None = None


class SandboxError(Exception):
    """Raised when an operation in the E2B sandbox fails."""


# --- Helpers ---


def check_tool_availability(tool_name: str) -> bool:
    """Check if a tool is available in the system PATH."""
    return shutil.which(tool_name) is not None


def run_local_cmd(
    cmd: list[str],
    capture_output: bool = True,
    timeout: int = 60,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    """Run a command on the local machine with timeout."""
    try:
        logger.debug(f"Running command: {' '.join(cmd)}")
        return subprocess.run(
            cmd, capture_output=capture_output, text=True, check=True, timeout=timeout, env=env
        )
    except subprocess.TimeoutExpired:
        logger.error(f"Command timed out after {timeout}s: {' '.join(cmd)}")
        raise
    except subprocess.CalledProcessError as e:
        logger.error(f"Local command failed: {' '.join(cmd)}")
        if capture_output:
            logger.error(f"Stderr: {e.stderr}")
        raise


def generate_installation_token() -> str:
    """
    Generate a GitHub App Installation Access Token using credentials from env.
    Returns: The access token string.
    """
    app_id = os.environ.get("GITHUB_APP_ID")
    private_key = os.environ.get("GITHUB_APP_PRIVATE_KEY")
    installation_id = os.environ.get("GITHUB_INSTALLATION_ID")

    if not all([app_id, private_key, installation_id]):
        logger.error(
            "Missing GitHub App credentials (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_INSTALLATION_ID)."
        )
        sys.exit(1)

    # 1. Create JWT
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + (10 * 60),  # 10 minutes max
        "iss": app_id,
    }

    try:
        encoded_jwt = jwt.encode(payload, private_key, algorithm="RS256")
    except Exception as e:
        logger.error(f"Failed to sign JWT: {e}")
        sys.exit(1)

    # 2. Exchange JWT for Installation Access Token
    headers = {
        "Authorization": f"Bearer {encoded_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"

    try:
        response = requests.post(url, headers=headers, timeout=10)
        response.raise_for_status()
        token_data = response.json()
        return token_data["token"]
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get installation access token: {e}")
        if e.response:
            logger.error(f"Response: {e.response.text}")
        sys.exit(1)


def get_repo_owner_name(repo_url: str) -> tuple[str, str]:
    """Extract owner and repo name from URL."""
    # Handles https://github.com/owner/repo.git and git@github.com:owner/repo.git
    clean_url = repo_url.rstrip(".git")
    if "github.com/" in clean_url:
        parts = clean_url.split("github.com/")[-1].split("/")
    elif "github.com:" in clean_url:
        parts = clean_url.split("github.com:")[-1].split("/")
    else:
        raise ValueError(f"Could not parse repo URL: {repo_url}")

    if len(parts) < 2:
        raise ValueError(f"Invalid repo URL format: {repo_url}")

    return parts[0], parts[1]


def fetch_unresolved_threads(owner: str, repo: str, pr_number: int, token: str) -> list[dict]:
    """Fetch unresolved review threads via GraphQL."""
    query = """
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(last: 50) {
            nodes {
              id
              isResolved
              path
              comments(last: 1) {
                nodes {
                  body
                  author { login }
                }
              }
            }
          }
        }
      }
    }
    """

    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token

    try:
        # Use gh api graphql for simplicity and auth handling
        cmd = [
            "gh",
            "api",
            "graphql",
            "-F",
            f"owner={owner}",
            "-F",
            f"repo={repo}",
            "-F",
            f"pr={pr_number}",
            "-f",
            f"query={query}",
        ]
        result = run_local_cmd(cmd, timeout=30, env=env)
        data = json.loads(result.stdout)

        threads = data["data"]["repository"]["pullRequest"]["reviewThreads"]["nodes"]
        # Filter: Unresolved AND Last comment is NOT from bot (to avoid loops)
        # Assuming bot user "churner-bot" or similar. For now, check if author is NOT null.
        unresolved = []
        for t in threads:
            if t["isResolved"]:
                continue

            last_comment = t["comments"]["nodes"][0]
            # Simple check: If last comment starts with "Bot:", skip (basic loop prevention)
            # Better check would be comparing login, but let's assume human comments don't look like bot outputs
            unresolved.append(
                {
                    "id": t["id"],
                    "path": t["path"],
                    "body": last_comment["body"],
                    "author": last_comment["author"]["login"]
                    if last_comment["author"]
                    else "unknown",
                }
            )

        return unresolved
    except Exception as e:
        logger.error(f"Failed to fetch threads: {e}")
        return []


def resolve_thread(thread_id: str, token: str):
    """Mark a review thread as resolved."""
    query = """
    mutation($id: ID!) {
      resolveReviewThread(input: {threadId: $id}) {
        thread { isResolved }
      }
    }
    """
    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token

    try:
        cmd = ["gh", "api", "graphql", "-F", f"id={thread_id}", "-f", f"query={query}"]
        run_local_cmd(cmd, timeout=10, env=env)
        logger.info(f"Resolved thread {thread_id}")
    except Exception as e:
        logger.error(f"Failed to resolve thread {thread_id}: {e}")


def get_open_prs(limit: int, token: str) -> list[PRInfo]:
    """Fetch open PRs using the GitHub CLI with authenticated env."""
    if not check_tool_availability("gh"):
        logger.error("GitHub CLI (gh) is not installed.")
        sys.exit(1)

    # Inject token into environment for gh CLI
    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token

    logger.info(f"Fetching open PRs to find the oldest {limit}...")
    # Fetch a larger batch to ensure we can find the oldest ones
    cmd = [
        "gh",
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "number,title,headRefName,baseRefName,author,mergeable,statusCheckRollup,createdAt",
    ]
    try:
        result = run_local_cmd(cmd, timeout=30, env=env)
        data = json.loads(result.stdout)
        # Sort by createdAt ascending (oldest first)
        data.sort(key=lambda x: x.get("createdAt", ""))
        # Take only the number requested
        data = data[:limit]
    except json.JSONDecodeError:
        logger.error("Failed to parse GH CLI output.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to fetch PRs: {e}")
        sys.exit(1)

    return [
        PRInfo(
            number=item["number"],
            title=item["title"],
            head_ref=item["headRefName"],
            base_ref=item["baseRefName"],
            author=item["author"]["login"],
            mergeable=item["mergeable"] == "MERGEABLE",
            status_checks=item.get("statusCheckRollup", []),
        )
        for item in data
    ]


class SandboxManager:
    """Wrapper around E2B Sandbox for PR operations."""

    def __init__(self, api_key: str, template: str = TEMPLATE_NAME):
        self.api_key = api_key
        self.template = template
        self.sandbox = None

    def __enter__(self):
        if Sandbox is None:
            logger.error("e2b package not found. Run 'uv add e2b'")
            sys.exit(1)

        logger.info(f"Creating E2B Sandbox (template: {self.template})...")
        try:
            self.sandbox = Sandbox.create(
                self.template,
                api_key=self.api_key,
                timeout=600,  # 10 minutes
            )
        except Exception as e:
            if "404" not in str(e) or self.template == FALLBACK_TEMPLATE:
                raise
            logger.warning(
                f"Template {self.template} not found. Falling back to {FALLBACK_TEMPLATE}."
            )
            self.sandbox = Sandbox.create(FALLBACK_TEMPLATE, api_key=self.api_key, timeout=600)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.sandbox:
            logger.info(f"Destroying sandbox {self.sandbox.sandbox_id}")
            self.sandbox.kill()

    def run(self, cmd: str, timeout: int = 300, cwd: str = WORKSPACE_DIR) -> dict[str, Any]:
        """Run a command inside the sandbox."""
        logger.debug(f"Sandbox Run: {cmd} (cwd: {cwd})")
        try:
            # Ensure dir exists before running
            self.sandbox.commands.run(f"mkdir -p {cwd}")
            result = self.sandbox.commands.run(cmd, timeout=timeout, cwd=cwd)
            return {"stdout": result.stdout, "stderr": result.stderr, "exit_code": result.exit_code}
        except Exception as e:
            # If it's a command exit error, it often contains the result
            if hasattr(e, "result"):
                res = e.result
                return {"stdout": res.stdout, "stderr": res.stderr, "exit_code": res.exit_code}
            # Otherwise, just return a fake failure result
            return {"stdout": "", "stderr": str(e), "exit_code": 1}

    def setup_repo(self, repo_url: str, branch: str, token: str):
        """Clone and setup the repository in the sandbox."""
        logger.info(f"Setting up repo for branch: {branch}")

        # Construct authenticated URL for cloning
        if repo_url.startswith("https://github.com/"):
            auth_repo_url = repo_url.replace(
                "https://github.com/", f"https://x-access-token:{token}@github.com/"
            )
        elif repo_url.startswith("git@github.com:"):
            auth_repo_url = repo_url.replace(
                "git@github.com:", f"https://x-access-token:{token}@github.com/"
            )
        else:
            # Fallback or already configured
            auth_repo_url = repo_url

        setup_script = f"""
        set -e
        mkdir -p {WORKSPACE_DIR}

        # 1. Force pnpm via corepack and ensure PATH is correct
        corepack enable
        corepack prepare pnpm@10.29.3 --activate
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"

        # 2. Prevent npm interference
        # Delete any .npmrc that might contain incompatible configs in a pnpm project
        find $HOME {WORKSPACE_DIR} -name ".npmrc" -type f -delete 2>/dev/null || true

        # 3. Install uv
        if ! command -v uv &> /dev/null; then
            echo "Installing uv..."
            curl -LsSf https://astral.sh/uv/install.sh | sh
            export PATH="$HOME/.local/bin:$PATH"
        fi

        # 4. Git config
        git config --global user.email 'churner@pixelated.empathy'
        git config --global user.name 'PR Churner Bot'
        git config --global url."https://x-access-token:{token}@github.com/".insteadOf "https://github.com/"

        # 5. Clone/Checkout
        if ! [ -d "{WORKSPACE_DIR}/.git" ]; then
            git clone --depth 1 --branch {branch} {auth_repo_url} {WORKSPACE_DIR} || \
            (git clone --depth 1 {auth_repo_url} {WORKSPACE_DIR} && cd {WORKSPACE_DIR} && git checkout {branch})
        fi

        # 6. Install dependencies
        cd {WORKSPACE_DIR}
        if ! pnpm install --no-frozen-lockfile; then
            echo "--- PNPM INSTALL FAILED ---"
            if [ -f "scripts/ci/ci-diagnostics.sh" ]; then
                echo "Running environment diagnostics..."
                bash scripts/ci/ci-diagnostics.sh
            fi
            exit 1
        fi
        """

        # Hide token in log output if possible, but shlex.quote is safe for execution
        # We purposely don't log the full setup_script content elsewhere
        # Run setup script from /home/user because WORKSPACE_DIR might not exist yet
        res = self.run(f"bash -c {shlex.quote(setup_script)}", timeout=900, cwd="/home/user")
        if res["exit_code"] != 0:
            # Join stdout and stderr to get full context (including diagnostics)
            full_output = f"{res['stdout']}\n{res['stderr']}"
            safe_output = full_output.replace(token, "***TOKEN***")
            raise SandboxError(f"Setup failed:\n{safe_output}")


def _extract_patch_content(comment_body: str) -> str | None:
    """Extract and clean patch content from <file context> tags."""
    if "<file context>" in comment_body and "</file context>" in comment_body:
        start = comment_body.find("<file context>") + len("<file context>")
        end = comment_body.find("</file context>")
        return comment_body[start:end].strip()
    return None


def _extract_filepath(comment_body: str) -> str | None:
    """Extract filename from comment body using regex."""
    if match := re.search(r"At (.*?), line \d+:", comment_body):
        return match[1]
    return None


def apply_patch_from_comment(comment_body: str, sm: SandboxManager) -> bool:
    """Parses a patch from comment body and applies it in the sandbox."""
    try:
        # 1. Extract file context block
        patch_content = _extract_patch_content(comment_body)
        if not patch_content:
            return False

        # 2. Extract filename
        filepath = _extract_filepath(comment_body)
        if not filepath:
            logger.warning("Could not extract filename from comment body")
            return False

        # 3. Apply
        full_patch = f"--- a/{filepath}\n+++ b/{filepath}\n{patch_content}\n"
        patch_path = f"/tmp/patch_{os.urandom(4).hex()}.diff"
        sm.sandbox.files.write(patch_path, full_patch)

        cmd = f"git apply --ignore-space-change --ignore-whitespace {patch_path}"
        res = sm.run(cmd)

        if res["exit_code"] == 0:
            logger.info(f"Successfully applied patch to {filepath}")
            return True

        logger.warning(f"Failed to apply patch to {filepath}: {res['stderr']}")
        return False

    except Exception as e:
        logger.error(f"Error applying patch: {e}")
        return False


def _git_commit_and_push(sm: SandboxManager, pr_number: int) -> bool:
    """Helper to commit and push changes."""
    # Config git
    sm.run('git config user.email "bot@pixelated-empathy.com"')
    sm.run('git config user.name "PR Churner Bot"')

    # Add, Commit
    sm.run("git add .")
    res_commit = sm.run(
        f'git commit -m "fix: Apply suggestions from code review (PR #{pr_number})"'
    )
    if res_commit["exit_code"] != 0 and "nothing to commit" not in res_commit["stdout"].lower():
        logger.warning(f"Failed to commit: {res_commit['stderr']}")
        return False

    # Attempt Push
    res_push = sm.run("git push origin HEAD")
    if res_push["exit_code"] == 0:
        logger.info("Successfully pushed changes.")
        return True

    # Handle divergence (fetch or rebase required)
    if "rejected" in res_push["stderr"] or "fetch first" in res_push["stderr"]:
        return _handle_push_divergence(sm)

    logger.error(f"Failed to push changes: {res_push['stderr']}")
    return False


def _handle_push_divergence(sm: SandboxManager) -> bool:
    """Handle push rejection due to remote divergence by attempting a rebase."""
    logger.info("Push rejected due to remote divergence. Attempting rebase...")

    # Get current branch
    res_branch = sm.run("git branch --show-current")
    branch = res_branch["stdout"].strip()
    if not branch:
        logger.error("Could not determine current branch for rebase.")
        return False

    # Pull with rebase
    res_pull = sm.run(f"git pull --rebase origin {branch}")
    if res_pull["exit_code"] != 0:
        logger.error(f"Rebase failed: {res_pull['stderr']}")
        # In case of merge conflict, we should probably abort or notify
        sm.run("git rebase --abort")
        return False

    # Final Push
    res_push_final = sm.run("git push origin HEAD")
    if res_push_final["exit_code"] == 0:
        logger.info("Successfully pushed changes after rebase.")
        return True
    logger.error(f"Final push failed: {res_push_final['stderr']}")
    return False


def push_changes(sm: SandboxManager, pr_number: int) -> bool:
    """Commits and pushes changes if any."""
    try:
        # Check for changes
        status = sm.run("git status --porcelain")
        if not status["stdout"].strip():
            logger.info("No changes to push.")
            return False

        return _git_commit_and_push(sm, pr_number)

    except Exception as e:
        logger.error(f"Error pushing changes: {e}")
        return False


def reply_to_thread(thread_id: str, body: str, token: str) -> bool:
    """Replies to a GitHub PR thread using GraphQL."""
    if not token:
        logger.warning(f"No token provided, skipping reply to thread {thread_id}")
        return False

    mutation = """
    mutation($threadId: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
        comment { id }
      }
    }
    """

    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token

    try:
        # Use gh api graphql for simplicity
        cmd = [
            "gh",
            "api",
            "graphql",
            "-F",
            f"threadId={thread_id}",
            "-F",
            f"body={body}",
            "-f",
            f"query={mutation}",
        ]
        # Note: Large bodies might hit CLI limits, but for PR comments it's usually fine.
        run_local_cmd(cmd, timeout=30, env=env)
        return True
    except Exception as e:
        # Don't crash chruner if reply fails
        logger.error(f"Failed to reply to thread {thread_id}: {e}")
        return False


def _process_single_thread(
    thread: dict, sm: SandboxManager, fixer_agent: PRFixerAgent, token: str
) -> tuple[str | None, int, bool]:
    """
    Process a single thread.
    Returns (resolved_thread_id, tokens_used, fix_applied).
    """
    rel_path = thread.get("path")
    if not rel_path:
        logger.warning(f"Skipping thread {thread['id']}: No associated file path.")
        return None, 0, False

    abs_path = os.path.join(WORKSPACE_DIR, rel_path)
    usage = 0
    resolved_id = None
    fix_applied = False

    try:
        # 1. Read file
        try:
            file_content = sm.sandbox.files.read(abs_path)
        except Exception as e:
            logger.error(f"Failed to read {abs_path}: {e}")
            return None, 0, False

        if len(file_content) > 100_000:
            logger.warning(f"File {abs_path} too large, skipping.")
        else:
            # 2. Fix
            logger.info(f"Asking Agent to fix {rel_path}...")
            fixed_content, stats = fixer_agent.fix(rel_path, file_content, thread["body"])
            usage = stats.get("total_tokens", 0) if stats else 0
            logger.info(f"[METRICS] Agent usage for {rel_path}: {usage} tokens")

            # 3. Apply
            if fixed_content and fixed_content != file_content:
                sm.sandbox.files.write(abs_path, fixed_content)
                logger.info(f"Applied Agent fix for thread {thread['id']} ({rel_path})")

                # Reply
                reply_to_thread(
                    thread["id"],
                    f"🤖 **Agent Fix Applied**\n\nI have automatically applied a fix for this comment:\n\n> {thread['body']}\n\nPlease review the changes.",
                    token,
                )
                logger.info(f"Replied to thread {thread['id']} confirming fix.")
                resolved_id = thread["id"]
                fix_applied = True

    except Exception as e:
        logger.error(f"Error processing thread {thread['id']}: {e}")

    return resolved_id, usage, fix_applied


def _process_comments(
    pr: PRInfo, sm: SandboxManager, repo_url: str, token: str, dry_run: bool
) -> list[str]:
    """
    Process unresolved comments for a PR.
    Returns a list of resolved thread IDs.
    """
    try:
        owner, repo_name = get_repo_owner_name(repo_url)
        if not (unresolved := fetch_unresolved_threads(owner, repo_name, pr.number, token)):
            logger.info(f"No actionable threads in PR #{pr.number}")
            return []

        logger.info(f"Found {len(unresolved)} unresolved threads in PR #{pr.number}")
        threads_resolvable = []

        requests_made = 0
        total_tokens_used = 0
        fixer_agent = PRFixerAgent()

        for thread in unresolved:
            logger.info(f"Processing thread {thread['id']} on {thread.get('path', 'unknown')}")

            res_tuple = _process_single_thread(thread, sm, fixer_agent, token)
            if not isinstance(res_tuple, tuple) or len(res_tuple) != 3:
                logger.error(f"Invalid return from _process_single_thread: {res_tuple}")
                continue

            resolved_id, usage, fixed = res_tuple
            total_tokens_used += usage
            if fixed:
                requests_made += 1
            if resolved_id:
                threads_resolvable.append(resolved_id)

            logger.info(f"Session Total: {total_tokens_used}")

            if total_tokens_used > 500_000:
                logger.warning(
                    f"⚠️ Token Budget Exceeded ({total_tokens_used} > 500,000). Stopping churn."
                )
                break

        if threads_resolvable:
            if dry_run:
                logger.info(
                    f"[DRY-RUN] Would push changes and resolve {len(threads_resolvable)} threads."
                )
                return threads_resolvable

            if push_changes(sm, pr.number):
                for thread_id in threads_resolvable:
                    resolve_thread(thread_id, token)
                return threads_resolvable

            logger.error("Failed to push changes, NOT resolving threads.")

    except Exception as e:
        logger.error(f"Failed to process comments for PR #{pr.number}: {e}")

    logger.info(
        f"Session Complete. Total Tokens Used: {total_tokens_used} (Requests: {requests_made})"
    )
    return []


def _validate_pr_codebase(sm: SandboxManager) -> tuple[bool, bool, bool, list[str]]:
    """
    Run linting, formatting check, and tests in the sandbox.
    Returns (lint_ok, typecheck_ok, tests_ok, logs).
    """
    # --- Surgical Content Isolation (Prevent OOM) ---
    logger.info("Isolating content to prevent OOM...")
    sm.run(f"rm -rf {WORKSPACE_DIR}/src/content-store {WORKSPACE_DIR}/.astro")
    sm.run(
        f"echo 'import {{ defineCollection, z }} from \"astro:content\"; export const collections = {{}};' > {WORKSPACE_DIR}/src/content.config.ts"
    )

    # --- 1. Fast Lint (using oxlint) ---
    logger.info("Running Lint (oxlint)...")
    lint_res = sm.run(f"cd {WORKSPACE_DIR} && pnpm dlx oxlint .")
    lint_ok = lint_res["exit_code"] == 0

    # --- 2. Fast Validation (using oxfmt) ---
    logger.info("Running Validation (oxfmt)...")
    oxfmt_ignore = "helm/\ninfrastructure/helm/\nk8s/\ndocker-compose.yaml\n.agent/\n.agents/"
    sm.run(f"echo '{oxfmt_ignore}' > {WORKSPACE_DIR}/.oxfmtignore")

    fmt_res = sm.run(f"cd {WORKSPACE_DIR} && pnpm dlx oxfmt --check --ignore-path .oxfmtignore .")
    typecheck_ok = fmt_res["exit_code"] == 0

    # --- 3. Tests (Standard pnpm test) ---
    logger.info("Running Tests...")
    test_res = sm.run(f"cd {WORKSPACE_DIR} && pnpm test")
    tests_ok = test_res["exit_code"] == 0

    logs = [
        f"--- LINT (oxlint) ---\n{lint_res['stdout']}\n{lint_res['stderr']}",
        f"--- VALIDATION (oxfmt) ---\n{fmt_res['stdout']}\n{fmt_res['stderr']}",
        f"--- TESTS ---\n{test_res['stdout']}\n{test_res['stderr']}",
    ]

    return lint_ok, typecheck_ok, tests_ok, logs


def process_pr(
    pr: PRInfo, api_key: str, repo_url: str, token: str, dry_run: bool
) -> ValidationResult:
    """Process a single PR in an E2B sandbox."""
    logger.info(f"Processing PR #{pr.number}: {pr.title}")

    result = ValidationResult(
        pr_number=pr.number, passed=False, lint_ok=False, typecheck_ok=False, tests_ok=False
    )

    try:
        with SandboxManager(api_key) as sm:
            # Inject env vars
            sm.run("echo 'export SKIP_CONTENT_SYNC=1' >> ~/.bashrc")
            sm.run(f"echo 'export GITHUB_TOKEN={token}' >> ~/.bashrc")

            sm.setup_repo(repo_url, pr.head_ref, token)

            # --- 3. Comment Churning (Apply Fixes) ---
            _process_comments(pr, sm, repo_url, token, dry_run)

            # --- Validation ---
            result.lint_ok, result.typecheck_ok, result.tests_ok, logs = _validate_pr_codebase(sm)
            result.passed = result.lint_ok and result.typecheck_ok and result.tests_ok
            result.logs = "\n".join(logs)

    except SandboxError as e:
        logger.error(f"Sandbox setup error for PR #{pr.number}: {e}")
        result.error = str(e)
    except Exception as e:
        logger.error(f"Unexpected error processing PR #{pr.number}: {e}")
        result.error = str(e)

    return result


def post_comment(pr_number: int, validation: ValidationResult, token: str, dry_run: bool):
    """Post validation results to the PR on GitHub."""
    status_emoji = "✅" if validation.passed else "❌"

    summary = f"""
### E2B Sandbox Validation {status_emoji}

| Check | Status |
| :--- | :--- |
| **Lint (oxlint)** | {"✅" if validation.lint_ok else "❌"} |
| **Validation (oxfmt)** | {"✅" if validation.typecheck_ok else "❌"} |
| **Unit Tests** | {"✅" if validation.tests_ok else "❌"} |

{"All checks passed! This PR is clean." if validation.passed else "Some checks failed. please review validation logs."}
"""
    if validation.error:
        summary += f"\n\n**ERROR during processing:** {validation.error}"

    if dry_run:
        logger.info(f"[DRY RUN] Would post comment to PR #{pr_number}:\n{summary}")
        return

    logger.info(f"Posting comment to PR #{pr_number}...")

    # Authenticate gh CLI with env var
    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token

    try:
        run_local_cmd(
            ["gh", "pr", "comment", str(pr_number), "--body", summary], timeout=30, env=env
        )
    except Exception as e:
        logger.error(f"Failed to post comment: {e}")


def main():
    parser = argparse.ArgumentParser(description="PR Churner: E2B PR Automation")
    parser.add_argument("--limit", type=int, default=5, help="Number of PRs to process (max 50)")
    parser.add_argument(
        "--dry-run", action="store_true", help="Don't post comments or push changes"
    )
    parser.add_argument("--fix", action="store_true", help="Attempt auto-fix for simple failures")
    parser.add_argument("--pr", type=int, help="Process a specific PR number")
    args = parser.parse_args()

    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        logger.error("E2B_API_KEY not found in environment.")
        sys.exit(1)

    # Auth: Generate Token from App Credentials
    try:
        github_token = generate_installation_token()
        logger.info("Successfully authenticated as GitHub App.")
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        sys.exit(1)

    try:
        if not check_tool_availability("git"):
            logger.error("Git is not installed.")
            sys.exit(1)

        repo_url_res = run_local_cmd(["git", "remote", "get-url", "origin"], timeout=10)
        repo_url = repo_url_res.stdout.strip()
    except Exception:
        logger.error("Could not determine repository URL.")
        sys.exit(1)

    if args.pr:
        env = os.environ.copy()
        env["GITHUB_TOKEN"] = github_token
        cmd = [
            "gh",
            "pr",
            "view",
            str(args.pr),
            "--json",
            "number,title,headRefName,baseRefName,author,mergeable,statusCheckRollup",
        ]
        try:
            res = run_local_cmd(cmd, timeout=30, env=env)
            item = json.loads(res.stdout)
            prs = [
                PRInfo(
                    number=item["number"],
                    title=item["title"],
                    head_ref=item["headRefName"],
                    base_ref=item["baseRefName"],
                    author=item["author"]["login"],
                    mergeable=item["mergeable"] == "MERGEABLE",
                    status_checks=item.get("statusCheckRollup", []),
                )
            ]
        except Exception as e:
            logger.error(f"Failed to fetch PR #{args.pr}: {e}")
            sys.exit(1)
    else:
        prs = get_open_prs(min(args.limit, MAX_PR_LIMIT), github_token)

    if not prs:
        logger.info("No open PRs found.")
        return

    logger.info(f"Starting churn iteration for {len(prs)} PRs...")

    for pr in prs:
        result = process_pr(pr, api_key, repo_url, github_token, args.dry_run)
        post_comment(pr.number, result, github_token, args.dry_run)

    logger.info("Churn iteration complete.")


if __name__ == "__main__":
    main()
