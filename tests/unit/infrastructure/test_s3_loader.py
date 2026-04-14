import os

import pytest


def test_s3_loader_class_exists():
    from ai.core.utils.s3_dataset_loader import S3DatasetLoader

    assert S3DatasetLoader is not None


def test_s3_loader_methods_exist():
    from ai.core.utils.s3_dataset_loader import S3DatasetLoader

    assert hasattr(S3DatasetLoader, "load_json")
    assert hasattr(S3DatasetLoader, "stream_jsonl")
    assert hasattr(S3DatasetLoader, "stream_json_array")
    assert hasattr(S3DatasetLoader, "stream_json")
    assert hasattr(S3DatasetLoader, "upload_file")
    assert hasattr(S3DatasetLoader, "download_file")
    assert hasattr(S3DatasetLoader, "list_datasets")
    assert hasattr(S3DatasetLoader, "object_exists")


def test_s3_loader_requires_credentials(monkeypatch):
    for key in [
        "HETZNER_S3_ACCESS_KEY",
        "HETZNER_ACCESS_KEY",
        "AWS_ACCESS_KEY_ID",
        "HETZNER_S3_SECRET_KEY",
        "HETZNER_SECRET_KEY",
        "AWS_SECRET_ACCESS_KEY",
    ]:
        monkeypatch.delenv(key, raising=False)

    from ai.core.utils.s3_dataset_loader import S3DatasetLoader

    with pytest.raises(ValueError, match="S3 credentials not found"):
        S3DatasetLoader(aws_access_key_id=None, aws_secret_access_key=None)


def test_s3_loader_helper_functions():
    from ai.core.utils.s3_dataset_loader import get_s3_dataset_path, load_dataset_from_s3

    assert callable(get_s3_dataset_path)
    assert callable(load_dataset_from_s3)
