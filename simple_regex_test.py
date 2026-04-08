#!/usr/bin/env python3
"""
Simple test to verify safe_regex protection
"""

import sys

sys.path.insert(0, "/home/vivi/pixelated/.worktrees/hidden-audit/ai/pipelines/orchestrator/quality")

from safe_regex import is_safe_pattern, compile_safe_pattern

# Test known dangerous patterns
dangerous_patterns = [
    r"(?:a+)+",  # (?:a+)+
    r"(?:a*)*",  # (?:a*)*
    r"(a+)+",  # (a+)+
    r"(a*)*",  # (a*)*
]

print("Testing dangerous patterns:")
for pattern in dangerous_patterns:
    is_safe, reason = is_safe_pattern(pattern)
    print(f"  {pattern}: safe={is_safe}, reason={reason}")

# Test safe patterns
safe_patterns = [
    r"hello",
    r"\d+",
    r"[a-z]+",
    r"\w+@\w+\.\w+",  # email-like
]

print("\nTesting safe patterns:")
for pattern in safe_patterns:
    is_safe, reason = is_safe_pattern(pattern)
    print(f"  {pattern}: safe={is_safe}, reason={reason}")

# Test that dangerous patterns don't compile
print("\nTesting compilation:")
for pattern in dangerous_patterns:
    compiled = compile_safe_pattern(pattern)
    print(f"  {pattern}: compiles={compiled is not None}")

print("\nTest completed.")
