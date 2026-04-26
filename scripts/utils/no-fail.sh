#!/usr/bin/env bash
#
# Run a command and report its exit code without failing the shell process.
# This is useful when you want command output and the failure signal, but don't
# want non-zero exits to abort the surrounding automation.

set -o pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: no-fail.sh <command> [args...]"
  echo "Runs command and always exits 0, while printing command status."
  exit 0
fi

command_description="$*"
echo "🧪 Running: ${command_description}"

"$@"
exit_code=$?

if [ "${exit_code}" -eq 0 ]; then
  echo "✅ no-fail: exit_code=${exit_code}"
else
  echo "⚠️  no-fail: exit_code=${exit_code}"
fi

exit 0

