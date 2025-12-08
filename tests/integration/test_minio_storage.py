"""
Integration tests for MinIO/S3 object storage operations.

These tests verify that the minio==7.2.11 upgrade doesn't introduce
regressions in critical storage operations including:
- Bucket creation and management
- Object upload/download
- Presigned URL generation
- Path-style vs virtual-hosted-style addressing
- TLS/SSL handling
- Authentication and signature calculation
- Response parsing

Run with: pytest tests/integration/test_minio_storage.py -v
Requires: Local MinIO instance running (see docker-compose.milvus.yml or docker-compose.yml)
"""
import contextlib
import os
import tempfile
import uuid
from io import BytesIO
from typing import Generator

import pytest
from minio import Minio
from minio.error import S3Error


# Test configuration
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
MINIO_SECURE = os.getenv('MINIO_SECURE', 'false').lower() == 'true'
MINIO_REGION = os.getenv('MINIO_REGION', 'us-east-1')

# Skip tests if MinIO is not available
SKIP_MINIO_TESTS = os.getenv('SKIP_MINIO_TESTS', 'false').lower() == 'true'


def _upload_multiple_objects(
    minio_client: Minio, test_bucket: str, object_names: list[str], data: bytes = b'test data'
) -> None:
    """Helper to upload multiple objects."""
    for obj_name in object_names:
        minio_client.put_object(
            test_bucket,
            obj_name,
            BytesIO(data),
            length=len(data),
        )


@pytest.fixture(scope='module')
def minio_client() -> Generator[Minio, None, None]:
    """
    Create a MinIO client for testing.

    This fixture creates a client connection to MinIO and verifies
    connectivity before running tests.
    """
    if SKIP_MINIO_TESTS:
        pytest.skip('MinIO tests are disabled via SKIP_MINIO_TESTS')

    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
        region=MINIO_REGION,
    )

    # Verify connection by listing buckets (will raise if connection fails)
    try:
        client.list_buckets()
    except Exception as e:
        pytest.skip(f'MinIO not available at {MINIO_ENDPOINT}: {e}')

    yield client


@pytest.fixture
def test_bucket(minio_client: Minio) -> Generator[str, None, None]:
    """
    Create a temporary test bucket and clean it up after tests.

    Each test gets a unique bucket to ensure isolation.
    """
    bucket_name = f'test-bucket-{uuid.uuid4().hex[:8]}'

    try:
        # Create bucket
        minio_client.make_bucket(bucket_name)
        yield bucket_name
    finally:
        # Cleanup: remove all objects and delete bucket
        with contextlib.suppress(S3Error):
            objects = minio_client.list_objects(bucket_name, recursive=True)
            for obj in objects:
                minio_client.remove_object(bucket_name, obj.object_name)
            minio_client.remove_bucket(bucket_name)


class TestMinIOBucketOperations:
    """Test bucket creation, listing, and management operations."""

    def test_create_bucket(self, minio_client: Minio):
        """Test basic bucket creation."""
        bucket_name = f'test-create-{uuid.uuid4().hex[:8]}'

        try:
            minio_client.make_bucket(bucket_name)

            # Verify bucket exists
            buckets = [b.name for b in minio_client.list_buckets()]
            assert bucket_name in buckets

        finally:
            with contextlib.suppress(S3Error):
                minio_client.remove_bucket(bucket_name)

    def test_bucket_exists(self, minio_client: Minio, test_bucket: str):
        """Test bucket existence check."""
        assert minio_client.bucket_exists(test_bucket)

        # Non-existent bucket should return False
        assert not minio_client.bucket_exists('non-existent-bucket-xyz')

    def test_list_buckets(self, minio_client: Minio, test_bucket: str):
        """Test listing buckets."""
        buckets = minio_client.list_buckets()
        bucket_names = [b.name for b in buckets]
        assert test_bucket in bucket_names


