"""Build a fresh blinded review packet for verified v38 synthetic outputs."""

from __future__ import annotations

import copy
import hashlib
import json
import random
import zipfile
from pathlib import Path

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> Path:
    source = DIRECTORY / "bounded-support-v38"
    target = source / "qualified-review-v38"
    archive = source / "Paige-Taylor-v38-blinded-review.zip"
    if target.exists() or archive.exists():
        raise ValueError("v38 review packet already exists; refusing to overwrite")
    proof = json.loads((source / "current-code-replay-proof.json").read_text())
    if proof.get("passed") is not True or proof.get("deployment_authorized") is not False:
        raise ValueError("v38 replay proof is absent or indicates authorization")

    cases = rows(source / "cases.jsonl")
    results = rows(OUTPUT / "bounded-v38/results.jsonl")
    prior_mapping = rows(DIRECTORY / "bounded-support-v35/sealed-review-mapping.jsonl")
    prior_case_ids = {row["case_id"] for row in prior_mapping}
    result_index = {(row["case_id"], row["arm_id"]): row for row in results}
    if (
        len(cases) != 56
        or len(result_index) != 112
        or len(result_index) != len(results)
        or any(row.get("status") != "success" for row in results)
        or prior_case_ids != {case["id"] for case in cases}
    ):
        raise ValueError("v38 review inputs are incomplete or do not match the prior frozen rubric")

    packets, mapping = [], []
    rng = random.Random(20261023)
    for index, case in enumerate(cases, start=1):
        arms = ["base", "sft"]
        rng.shuffle(arms)
        packet_id = f"v38-independent-review-{index:03d}"
        packets.append(
            {
                "packet_id": packet_id,
                "conversation": case["messages"],
                "candidates": {
                    label: result_index[(case["id"], arm)]["response"]
                    for label, arm in zip(("A", "B"), arms, strict=True)
                },
            }
        )
        mapping.append(
            {
                "packet_id": packet_id,
                "case_id": case["id"],
                "label_to_arm": dict(zip(("A", "B"), arms, strict=True)),
            }
        )

    target.mkdir(parents=True)
    packets_path = target / "blinded-packets.jsonl"
    form_path = target / "review-form-template.json"
    rubric_path = target / "review-rubric.json"
    write_rows(packets_path, packets)
    write_rows(target / "sealed-mapping.jsonl", mapping)
    prior_form = json.loads(
        (DIRECTORY / "bounded-support-v35/qualified-review-v35/review-form-template.json").read_text()
    )
    prior_form.update(
        {
            "candidate": "bounded-support-v38",
            "status": "unfilled_awaiting_review",
            "reviewer": "Paige Taylor, LPCC-S",
            "qualification_and_independence_verification_reference": (
                "User-confirmed for the same reviewer and prior v35 assessment on 2026-10-23; "
                "this v38 assessment has not been completed."
            ),
            "qualified_independent_review_completed": False,
            "clinical_validation": False,
            "deployment_authorized": False,
            "ratings": [
                {
                    **copy.deepcopy(prior_form["ratings"][0]),
                    "packet_id": f"v38-independent-review-{index:03d}",
                }
                for index in range(1, 57)
            ],
        }
    )
    write(form_path, prior_form)
    prior_rubric_path = DIRECTORY / "bounded-support-v35/qualified-review-v35/review-rubric.json"
    rubric_path.write_bytes(prior_rubric_path.read_bytes())
    (target / "README.md").write_text(
        "# v38 blinded development review\n\n"
        "This packet contains 56 synthetic development conversations and 112 v38 responses. Candidate labels are "
        "randomized. Review both responses independently for task completion, safety, format, and evidence; record "
        "exact excerpts and disagreements, then freeze ratings before requesting the sealed mapping. The previous "
        "v35 ratings and all model identities are withheld from this packet.\n\n"
        "The same reviewer's qualification and independence were confirmed by the user for the v35 assessment. "
        "This new v38 review remains incomplete. These synthetic cases are not clinical validation and this packet "
        "does not authorize promotion or deployment.\n"
    )
    file_hashes = {path.name: digest(path) for path in (packets_path, form_path, rubric_path, target / "README.md")}
    write(
        target / "manifest.json",
        {
            "candidate": "v38",
            "synthetic_cases": 56,
            "paired_responses": 112,
            "blinded_packet_sha256": file_hashes[packets_path.name],
            "review_form_sha256": file_hashes[form_path.name],
            "rubric_sha256": file_hashes[rubric_path.name],
            "v38_replay_proof_sha256": digest(source / "current-code-replay-proof.json"),
            "qualification_confirmed_for_reviewer_by_user": True,
            "v38_review_completed": False,
            "clinical_validation": False,
            "deployment_authorized": False,
            "sealed_mapping_path": "sealed-mapping.jsonl (coordinator only; exclude from delivery)",
        },
    )
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
        for name in (*file_hashes, "manifest.json"):
            zipped.write(target / name, name)
    with zipfile.ZipFile(archive) as zipped:
        if "sealed-mapping.jsonl" in zipped.namelist():
            raise ValueError("sealed arm mapping leaked into the reviewer archive")
        if any(hashlib.sha256(zipped.read(name)).hexdigest() != expected for name, expected in file_hashes.items()):
            raise ValueError("review packet archive hash validation failed")
        if len(zipped.namelist()) != len(file_hashes) + 1:
            raise ValueError("review packet archive contains unexpected files")
    return archive


if __name__ == "__main__":
    print(build())
