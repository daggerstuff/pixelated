def test_s3_loader_functions_exist():
    """Test that S3 loader functions can be imported and are callable."""
    from ai.infrastructure.s3.s3_dataset_loader import upload_dataset_artifact, download_dataset_artifact

    # Just import should succeed
    assert callable(upload_dataset_artifact)
    assert callable(download_dataset_artifact)

    # Test that they return bool (as per signature)
    result_upload = upload_dataset_artifact("/tmp/fake.txt", "fake-key")
    result_download = download_dataset_artifact("fake-key", "/tmp/downloaded.txt")
    assert isinstance(result_upload, bool)
    assert isinstance(result_download, bool)