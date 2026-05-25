from unittest import mock

import pytest
from fastapi.testclient import TestClient

try:
    from src.services.reprioritizer.app import app
except ImportError as e:
    pytest.skip(f"Skipping prioritization tests: {e}", allow_module_level=True)


# Helper to mock MongoDB collection count_documents
class AsyncMockCollection:
    async def count_documents(self, _filter):
        return 42


# Helper to mock Redis client get/set
class AsyncMockRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value


@pytest.fixture
def mock_mongo(monkeypatch):
    # Patch the mongo_db used in the service to use the mock collection
    mock_db = mock.MagicMock()
    mock_db.__getitem__.return_value = AsyncMockCollection()
    monkeypatch.setattr("src.services.reprioritizer.app.mongo_db", mock_db)


@pytest.fixture
def mock_redis(monkeypatch):
    mock_redis_client = AsyncMockRedis()
    monkeypatch.setattr("src.services.reprioritizer.app.redis_client", mock_redis_client)
    return mock_redis_client


def test_adjust_prioritization(mock_mongo, mock_redis):
    client = TestClient(app)
    payload = {"dummy": "data"}
    response = client.post("/api/prioritization/adjust", json=payload, headers={"Authorization": "Bearer dummy"})
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 42
    assert data["cached"] is False
    # Second request should hit cache
    response2 = client.post("/api/prioritization/adjust", json=payload, headers={"Authorization": "Bearer dummy"})
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["score"] == 42
    assert data2["cached"] is True
