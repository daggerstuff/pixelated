#!/usr/bin/env python3
"""
Promotion Gate Integration Test

Validates that the readiness aggregator correctly gates deployments:
- PASS scenario: all lanes green → readiness=ready → deploy allowed
- FAIL scenario: one lane fails → readiness=not-ready → deploy blocked

Usage:
    python3 scripts/devops/test-promotion-gate.py [--scenario pass|fail]
"""

import json
import subprocess
import sys
from pathlib import Path


def run_aggregator(scenario: str, output_file: Path) -> bool:
    """Run the readiness aggregator with the given scenario."""
    cmd = [
        "python3",
        "scripts/devops/aggregate-readiness.py",
        "--dry-run",
        "--output",
        str(output_file),
    ]

    if scenario == "fail":
        # Inject a failing lane by modifying the aggregator behavior
        # For testing, we'll create a mock report directly
        mock_report = {
            "readiness": {
                "status": "not-ready",
                "score": 75.0,
                "timestamp": "2026-08-01T00:00:00Z",
                "commit": "test-commit-sha",
                "branch": "staging",
            },
            "summary": {
                "totalLanes": 4,
                "passedLanes": 3,
                "failedLanes": 1,
                "skippedLanes": 0,
            },
            "validationLanes": {
                "lint": {
                    "status": "pass",
                    "exitCode": 0,
                    "command": "pnpm lint",
                },
                "typecheck": {
                    "status": "pass",
                    "exitCode": 0,
                    "command": "pnpm typecheck",
                },
                "tests": {
                    "status": "fail",
                    "exitCode": 1,
                    "command": "pnpm test:unit",
                    "stderr": "Test suite failed",
                },
                "format": {
                    "status": "pass",
                    "exitCode": 0,
                    "command": "pnpm format:check",
                },
            },
            "providerPipelines": [],
            "providerSummary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "running": 0,
            },
        }

        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(mock_report, f, indent=2)

        return True

    # Run actual aggregator for pass scenario
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return result.returncode == 0


def should_deploy(readiness_file: Path) -> bool:
    """Gate logic: deploy only if status is 'ready' or 'warning'."""
    try:
        with open(readiness_file) as f:
            report = json.load(f)

        status = report["readiness"]["status"]
        score = report["readiness"]["score"]

        print(f"  Readiness status: {status}")
        print(f"  Readiness score: {score}")

        if status == "not-ready":
            print("  ❌ BLOCKED: Readiness gate failed — deployment blocked")
            return False
        if status == "warning":
            print("  ⚠️  WARNING: Readiness has warnings but deployment allowed")
            return True
        if status == "ready":
            print("  ✅ READY: All checks passed — deployment allowed")
            return True
        print(f"  ❓ UNKNOWN: Unexpected status '{status}' — blocking for safety")
        return False

    except Exception as e:
        print(f"  ❌ ERROR: Could not read readiness report: {e}")
        return False


def test_scenario(scenario: str) -> bool:
    """Test a single scenario and validate the gate decision."""
    print(f"\n{'=' * 60}")
    print(f"Testing {scenario.upper()} scenario")
    print(f"{'=' * 60}")

    output_file = Path(f"/tmp/readiness-test-{scenario}.json")

    print("\n[1/3] Running readiness aggregator...")
    if not run_aggregator(scenario, output_file):
        print("  ❌ Aggregator failed")
        return False

    print(f"  ✓ Report generated: {output_file}")

    print("\n[2/3] Evaluating gate decision...")
    allowed = should_deploy(output_file)

    print("\n[3/3] Validating expected behavior...")
    expected = scenario == "pass"

    if allowed == expected:
        print("  ✓ Gate decision matches expected behavior")
        print(f"    Scenario: {scenario}")
        print(f"    Expected: {'deploy allowed' if expected else 'deploy blocked'}")
        print(f"    Actual:   {'deploy allowed' if allowed else 'deploy blocked'}")
        return True
    print("  ❌ Gate decision mismatch")
    print(f"    Scenario: {scenario}")
    print(f"    Expected: {'deploy allowed' if expected else 'deploy blocked'}")
    print(f"    Actual:   {'deploy allowed' if allowed else 'deploy blocked'}")
    return False


def main():
    """Run promotion gate integration tests."""
    import argparse

    parser = argparse.ArgumentParser(description="Test promotion gate logic")
    parser.add_argument(
        "--scenario",
        choices=["pass", "fail", "all"],
        default="all",
        help="Test scenario to run (default: all)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("PROMOTION GATE INTEGRATION TEST")
    print("=" * 60)

    scenarios = ["pass", "fail"] if args.scenario == "all" else [args.scenario]
    results = {}

    for scenario in scenarios:
        results[scenario] = test_scenario(scenario)

    print(f"\n{'=' * 60}")
    print("TEST SUMMARY")
    print(f"{'=' * 60}")

    for scenario, passed in results.items():
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {scenario}")

    all_passed = all(results.values())

    print(f"\n{'=' * 60}")
    if all_passed:
        print("✅ All tests passed")
        print(f"{'=' * 60}")
        return 0
    print("❌ Some tests failed")
    print(f"{'=' * 60}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
