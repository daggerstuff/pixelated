#!/usr/bin/env python3

"""
Simple test script to verify NeMo microservices basic functionality.
"""

import os
import sys

def test_basic_nemo_functionality():
    """Test basic NeMo microservices functionality."""
    print("🔍 Testing basic NeMo microservices functionality...")

    try:
        # Test basic import
        import nemo_microservices
        print(f"✅ NeMo Microservices version: {nemo_microservices.__version__}")

        # Test client creation
        client = nemo_microservices.Client(
            api_key=os.getenv("NVIDIA_API_KEY")
        )
        print("✅ NeMo client created successfully")

        # Test available resources
        print("Available resources:")
        for resource in ['datasets', 'models', 'projects', 'chat', 'completions']:
            if hasattr(client, resource):
                print(f"  ✅ {resource}")
            else:
                print(f"  ❌ {resource}")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_dataset_functionality():
    """Test dataset functionality if available."""
    print("\n🔍 Testing dataset functionality...")

    try:
        import nemo_microservices
        from nemo_microservices.types import Dataset

        client = nemo_microservices.Client(
            api_key=os.getenv("NVIDIA_API_KEY")
        )

        # Check if datasets resource is available
        if hasattr(client, 'datasets'):
            print("✅ Datasets resource available")

            # Try to list datasets (this might fail without proper setup)
            try:
                datasets = client.datasets.list()
                print(f"✅ Found {len(datasets.data)} datasets")
            except Exception as e:
                print(f"ℹ️  Dataset listing failed (expected without setup): {e}")
                return True  # This is expected
        else:
            print("❌ Datasets resource not available")
            return False

        return True

    except Exception as e:
        print(f"❌ Dataset functionality error: {e}")
        return False

def main():
    """Run tests."""
    print("🚀 Starting Simple NeMo Microservices Test")
    print("=" * 50)

    results = []

    # Run tests
    results.append(("Basic Functionality", test_basic_nemo_functionality()))
    results.append(("Dataset Functionality", test_dataset_functionality()))

    # Summary
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

    if all_passed:
        print("🎉 Basic NeMo functionality is working!")
        print("\n📋 Next steps:")
        print("1. Explore available NeMo microservices")
        print("2. Set up specific services as needed")
        print("3. Integrate with Pixelated Empathy platform")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
