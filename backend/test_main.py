from fastapi.testclient import TestClient

from .main import app

client = TestClient(app)


def test_memory_create():
    response = client.post("/api/memory/create", json={"userId": "test_user", "content": "test memory content"})
    assert response.status_code == 200
    assert response.json()["success"] == True
    assert "memory_id" in response.json()


def test_evaluation_missing_data():
    response = client.post("/api/evaluation", json={})
    assert response.status_code == 422
