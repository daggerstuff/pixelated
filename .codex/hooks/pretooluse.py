#!/usr/bin/env python3
"""PreToolUse hook executor for hookify plugin.

This script is called by Claude Code before any tool executes.
It reads .claude/hookify.*.local.md files and evaluates rules.
"""

import os
import sys
import json

# CRITICAL: Add plugin root to Python path for imports
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if PLUGIN_ROOT and PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from core.config_loader import load_rules
    from core.rule_engine import RuleEngine
except ImportError as e:
    # If imports fail, allow operation and log error
    error_msg = {"systemMessage": f"Hookify import error: {e}"}
    print(json.dumps(error_msg), file=sys.stdout)
    sys.exit(0)


def main():
    """Main entry point for PreToolUse hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Determine event type for filtering
        # For PreToolUse, we use tool_name to determine event category
        tool_name = input_data.get('tool_name', '')

        # Map tools to event types
        # - 'bash': Bash commands
        # - 'file': File modifications (Edit, Write, MultiEdit)
        # - 'read': File reads (Read, Glob, Grep) - should NOT trigger file rules
        # - None: Other tools - only load 'all' rules
        event = None
        if tool_name == 'Bash':
            event = 'bash'
        elif tool_name in ['Edit', 'Write', 'MultiEdit', 'Update']:
            event = 'file'
        elif tool_name in ['Read', 'Glob', 'Grep', 'LS']:
            event = 'read'  # Read operations get their own event type

        # Load rules
        rules = load_rules(event=event)

        # Evaluate rules
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        # Always output JSON (even if empty)
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        # On any error, allow the operation and log
        error_output = {
            "systemMessage": f"Hookify error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0 - never block operations due to hook errors
        sys.exit(0)


if __name__ == '__main__':
    main()
