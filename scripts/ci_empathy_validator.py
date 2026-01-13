#!/usr/bin/env python3
"""
CI/CD pre-commit hook to block merges when empathy guidelines are violated
"""

import logging
import re
import stat
import subprocess
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "ai"))

from test_empathy_style_validation import EmpathyStyleValidator  # noqa: E402


def get_changed_files():
    """Get list of changed files in current commit/PR"""
    try:
        # For git pre-commit hook
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True,
            text=True,
            cwd=project_root,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip().split("\n")
    except Exception:
        pass

    # Fallback: check all crisis-related files
    crisis_files = list((project_root / "ai").rglob("*crisis*.py"))
    return [str(f.relative_to(project_root)) for f in crisis_files]


def extract_strings_from_file(file_path):
    """Extract string literals from Python file that might contain user-facing text"""
    strings = []
    try:
        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        # Simple regex to catch string literals (basic approach)

        string_pattern = r'["\']([^"\']*?(?:crisis|help|support|danger|emergency)[^"\']*?)["\']'
        matches = re.findall(string_pattern, content, re.IGNORECASE)
        strings.extend(matches)

        # Also check for multi-line strings that might contain crisis response text
        multiline_pattern = r'""".*?(?:crisis|help|support|danger|emergency).*?"""'
        multiline_matches = re.findall(multiline_pattern, content, re.DOTALL | re.IGNORECASE)
        strings.extend([match.replace('"""', "").strip() for match in multiline_matches])

    except Exception as e:
        logger.warning(f"Warning: Could not parse {file_path}: {e}")

    return strings


def check_empathy_guidelines():
    """Main validation function for CI/CD"""
    logger.info("🤖 Running Empathy Style CI/CD Validation...")
    logger.info("-" * 40)

    validator = EmpathyStyleValidator()
    changed_files = get_changed_files()

    violations_found = []
    files_checked = 0

    # Check crisis intervention related files
    crisis_related_patterns = ["crisis", "intervention", "support", "response"]

    for file_path in changed_files:
        if not file_path or not any(
            pattern in file_path.lower() for pattern in crisis_related_patterns
        ):
            continue

        full_path = project_root / file_path
        if not full_path.exists() or full_path.suffix != ".py":
            continue

        logger.info(f"Checking {file_path}...")
        files_checked += 1

        # Extract strings that might be user-facing
        strings_to_check = extract_strings_from_file(full_path)

        for text in strings_to_check:
            if len(text.strip()) < 10:  # Skip very short strings
                continue

            validation = validator.validate_response_style(text)

            if not validation["passes_validation"]:
                violations_found.append(
                    {
                        "file": file_path,
                        "text": text[:100] + ("..." if len(text) > 100 else ""),
                        "empathy_score": validation["empathy_score"],
                        "connection_score": validation["connection_score"],
                        "violations": validation["institutional_violations"]["violations"],
                    }
                )

    # Also run the comprehensive crisis response tests
    logger.info("\nRunning comprehensive crisis response validation...")
    crisis_test_results = validator.test_crisis_responses()

    # Display results
    logger.info("\n📋 Validation Results:")
    logger.info(f"Files checked: {files_checked}")
    logger.info(f"Violations found: {len(violations_found)}")
    logger.info(f"Crisis test pass rate: {crisis_test_results['overall_pass_rate']:.1%}")

    if violations_found:
        logger.info("\n❌ EMPATHY GUIDELINE VIOLATIONS DETECTED:")
        logger.info("=" * 50)
        for i, violation in enumerate(violations_found, 1):
            logger.info(f"\n{i}. File: {violation['file']}")
            logger.info(f'   Text: "{violation["text"]}"')
            logger.info(f"   Empathy Score: {violation['empathy_score']:.2f}")
            logger.info(f"   Connection Score: {violation['connection_score']:.2f}")
            logger.info(f"   Issues: {len(violation['violations'])} institutional references found")

        logger.info("\n💥 BLOCKING MERGE - Empathy guidelines violated!")
        logger.info(
            "Please revise the text to use collaborative support language instead of institutional referrals."
        )
        return False

    if not crisis_test_results["all_passed"]:
        logger.info("\n⚠️  Some crisis response tests failed")
        logger.info(f"Overall pass rate: {crisis_test_results['overall_pass_rate']:.1%}")
        return False

    logger.info("\n✅ All empathy style validations passed!")
    logger.info("Ready for merge - responses follow collaborative support guidelines")
    return True


def setup_git_hook():
    """Setup pre-commit hook in git repository"""
    hooks_dir = project_root / ".git" / "hooks"
    if not hooks_dir.exists():
        logger.warning("⚠️  Not in a git repository or hooks directory not found")
        return False

    pre_commit_hook = hooks_dir / "pre-commit"

    hook_content = f"""#!/bin/bash
# Empathy Style Validation Pre-commit Hook

echo "🔍 Running empathy style validation..."
cd "{project_root}"

python "{project_root / "scripts/ci_empathy_validator.py"}"

if [ $? -ne 0 ]; then
    echo "❌ Commit blocked: Empathy guidelines violated"
    echo "Please revise your changes to follow collaborative support language"
    exit 1
fi

echo "✅ Empathy validation passed"
exit 0
"""

    try:
        with open(pre_commit_hook, "w") as f:
            f.write(hook_content)

        # Make executable

        pre_commit_hook.chmod(pre_commit_hook.stat().st_mode | stat.S_IEXEC)

        logger.info(f"✅ Pre-commit hook installed at {pre_commit_hook}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to install pre-commit hook: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--setup-hook":
        setup_git_hook()
    else:
        success = check_empathy_guidelines()
        sys.exit(0 if success else 1)