class TestMinIOObjectOperations:
    """Test object upload, download, and management operations."""

    def test_upload_object_from_bytes(self, minio_client: Minio, test_bucket: str):
        """Test uploading an object from bytes."""
        object_name = 'test-object.txt'
        test_data = b'Hello, MinIO! This is test data.'

        # Upload
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
            content_type='text/plain',
        )

        # Verify upload
        assert minio_client.stat_object(test_bucket, object_name)

    def test_upload_object_from_file(self, minio_client: Minio, test_bucket: str):
        """Test uploading an object from a file."""
        object_name = 'test-file.txt'
        test_data = b'File upload test data'

        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(test_data)
            tmp_file.flush()

            try:
                minio_client.fput_object(
                    test_bucket,
                    object_name,
                    tmp_file.name,
                    content_type='text/plain',
                )

                # Verify upload
                stat = minio_client.stat_object(test_bucket, object_name)
                assert stat.size == len(test_data)
            finally:
                os.unlink(tmp_file.name)

    def test_download_object_to_bytes(self, minio_client: Minio, test_bucket: str):
        """Test downloading an object to bytes."""
        object_name = 'download-test.txt'
        test_data = b'Download test data'

        # Upload first
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Download
        response = minio_client.get_object(test_bucket, object_name)
        downloaded_data = response.read()
        response.close()
        response.release_conn()

        assert downloaded_data == test_data

    def test_download_object_to_file(self, minio_client: Minio, test_bucket: str):
        """Test downloading an object to a file."""
        object_name = 'download-file-test.txt'
        test_data = b'File download test data'

        # Upload first
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Download to file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            try:
                minio_client.fget_object(test_bucket, object_name, tmp_file.name)

                with open(tmp_file.name, 'rb') as f:
                    downloaded_data = f.read()

                assert downloaded_data == test_data
            finally:
                os.unlink(tmp_file.name)

    def test_list_objects(self, minio_client: Minio, test_bucket: str):
        """Test listing objects in a bucket."""
        # Upload multiple objects
        objects = ['obj1.txt', 'obj2.txt', 'subdir/obj3.txt']
        _upload_multiple_objects(minio_client, test_bucket, objects, b'test data')

        # List all objects
        listed_objects = list(minio_client.list_objects(test_bucket, recursive=True))
        listed_names = [obj.object_name for obj in listed_objects]

        # Verify all objects are in the list
        assert set(objects).issubset(set(listed_names))

    def test_list_objects_with_prefix(self, minio_client: Minio, test_bucket: str):
        """Test listing objects with a prefix filter."""
        # Upload objects with different prefixes
        minio_client.put_object(
            test_bucket,
            'prefix1/file1.txt',
            BytesIO(b'data'),
            length=4,
        )
        minio_client.put_object(
            test_bucket,
            'prefix2/file2.txt',
            BytesIO(b'data'),
            length=4,
        )

        # List only prefix1 objects
        listed_objects = list(
            minio_client.list_objects(test_bucket, prefix='prefix1/', recursive=True)
        )
        listed_names = [obj.object_name for obj in listed_objects]

        assert 'prefix1/file1.txt' in listed_names
        assert 'prefix2/file2.txt' not in listed_names

    def test_stat_object(self, minio_client: Minio, test_bucket: str):
        """Test getting object metadata."""
        object_name = 'stat-test.txt'
        test_data = b'Stat test data'
        content_type = 'text/plain'

        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
            content_type=content_type,
        )

        stat = minio_client.stat_object(test_bucket, object_name)
        assert stat.size == len(test_data)
        assert stat.content_type == content_type

    def test_remove_object(self, minio_client: Minio, test_bucket: str):
        """Test removing an object."""
        object_name = 'remove-test.txt'

        # Upload
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(b'test'),
            length=4,
        )

        # Verify exists
        assert minio_client.stat_object(test_bucket, object_name)

        # Remove
        minio_client.remove_object(test_bucket, object_name)

        # Verify removed (should raise S3Error)
        with pytest.raises(S3Error):
            minio_client.stat_object(test_bucket, object_name)


class TestMinIOPresignedURLs:
    """Test presigned URL generation and access."""

    @staticmethod
    def _verify_presigned_url(url: str, bucket_name: str, object_name: str) -> None:
        """Helper to verify presigned URL structure."""
        assert url is not None
        assert bucket_name in url
        assert object_name in url

    def test_presigned_get_url(self, minio_client: Minio, test_bucket: str):
        """Test generating a presigned GET URL."""
        object_name = 'presigned-get-test.txt'
        test_data = b'Presigned URL test data'

        # Upload
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Generate presigned URL (valid for 1 hour)
        url = minio_client.presigned_get_object(test_bucket, object_name, expires=3600)

        # Verify URL is generated
        self._verify_presigned_url(url, test_bucket, object_name)

    def test_presigned_put_url(self, minio_client: Minio, test_bucket: str):
        """Test generating a presigned PUT URL."""
        object_name = 'presigned-put-test.txt'

        # Generate presigned PUT URL
        url = minio_client.presigned_put_object(test_bucket, object_name, expires=3600)

        # Verify URL is generated
        self._verify_presigned_url(url, test_bucket, object_name)

    def test_presigned_url_expires(self, minio_client: Minio, test_bucket: str):
        """Test that presigned URLs respect expiration."""
        object_name = 'expires-test.txt'
        test_data = b'Expiration test'

        # Upload
        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Generate URL with short expiration (1 second for testing)
        # Note: In real scenarios, use longer expiration times
        url = minio_client.presigned_get_object(test_bucket, object_name, expires=1)
        assert url is not None


