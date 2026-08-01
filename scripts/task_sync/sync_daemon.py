#!/usr/bin/env python3
"""Task sync daemon for automated cross-system synchronization.

This daemon runs periodic syncs between Linear, Jira, GitHub, GitLab, and Asana
using the existing tri_sync.py infrastructure. It supports:
- Configurable sync intervals (default: 15 minutes)
- Dry-run mode for testing
- Structured logging to file and stdout
- Graceful shutdown on SIGTERM/SIGINT
- State persistence to track last sync time
- Error reporting and retry logic

Usage:
    # Run once (for cron)
    python scripts/task_sync/sync_daemon.py --once

    # Run as daemon (foreground)
    python scripts/task_sync/sync_daemon.py

    # Run with custom interval
    python scripts/task_sync/sync_daemon.py --interval 30

    # Dry-run mode (no actual changes)
    python scripts/task_sync/sync_daemon.py --dry-run

    # Specify log file
    python scripts/task_sync/sync_daemon.py --log-file /var/log/task-sync.log
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Resolve project root (scripts/task_sync -> project root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_FILE = PROJECT_ROOT / ".agent" / "internal" / "sync-daemon-state.json"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

logger = logging.getLogger("task-sync-daemon")


class SyncDaemon:
    """Automated task sync daemon with scheduling and state management."""

    def __init__(
        self,
        interval_minutes: int = 15,
        dry_run: bool = False,
        log_file: Path | None = None,
        state_file: Path = STATE_FILE,
    ):
        self.interval_seconds = interval_minutes * 60
        self.dry_run = dry_run
        self.state_file = state_file
        self.running = False
        self.last_sync_time: datetime | None = None

        # Setup logging
        self._setup_logging(log_file)

        # Load persisted state
        self._load_state()

        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

    def _setup_logging(self, log_file: Path | None) -> None:
        """Configure logging to stdout and optionally to file."""
        logger.setLevel(logging.INFO)

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(console_handler)

        # File handler (if specified)
        if log_file:
            log_file.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
            logger.addHandler(file_handler)

    def _load_state(self) -> None:
        """Load persisted daemon state from disk."""
        if not self.state_file.exists():
            logger.info(f"No state file found at {self.state_file}, starting fresh")
            return

        try:
            with open(self.state_file) as f:
                state = json.load(f)

            if "last_sync_time" in state:
                self.last_sync_time = datetime.fromisoformat(state["last_sync_time"])
                logger.info(f"Loaded state: last sync at {self.last_sync_time.isoformat()}")
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to load state file: {e}")

    def _save_state(self) -> None:
        """Persist daemon state to disk."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

        state = {
            "last_sync_time": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            with open(self.state_file, "w") as f:
                json.dump(state, f, indent=2)
            logger.debug(f"Saved state to {self.state_file}")
        except OSError as e:
            logger.error(f"Failed to save state: {e}")

    def _handle_shutdown(self, signum: int, frame: Any) -> None:
        """Handle SIGTERM/SIGINT for graceful shutdown."""
        sig_name = signal.Signals(signum).name
        logger.info(f"Received {sig_name}, shutting down gracefully...")
        self.running = False

    def _run_sync(self) -> bool:
        """Execute a single sync run using tri_sync.py.

        Returns:
            True if sync succeeded, False otherwise.
        """
        logger.info("Starting sync run...")
        start_time = time.time()

        try:
            # Build command
            cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "task_sync" / "tri_sync.py")]

            if self.dry_run:
                cmd.append("dry-run")
            else:
                cmd.append("apply")

            # Set up environment with project root in PYTHONPATH
            env = os.environ.copy()
            pythonpath = env.get("PYTHONPATH", "")
            if pythonpath:
                env["PYTHONPATH"] = f"{PROJECT_ROOT}:{pythonpath}"
            else:
                env["PYTHONPATH"] = str(PROJECT_ROOT)

            # Run sync
            result = subprocess.run(
                cmd,
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                env=env,
            )

            duration = time.time() - start_time

            # Parse output
            try:
                output = json.loads(result.stdout) if result.stdout else {}
            except json.JSONDecodeError:
                output = {}

            # Log results
            summary = output.get("summary", {})
            actions = output.get("actions", [])

            logger.info(
                f"Sync completed in {duration:.1f}s: "
                f"{summary.get('total_actions', 0)} actions, "
                f"{summary.get('successful', 0)} successful, "
                f"{summary.get('failed', 0)} failed"
            )

            if result.returncode != 0:
                logger.error(f"Sync exited with code {result.returncode}")
                if result.stderr:
                    logger.error(f"stderr: {result.stderr[:500]}")
                return False

            # Update state
            self.last_sync_time = datetime.now(timezone.utc)
            self._save_state()

            return True

        except subprocess.TimeoutExpired:
            logger.error("Sync timed out after 300 seconds")
            return False
        except Exception as e:
            logger.error(f"Sync failed with exception: {e}", exc_info=True)
            return False

    def run_once(self) -> int:
        """Run a single sync and exit.

        Returns:
            Exit code (0 for success, 1 for failure).
        """
        logger.info("Running single sync (cron mode)")
        success = self._run_sync()
        return 0 if success else 1

    def run_daemon(self) -> int:
        """Run as a persistent daemon with periodic syncs.

        Returns:
            Exit code (0 for clean shutdown, 1 for error).
        """
        logger.info(f"Starting daemon mode: interval={self.interval_seconds}s, dry_run={self.dry_run}")

        self.running = True

        while self.running:
            # Run sync
            success = self._run_sync()

            if not success:
                logger.warning("Sync failed, will retry at next interval")

            if not self.running:
                break

            # Sleep until next interval
            logger.info(f"Sleeping for {self.interval_seconds} seconds...")
            sleep_start = time.time()

            while self.running and (time.time() - sleep_start) < self.interval_seconds:
                time.sleep(1)

        logger.info("Daemon shutdown complete")
        return 0


def main() -> int:
    """Main entry point for the sync daemon."""
    parser = argparse.ArgumentParser(
        description="Automated task sync daemon for cross-system synchronization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single sync and exit (for cron)",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=15,
        help="Sync interval in minutes (default: 15)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them",
    )

    parser.add_argument(
        "--log-file",
        type=Path,
        help="Log file path (default: stdout only)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=STATE_FILE,
        help=f"State file path (default: {STATE_FILE})",
    )

    args = parser.parse_args()

    # Validate interval
    if args.interval < 1:
        logger.error("Interval must be at least 1 minute")
        return 1

    # Create daemon
    daemon = SyncDaemon(
        interval_minutes=args.interval,
        dry_run=args.dry_run,
        log_file=args.log_file,
        state_file=args.state_file,
    )

    # Run
    if args.once:
        return daemon.run_once()
    return daemon.run_daemon()


if __name__ == "__main__":
    sys.exit(main())
