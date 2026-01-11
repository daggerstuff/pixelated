#!/usr/bin/env python3
"""
Debug script to check what bucket name S3DatasetLoader is using
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def main():
    print("🔍 Debugging S3 bucket configuration...")
    print("=" * 60)
    
    # Check environment variables
    print("Environment variables:")
    print(f"  OVH_S3_ACCESS_KEY: {'SET' if os.environ.get('OVH_S3_ACCESS_KEY') else 'NOT_SET'}")
    print(f"  OVH_S3_SECRET_KEY: {'SET' if os.environ.get('OVH_S3_SECRET_KEY') else 'NOT_SET'}")
    print(f"  OVH_S3_ENDPOINT: {os.environ.get('OVH_S3_ENDPOINT', 'NOT_SET')}")
    print(f"  OVH_S3_BUCKET: {os.environ.get('OVH_S3_BUCKET', 'NOT_SET')}")
    print()
    
    try:
        # Initialize S3 loader
        loader = S3DatasetLoader()
        print(f"✅ S3DatasetLoader initialized successfully!")
        print(f"   Bucket being used: {loader.bucket}")
        print(f"   Endpoint being used: {loader.endpoint_url}")
        print()
        
        # Try to list buckets using the S3 client
        print("📋 Trying to list available buckets...")
        try:
            response = loader.s3_client.list_buckets()
            if response.get('Buckets'):
                print("Available buckets:")
                for bucket in response['Buckets']:
                    print(f"  - {bucket['Name']}")
            else:
                print("  No buckets found or access denied")
        except Exception as e:
            print(f"  Error listing buckets: {e}")
        
    except Exception as e:
        print(f"❌ S3DatasetLoader initialization failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())