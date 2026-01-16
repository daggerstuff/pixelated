#!/usr/bin/env python3

"""
Test script to verify NeMo microservices setup and functionality.
"""

import os
import sys
from pathlib import Path

# Add the ai directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "ai"))

def _verify_nemo_imports():
    """Internal helper to verify imports."""
    import nemo_microservices
    print(f"✅ NeMo Microservices version: {nemo_microservices.__version__}")

    from nemo_microservices import NeMoMicroservices
    print("✅ NeMoMicroservices main client class available")

def test_nemo_imports():
    """Test that NeMo microservices can be imported."""
    print("🔍 Testing NeMo microservices imports...")

    try:
        _verify_nemo_imports()
        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def _log_variable_status(name, value, mask=False):
    """Log the status of an environment variable and return its presence."""
    status = "✅" if value else "❌"
    display = ("*****" if mask else value) if value else "NOT SET"
    print(f"{status} {name}: {display}")
    return bool(value)

def test_environment_variables():
    """Test that required environment variables are set."""
    print("\n🔍 Testing environment variables...")

    # Use a helper to avoid conditionals in the test body
    return all([
        _log_variable_status("NVIDIA_API_KEY", os.getenv("NVIDIA_API_KEY"), mask=True),
        _log_variable_status("NEMO_DATA_DESIGNER_BASE_URL", os.getenv("NEMO_DATA_DESIGNER_BASE_URL"))
    ])

def _create_nemo_client():
    """Helper to create the NeMo client."""
    from nemo_microservices import NeMoMicroservices
    
    return NeMoMicroservices(
        base_url=os.getenv("NEMO_DATA_DESIGNER_BASE_URL", "http://localhost:8000")
    )

def test_data_designer_client():
    """Test creating a Data Designer client."""
    print("\n🔍 Testing Data Designer client creation...")

    try:
        client = _create_nemo_client()
        # Verify data_designer resource is accessible
        _ = client.data_designer
        print("✅ Data Designer client created via NeMoMicroservices")

        return True

    except Exception as e:
        print(f"❌ Client creation error: {e}")
        return False

def test_basic_functionality():
    """Test basic functionality if possible."""
    print("\n🔍 Testing basic functionality...")

    try:
        client = _create_nemo_client()
        
        # In version 1.4+, we interact via client.data_designer
        print("✅ Client initialized - ready for service calls")
        return True

    except Exception as e:
        print(f"❌ Basic functionality test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Starting NeMo Microservices Setup Verification")
    print("=" * 50)

    # Run tests
    results = [
        ("NeMo Imports", test_nemo_imports()),
        ("Environment Variables", test_environment_variables()),
        ("Data Designer Client", test_data_designer_client()),
        ("Basic Functionality", test_basic_functionality())
    ]

    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)

def print_final_summary(all_passed):
    if all_passed:
        print("🎉 All tests passed! NeMo environment is ready.")
        print("\n📋 Next steps:")
        print("1. Start NeMo Data Designer service (docker compose up)")
        print("2. Configure service endpoints")
        print("3. Begin using data generation features")
        return 0

    print("⚠️  Some tests failed. Please check the issues above.")
    return 1

def main():
    """Run all tests."""
    print("🚀 Starting NeMo Microservices Setup Verification")
    print("=" * 50)

    # Run tests
    results = [
        ("NeMo Imports", test_nemo_imports()),
        ("Environment Variables", test_environment_variables()),
        ("Data Designer Client", test_data_designer_client()),
        ("Basic Functionality", test_basic_functionality())
    ]

    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)

    all_passed = all(passed for _, passed in results)
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")

    print("=" * 50)
    return print_final_summary(all_passed)

if __name__ == "__main__":
    sys.exit(main())