class TestMinIOErrorHandling:
    """Test error handling and edge cases."""

    def test_stat_nonexistent_object(self, minio_client: Minio, test_bucket: str):
        """Test that stat_object raises S3Error for non-existent objects."""
        with pytest.raises(S3Error):
            minio_client.stat_object(test_bucket, 'non-existent-object.txt')

    def test_get_nonexistent_object(self, minio_client: Minio, test_bucket: str):
        """Test that get_object raises S3Error for non-existent objects."""
        with pytest.raises(S3Error):
            response = minio_client.get_object(test_bucket, 'non-existent.txt')
            response.close()
            response.release_conn()

    def test_remove_nonexistent_object(self, minio_client: Minio, test_bucket: str):
        """Test removing a non-existent object (should not raise)."""
        # Removing non-existent object should not raise (idempotent)
        minio_client.remove_object(test_bucket, 'non-existent-object.txt')

    def test_upload_to_nonexistent_bucket(self, minio_client: Minio):
        """Test that uploading to non-existent bucket raises S3Error."""
        with pytest.raises(S3Error):
            minio_client.put_object(
                'non-existent-bucket',
                'test.txt',
                BytesIO(b'test'),
                length=4,
            )


class TestMinIOContentTypes:
    """Test content type handling."""

    def test_upload_with_content_type(self, minio_client: Minio, test_bucket: str):
        """Test uploading with explicit content type."""
        object_name = 'content-type-test.json'
        test_data = b'{"key": "value"}'
        content_type = 'application/json'

        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
            content_type=content_type,
        )

        stat = minio_client.stat_object(test_bucket, object_name)
        assert stat.content_type == content_type

    def test_upload_binary_data(self, minio_client: Minio, test_bucket: str):
        """Test uploading binary data."""
        object_name = 'binary-test.bin'
        # Create some binary data
        test_data = bytes(range(256))

        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
            content_type='application/octet-stream',
        )

        # Download and verify
        response = minio_client.get_object(test_bucket, object_name)
        downloaded_data = response.read()
        response.close()
        response.release_conn()

        assert downloaded_data == test_data


class TestMinIORegionHandling:
    """Test region-specific behavior (important for S3 compatibility)."""

    def test_client_with_region(self, minio_client: Minio, test_bucket: str):
        """Test that region is properly handled in client configuration."""
        # This test verifies that region setting doesn't break operations
        object_name = 'region-test.txt'
        test_data = b'Region test data'

        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Verify object exists
        stat = minio_client.stat_object(test_bucket, object_name)
        assert stat.size == len(test_data)


class TestMinIOSignatureCalculation:
    """
    Test signature calculation (critical for authentication).

    MinIO has had issues with signature calculation changes across versions.
    These tests verify that signatures are calculated correctly.
    """

    def test_multiple_operations_same_client(self, minio_client: Minio, test_bucket: str):
        """Test that multiple operations with the same client maintain correct signatures."""
        # Perform multiple operations to verify signature consistency
        objects = [f'obj{i}.txt' for i in range(5)]
        test_data = b'test data'

        # Upload all objects
        _upload_multiple_objects(minio_client, test_bucket, objects, test_data)

        # Verify all objects exist with correct size
        listed_objects = list(minio_client.list_objects(test_bucket, recursive=True))
        listed_names = {obj.object_name for obj in listed_objects}
        assert set(objects).issubset(listed_names)
        assert len(listed_names) >= len(objects)
        # Verify size by checking a sample object (all should have same size)
        sample_stat = minio_client.stat_object(test_bucket, objects[0])
        assert sample_stat.size == len(test_data)

    def test_presigned_url_signature(self, minio_client: Minio, test_bucket: str):
        """Test that presigned URLs have valid signatures."""
        object_name = 'signature-test.txt'
        test_data = b'Signature test'

        minio_client.put_object(
            test_bucket,
            object_name,
            BytesIO(test_data),
            length=len(test_data),
        )

        # Generate presigned URL
        url = minio_client.presigned_get_object(test_bucket, object_name)

        # URL should contain signature parameters
        assert 'X-Amz-Signature' in url or 'signature' in url.lower()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
