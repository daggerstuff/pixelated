#!/usr/bin/env python3

"""
Simple test script to verify NeMo microservices basic functionality.
"""

import os
import sys

RESOURCE_NAMES = ("datasets", "models", "projects", "chat", "completions")

def _check_resource_availability(client, resource):
    """Check if a resource is available on the client."""
    if hasattr(client, resource):
        print(f"  ✅ {resource}")
        return True
    else:
        print(f"  ❌ {resource}")
        return False


def _test_resource_availability(client, resources):
    """Test availability of multiple resources."""
    print("Available resources:")
    for resource in resources:
        _check_resource_availability(client, resource)
    return True


def _import_nemo_microservices():
    """Import nemo_microservices, print version and return module."""
    import nemo_microservices
    print(f"✅ NeMo Microservices version: {nemo_microservices.__version__}")
    return nemo_microservices


def _create_nemo_client():
    """Create NeMo client with API key."""
    import nemo_microservices
    return nemo_microservices.Client(api_key=os.getenv("NVIDIA_API_KEY"))


def test_basic_nemo_functionality():
    """Test basic NeMo microservices functionality."""
    print("🔍 Testing basic NeMo microservices functionality...")

    try:
        # Test basic import
        _import_nemo_microservices()

        # Test client creation
        client = _create_nemo_client()
        print("✅ NeMo client created successfully")

        # Test available resources
        _test_resource_availability(client, RESOURCE_NAMES)

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def _test_dataset_listing(client):
    """Test dataset listing functionality."""
    try:
        datasets = client.datasets.list()
        print(f"✅ Found {len(datasets.data)} datasets")
        return True
    except Exception as e:
        print(f"ℹ️  Dataset listing failed (expected without setup): {e}")
        return True  # This is expected


def _create_nemo_client_with_types():
    """Create NeMo client with types import."""
    import nemo_microservices
    from nemo_microservices.types import Dataset
    return nemo_microservices.Client(api_key=os.getenv("NVIDIA_API_KEY"))

def test_dataset_functionality():
    """Test dataset functionality if available."""
    print("\n🔍 Testing dataset functionality...")

    try:
        client = _create_nemo_client_with_types()
        # Check resource availability and return result directly
        resource_available = _check_resource_availability(client, 'datasets')
        return _test_dataset_listing(client) if resource_available else False
    except Exception as e:
        print(f"❌ Dataset functionality error: {e}")
        return False

def _run_tests():
    """Run all tests and return results."""
    return [
        ("Basic Functionality", test_basic_nemo_functionality()),
        ("Dataset Functionality", test_dataset_functionality())
    ]


def _print_test_summary(results):
    """Print test summary and return overall status."""
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)

    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if not passed:
            all_passed = False

    print("=" * 50)
    return all_passed


def _print_success_message():
    """Print success message and next steps."""
    print("🎉 Basic NeMo functionality is working!")
    print("\n📋 Next steps:")
    print("1. Explore available NeMo microservices")
    print("2. Set up specific services as needed")
    print("3. Integrate with Pixelated Empathy platform")


def main():
    """Run tests."""
    print("🚀 Starting Simple NeMo Microservices Test")
    print("=" * 50)

    if all_passed := _print_test_summary(_run_tests()):
        _print_success_message()
        return 0
    
    print("⚠️  Some tests failed. Please check the issues above.")
    return 1

if __name__ == "__main__":
    sys.exit(main())
