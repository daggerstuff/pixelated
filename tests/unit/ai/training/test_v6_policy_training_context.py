"""Source review references must bind exactly to the frozen training record."""

import hashlib
import json

import pytest

from scripts.training.audit_v6_policy_training_context import bind_training_candidates
from scripts.training.summarize_v6_paired_evaluations import canonical_hash


def test_context_binding_rejects_stale_duplicate_and_unmatched_rows(tmp_path):
    raw = (json.dumps({"messages": [{"role": "user", "content": "Is this private?"}]}) + "\n").encode()
    train = tmp_path / "train.jsonl"
    train.write_bytes(raw)
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "train",
                "candidate_row_number_1based": 7,
                "candidate_row_sha256": "source-hash",
                "content_group_sha256": canonical_hash(json.loads(raw)["messages"]),
                "source_label": "synthetic",
            }
        )
        + "\n"
    )
    candidate = {"train_line": 1, "row_sha256": hashlib.sha256(raw).hexdigest()}
    result = bind_training_candidates(train, manifest, [candidate])
    assert result[0]["candidate_row"] == 7
    assert result[0]["user_mentions_privacy"]
    assert not result[0]["automatic_exclusion_authorized"]
    with pytest.raises(ValueError, match="stale"):
        bind_training_candidates(train, manifest, [{**candidate, "row_sha256": "wrong"}])
    with pytest.raises(ValueError, match="duplicate"):
        bind_training_candidates(train, manifest, [candidate, candidate])
    with pytest.raises(ValueError, match="unmatched"):
        bind_training_candidates(train, manifest, [{**candidate, "train_line": 2}])


def test_shuffled_training_is_joined_by_content_never_by_line_position(tmp_path):
    messages = [[{"role": "user", "content": text}] for text in ("first", "second")]
    records = [(json.dumps({"messages": m}) + "\n").encode() for m in messages]
    train = tmp_path / "train.jsonl"
    train.write_bytes(records[1] + records[0])
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text(
        "".join(
            json.dumps(
                {
                    "split": "train",
                    "candidate_row_number_1based": index + 1,
                    "candidate_row_sha256": str(index),
                    "source_label": str(index),
                    "content_group_sha256": canonical_hash(message),
                }
            )
            + "\n"
            for index, message in enumerate(messages)
        )
    )
    result = bind_training_candidates(
        train, manifest, [{"train_line": 1, "row_sha256": hashlib.sha256(records[1]).hexdigest()}]
    )
    assert result[0]["candidate_row"] == 2
    assert result[0]["source_label"] == "1"


def test_ambiguous_source_identity_fails_closed(tmp_path):
    messages = [{"role": "user", "content": "Synthetic context"}]
    raw = (json.dumps({"messages": messages}) + "\n").encode()
    train = tmp_path / "train.jsonl"
    train.write_bytes(raw)
    reference = {"split": "train", "content_group_sha256": canonical_hash(messages)}
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text((json.dumps(reference) + "\n") * 2)
    with pytest.raises(ValueError, match="ambiguous"):
        bind_training_candidates(train, manifest, [{"train_line": 1, "row_sha256": hashlib.sha256(raw).hexdigest()}])


def test_membership_multiplicities_are_checked_even_outside_review_queue(tmp_path):
    messages = [{"role": "user", "content": "Synthetic context"}]
    train = tmp_path / "train.jsonl"
    train.write_text(json.dumps({"messages": messages}) + "\n")
    reference = {"split": "train", "content_group_sha256": canonical_hash(messages)}
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text((json.dumps(reference) + "\n") * 2)
    with pytest.raises(ValueError, match="multiplicities"):
        bind_training_candidates(train, manifest, [])
