#!/usr/bin/env python3
"""
Test script to attempt ReDoS bypasses on safe_regex.py
"""

import sys

sys.path.insert(0, "/home/vivi/pixelated/.worktrees/hidden-audit/ai/pipelines/orchestrator/quality")

from safe_regex import (
    is_safe_pattern,
    compile_safe_pattern,
    safe_match,
    safe_search,
    SafePatternMatcher,
    sanitize_pattern,
)
import re
import time


def test_nested_quantifiers():
    """Test nested quantifier bypass attempts"""
    print("=== Testing Nested Quantifiers ===")

    # Original dangerous patterns from the file
    dangerous_patterns = [
        r"(?:a+)+",  # (?:a+)+
        r"(?:a*)*",  # (?:a*)*
        r"(a+)+",  # (a+)+
        r"(a*)*",  # (a*)*
    ]

    for pattern in dangerous_patterns:
        is_safe, reason = is_safe_pattern(pattern)
        print(f"Pattern: {pattern}")
        print(f"  Safe: {is_safe}, Reason: {reason}")

        # Test if it compiles
        compiled = compile_safe_pattern(pattern)
        print(f"  Compiles: {compiled is not None}")

        # Test with attack string
        if compiled:
            attack_string = "a" * 50 + "b"
            start = time.time()
            try:
                result = compiled.match(attack_string)
                elapsed = time.time() - start
                print(f"  Match time: {elapsed:.4f}s")
                if elapsed > 1.0:  # More than 1 second indicates potential ReDoS
                    print(f"  *** POTENTIAL ReDoS VULNERABILITY DETECTED ***")
            except Exception as e:
                print(f"  Error: {e}")
        print()


def test_alternation_quantifiers():
    """Test alternation with quantifiers"""
    print("=== Testing Alternation Quantifiers ===")

    dangerous_patterns = [
        r"(a+|b+)*",  # (a+|b+)*
        r"(a*|b*)+",  # (a*|b*)+
    ]

    for pattern in dangerous_patterns:
        is_safe, reason = is_safe_pattern(pattern)
        print(f"Pattern: {pattern}")
        print(f"  Safe: {is_safe}, Reason: {reason}")

        compiled = compile_safe_pattern(pattern)
        print(f"  Compiles: {compiled is not None}")

        if compiled:
            # Attack string that causes backtracking
            attack_string = "ab" * 25 + "c"
            start = time.time()
            try:
                result = compiled.match(attack_string)
                elapsed = time.time() - start
                print(f"  Match time: {elapsed:.4f}s")
                if elapsed > 1.0:
                    print(f"  *** POTENTIAL ReDoS VULNERABILITY DETECTED ***")
            except Exception as e:
                print(f"  Error: {e}")
        print()


def test_multiple_quantifiers():
    """Test multiple quantifiers in sequence"""
    print("=== Testing Multiple Quantifiers ===")

    dangerous_patterns = [
        r"[+*?]\s*[+*?]",  # Multiple quantifiers in sequence
    ]

    for pattern in dangerous_patterns:
        is_safe, reason = is_safe_pattern(pattern)
        print(f"Pattern: {pattern}")
        print(f"  Safe: {is_safe}, Reason: {reason}")

        compiled = compile_safe_pattern(pattern)
        print(f"  Compiles: {compiled is not None}")
        print()


def test_nesting_depth():
    """Test excessive nesting depth"""
    print("=== Testing Nesting Depth ===")

    # Create patterns with increasing nesting depth
    for depth in range(1, 10):
        pattern = "(" * depth + "a" + ")" * depth
        is_safe, reason = is_safe_pattern(pattern)
        print(f"Depth {depth}: {pattern}")
        print(f"  Safe: {is_safe}, Reason: {reason}")

        if not is_safe and depth > 5:
            print(f"  *** Correctly rejected as unsafe at depth {depth} ***")
        print()


