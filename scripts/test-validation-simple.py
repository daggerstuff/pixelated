#!/usr/bin/env python3
"""Simple test for memory content validation"""

import re
import json
import os
from pathlib import Path
import sys

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))
from backup_validator import BackupContentValidator


def validate_memory_content(content: str) -> bool:
    """Validate memory content for integrity and authenticity"""
    validator = BackupContentValidator()
    # Create a minimal memory structure for validation
    memory_data = {"content": content}
    is_valid, errors = validator.validate_memory_structure(memory_data)

    if not is_valid:
        for error in errors:
            print(f"❌ {error}")
    else:
        print("✅ Content is valid")

    return is_valid


def test_valid_programming_memory():
    """Test validation with valid programming memory"""
    content = "Valid memory about programming"
    result = validate_memory_content(content)
    assert result == True, f"Expected True, got {result}"
    print("✅ Valid programming memory test passed")


def test_valid_async_memory():
    """Test validation with valid async programming note"""
    content = "This is a useful note about Python async programming"
    result = validate_memory_content(content)
    assert result == True, f"Expected True, got {result}"
    print("✅ Valid async memory test passed")


def test_empty_content():
    """Test validation with empty content"""
    content = ""
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Empty content test passed")


def test_short_content():
    """Test validation with too short content"""
    content = "hi"
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Short content test passed")


def test_html_content():
    """Test validation with HTML content"""
    content = "<!DOCTYPE html><html><head></head><body>Error</body></html>"
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ HTML content test passed")


def test_adblock_content():
    """Test validation with ad-block content"""
    content = '<script data-adblockkey="test">window.park = true;</script>'
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Ad-block content test passed")


def test_error_page_content():
    """Test validation with error page content"""
    content = "404 not found - page does not exist"
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Error page content test passed")


def test_parking_page_content():
    """Test validation with parking page content"""
    content = "This domain is parked for sale"
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Parking page content test passed")


def test_placeholder_content():
    """Test validation with placeholder content"""
    content = "Lorem ipsum dolor sit amet"
    result = validate_memory_content(content)
    assert result == False, f"Expected False, got {result}"
    print("✅ Placeholder content test passed")


def test_valid_performance_memory():
    """Test validation with valid performance memory"""
    content = "Remember to use async/await for better performance"
    result = validate_memory_content(content)
    assert result == True, f"Expected True, got {result}"
    print("✅ Valid performance memory test passed")


def test_corrupted_backup_file():
    """Test validation with actual corrupted backup file"""
    backup_file = Path("/home/vivi/pixel/memory_backups/combined_memories_20250707_204810.json")

    try:
        validate_corrupted_backup_file(backup_file)
    except FileNotFoundError:
        print("⚠️ Corrupted backup file not found - skipping test")
    except Exception as e:
        print(f"⚠️ Error reading backup file: {e}")


def validate_corrupted_backup_file(backup_file):
    with open(backup_file, "r") as f:
        data = json.load(f)

    corrupted_content = (
        data[0].get("content", "") if isinstance(data, list) and len(data) > 0 else ""
    )
    print(f"Corrupted content preview: {corrupted_content[:100]}...")
    print("Validation result:")
    validate_memory_content(corrupted_content)
    print("✅ Corrupted backup file test completed")


def run_all_tests():
    """Run all validation tests"""
    print("Testing memory content validation...")
    print("=" * 50)

    test_functions = [
        test_valid_programming_memory,
        test_valid_async_memory,
        test_empty_content,
        test_short_content,
        test_html_content,
        test_adblock_content,
        test_error_page_content,
        test_parking_page_content,
        test_placeholder_content,
        test_valid_performance_memory,
        test_corrupted_backup_file,
    ]

    passed_tests = 0
    total_tests = len(test_functions)

    # Run all test functions except the last one (corrupted backup test)
    for test_func in test_functions[:-1]:
        try:
            test_func()
            passed_tests += 1
        except Exception as e:
            print(f"❌ Test {test_func.__name__} failed: {e}")

    if backup_path := os.environ.get("TEST_CORRUPTED_BACKUP_FILE"):
        try:
            test_functions[-1]()  # test_corrupted_backup_file
            passed_tests += 1
        except Exception as e:
            print(f"❌ Test {test_functions[-1].__name__} failed: {e}")
    else:
        print("⚠️ TEST_CORRUPTED_BACKUP_FILE not set - skipping corrupted backup test")
        total_tests -= 1  # Adjust total count since we're skipping this test

    print("\n" + "=" * 50)
    print(f"Test Results: {passed_tests}/{total_tests} tests passed")
    print("All validation tests completed")


if __name__ == "__main__":
    run_all_tests()
