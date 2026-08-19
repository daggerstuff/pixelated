from __future__ import annotations

from sentence_transformers import SentenceTransformer

_models: dict[str, SentenceTransformer] = {}

ENCODE_BATCH_SIZE = 32


def get_model(name: str) -> SentenceTransformer:
    if name not in _models:
        _models[name] = SentenceTransformer(name)
    return _models[name]


def embed_texts(texts: list[str], model_name: str) -> list[list[float]]:
    """Encode texts to normalized vectors (cosine == dot product)."""
    if not texts:
        return []
    model = get_model(model_name)
    vectors = model.encode(texts, batch_size=ENCODE_BATCH_SIZE, normalize_embeddings=True, show_progress_bar=False)
    return [vector.tolist() for vector in vectors]