def test_safe_search_timeout():
    """Test if safe_search respects timeout"""
    print("=== Testing Safe Search Timeout ===")

    # Create a pattern that could be problematic but passes safety check
    pattern_str = r"a?{50}a{50}b"  # This might be safe but slow
    is_safe, reason = is_safe_pattern(pattern_str)
    print(f"Pattern: {pattern_str}")
    print(f"  Safe: {is_safe}, Reason: {reason}")

    if is_safe:
        compiled = re.compile(pattern_str)
        attack_string = "a" * 100 + "b"

        start = time.time()
        try:
            result = safe_search(compiled, attack_string, timeout_ms=50)  # 50ms timeout
            elapsed = time.time() - start
            print(f"  Search time: {elapsed:.4f}s")
            print(f"  Result: {result is not None}")
            if elapsed > 0.1:  # More than 100ms suggests timeout not working
                print(f"  *** POTENTIAL TIMEOUT BYPASS ***")
        except Exception as e:
            print(f"  Error: {e}")
    print()


def test_input_length_limit():
    """Test input length validation"""
    print("=== Testing Input Length Limit ===")

    pattern_str = r"a+"
    is_safe, reason = is_safe_pattern(pattern_str)
    print(f"Pattern: {pattern_str}")
    print(f"  Safe: {is_safe}, Reason: {reason}")

    if is_safe:
        compiled = re.compile(pattern_str)

        # Test with input exceeding MAX_REGEX_INPUT_LENGTH (10000)
        long_string = "a" * 15000
        start = time.time()
        try:
            result = safe_match(compiled, long_string, timeout_ms=1000)
            elapsed = time.time() - start
            print(f"  Long string match time: {elapsed:.4f}s")
            print(f"  Result: {result is not None}")
            if result is not None:
                print(f"  *** INPUT LENGTH LIMIT BYPASS ***")
        except Exception as e:
            print(f"  Error: {e}")
    print()


def test_safe_pattern_matcher():
    """Test SafePatternMatcher class"""
    print("=== Testing SafePatternMatcher ===")

    patterns = [
        r"(?:a+)+",  # Should be rejected
        r"(?:a*)*",  # Should be rejected
        r"hello",  # Should be accepted
        r"world\d+",  # Should be accepted
    ]

    matcher = SafePatternMatcher(patterns, timeout_ms=100)

    print(f"Matcher has {len(matcher.compiled_patterns)} compiled patterns")

    # Test matching
    test_strings = [
        "hello world",
        "aaaaaaaaab",  # Should trigger ReDoS in first pattern if not filtered
        "world123",
    ]

    for test_str in test_strings:
        start = time.time()
        result = matcher.match(test_str)
        elapsed = time.time() - start
        print(f"  '{test_str}' -> Match: {result is not None} (took {elapsed:.4f}s)")
        if elapsed > 1.0:
            print(f"    *** POTENTIAL ReDoS IN MATCHER ***")
    print()


def test_sanitize_pattern():
    """Test pattern sanitization"""
    print("=== Testing Pattern Sanitization ===")

    dangerous_patterns = [
        r"(?:a+)+",
        r"(?:a*)*",
        r"(a+)+",
        r"(a*)*",
    ]

    for pattern in dangerous_patterns:
        print(f"Original: {pattern}")
        sanitized = sanitize_pattern(pattern)
        print(f"  Sanitized: {sanitized}")

        if sanitized:
            is_safe, reason = is_safe_pattern(sanitized)
            print(f"  Sanitized safe: {is_safe}, Reason: {reason}")

            # Test if sanitized pattern still matches similar strings
            if is_safe:
                try:
                    orig_compiled = re.compile(pattern)
                    san_compiled = re.compile(sanitized)

                    test_str = "aaaaab"
                    orig_match = orig_compiled.match(test_str) if orig_compiled else None
                    san_match = san_compiled.match(test_str) if san_compiled else None

                    print(f"  Original match 'aaaaab': {orig_match is not None}")
                    print(f"  Sanitized match 'aaaaab': {san_match is not None}")
                except Exception as e:
                    print(f"  Error compiling patterns: {e}")
        print()


if __name__ == "__main__":
    print("Starting ReDoS bypass tests on safe_regex.py\n")

    test_nested_quantifiers()
    test_alternation_quantifiers()
    test_multiple_quantifiers()
    test_nesting_depth()
    test_safe_search_timeout()
    test_input_length_limit()
    test_safe_pattern_matcher()
    test_sanitize_pattern()

    print("Tests completed.")
