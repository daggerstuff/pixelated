#!/usr/bin/env python3
"""
AI Agent Automation Script

This script provides automated task execution for AI agents that can run persistently
in tmux sessions. It monitors task lists and can execute tasks automatically or
provide a framework for AI agent integration.
"""

import logging
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Setup logging
Path("logs").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/agent_automation.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class TaskMasterInterface:
    """Interface to TaskMaster for automated task management"""

    def __init__(self):
        self.base_cmd = ["task-master"]

    def _parse_task_output(self, output: str) -> Optional[Dict[str, Any]]:
        """Parse task output into structured data"""
        lines = output.split("\n")
        task_info = {}
        for line in lines:
            if line.startswith("Next task:"):
                task_info["summary"] = line.replace("Next task:", "").strip()
            elif "ID:" in line:
                task_info["id"] = line.split("ID:")[1].strip().split()[0]
            elif "Title:" in line:
                task_info["title"] = line.split("Title:")[1].strip()
        return task_info or None

    def get_next_task(self) -> Optional[Dict[str, Any]]:
        """Get the next available task"""
        try:
            result = subprocess.run(
                self.base_cmd + ["next"], capture_output=True, text=True, timeout=30, check=False
            )

            if result.returncode == 0:
                # Parse the output to extract task information
                output = result.stdout.strip()
                if "No available tasks" in output:
                    return None

                return self._parse_task_output(output)

        except Exception as e:
            logger.error(f"Error getting next task: {e}")
            return None

    def get_task_list(self) -> List[Dict[str, Any]]:
        """Get all tasks"""
        try:
            result = subprocess.run(
                self.base_cmd + ["list", "--with-subtasks"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                return [{"raw": line.strip()} for line in lines if "⏱️" in line or "✅" in line]

        except Exception as e:
            logger.error(f"Error getting task list: {e}")
            return []
        return []

    def set_task_status(self, task_id: str, status: str) -> bool:
        """Set task status"""
        try:
            result = subprocess.run(
                self.base_cmd + ["set-status", f"--id={task_id}", f"--status={status}"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error setting task status: {e}")
            return False


class AgentAutomation:
    """Main automation controller for AI agents"""

    def __init__(self, check_interval: int = 30):
        self.check_interval = check_interval
        self.taskmaster = TaskMasterInterface()
        self.running = False
        self.stats = {
            "checks": 0,
            "tasks_found": 0,
            "tasks_processed": 0,
            "errors": 0,
            "start_time": None,
        }

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, _frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False

    def _log_stats(self):
        """Log current statistics"""
        if self.stats["start_time"]:
            runtime = time.time() - self.stats["start_time"]
            logger.info(
                f"📊 Stats: {self.stats['checks']} checks, "
                f"{self.stats['tasks_found']} tasks found, "
                f"{self.stats['tasks_processed']} processed, "
                f"{self.stats['errors']} errors, "
                f"runtime: {runtime/3600:.1f}h"
            )

    def _simulate_task_work(self):
        """Simulate task processing work"""
        logger.info("💭 Analyzing task requirements...")
        time.sleep(2)
        logger.info("🔧 Executing task logic...")
        time.sleep(3)

    def process_task(self, task: Dict[str, Any]) -> bool:
        """
        Process a single task. Override this method to integrate with your AI agent.

        Args:
            task: Task information dictionary

        Returns:
            True if task was processed successfully, False otherwise
        """
        logger.info(f"🤖 Processing task: {task.get('title', 'Unknown')}")

        # This is where you'd integrate with your actual AI agent
        # For now, we'll just simulate processing

        try:
            self._simulate_task_work()

            # In a real implementation, you would:
            # 1. Parse task requirements
            # 2. Generate code/solutions
            # 3. Execute the task
            # 4. Verify completion
            # 5. Update task status

            if task_id := task.get("id"):
                if self.taskmaster.set_task_status(task_id, "done"):
                    logger.info(f"✅ Task {task_id} marked as done")
                    return True
                else:
                    logger.error(f"❌ Failed to update task {task_id} status")
                    return False

            return True

        except Exception as e:
            logger.error(f"❌ Error processing task: {e}")
            self.stats["errors"] += 1
            return False

    def run_continuous(self):
        """Run the automation continuously"""
        logger.info("🚀 Starting AI Agent Automation")
        logger.info(f"⏰ Check interval: {self.check_interval} seconds")

        self.running = True
        self.stats["start_time"] = time.time()

        try:
            while self.running:
                self.stats["checks"] += 1

                # Log stats every 10 checks
                if self.stats["checks"] % 10 == 0:
                    self._log_stats()

                logger.debug("🔍 Checking for next task...")
                if next_task := self.taskmaster.get_next_task():
                    self.stats["tasks_found"] += 1
                    logger.info(f"📋 Found task: {next_task.get('title', 'Unknown')}")

                    # Process the task
                    if self.process_task(next_task):
                        self.stats["tasks_processed"] += 1
                        logger.info("✅ Task processed successfully")
                    else:
                        logger.error("❌ Task processing failed")

                else:
                    logger.debug("⏭️ No tasks available")

                # Wait before next check
                time.sleep(self.check_interval)

        except KeyboardInterrupt:
            logger.info("🛑 Interrupted by user")
        except Exception as e:
            logger.error(f"💥 Unexpected error: {e}")
            self.stats["errors"] += 1
        finally:
            self.running = False
            logger.info("🏁 Agent automation stopped")
            self._log_stats()

    def run_single_check(self):
        """Run a single check cycle"""
        logger.info("🔍 Running single task check...")

        if next_task := self.taskmaster.get_next_task():
            logger.info(f"📋 Found task: {next_task}")
            return self.process_task(next_task)
        else:
            logger.info("⏭️ No tasks available")
            return False

    def status_monitor(self):
        """Monitor and display task status"""
        logger.info("📊 Starting status monitor...")

        try:
            while True:
                tasks = self.taskmaster.get_task_list()

                now_utc = datetime.now(timezone.utc)
                log_lines = [
                    f"\n{'='*60}",
                    f"📊 Task Status Monitor - {now_utc.strftime('%Y-%m-%d %H:%M:%S %Z')}",
                    f"{'='*60}",
                    f"Total tasks: {len(tasks)}",
                ]
                if tasks:
                    log_lines.extend(
                        f"  {i+1}. {task.get('raw', 'Unknown task')}"
                        for i, task in enumerate(tasks[:10])
                    )
                    if len(tasks) > 10:
                        log_lines.append(f"  ... and {len(tasks) - 10} more tasks")
                else:
                    log_lines.append("  No tasks found")
                log_lines.append(f"{'='*60}")
                logger.info("\n".join(log_lines))

                time.sleep(10)  # Update every 10 seconds

        except KeyboardInterrupt:
            logger.info("📊 Status monitor stopped")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="AI Agent Automation")
    parser.add_argument("command", choices=["run", "check", "monitor"], help="Command to execute")
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Check interval in seconds (default: 30)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    automation = AgentAutomation(check_interval=args.interval)

    if args.command == "run":
        automation.run_continuous()
    elif args.command == "check":
        automation.run_single_check()
    elif args.command == "monitor":
        automation.status_monitor()


if __name__ == "__main__":
    main()
