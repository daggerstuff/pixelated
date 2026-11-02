"""Create a blinded review packet for the exact v51 response candidate."""

from __future__ import annotations

import copy
import hashlib
import json
import random
import zipfile

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v51"
SOURCE_REVIEW = DIRECTORY / "bounded-support-v50/qualified-review-v50"
REVIEW = SOURCE / "qualified-review-v51"
ARCHIVE = SOURCE / "Paige-Taylor-v51-blinded-review.zip"


def digest(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> str:
    proof = json.loads((SOURCE / "offline-repair-proof.json").read_text())
    audit = json.loads((SOURCE / "comprehensive-release-audit.json").read_text())
    cases = rows(SOURCE / "cases.jsonl")
    results = rows(OUTPUT / "bounded-v51/results.jsonl")
    keyed = {(row["case_id"], row["arm_id"]): row for row in results}
    if (
        proof.get("responses_repaired") != 22
        or audit.get("passed") is not True
        or len(cases) != 56
        or len(keyed) != 112
    ):
        raise ValueError("v51 proof, audit, or frozen output set is incomplete")
    if REVIEW.exists() or ARCHIVE.exists():
        raise ValueError("v51 review packet already exists; refusing to overwrite")

    rng = random.Random(20261026)
    packets, mapping = [], []
    for index, case in enumerate(cases, start=1):
        arms = ["base", "sft"]
        rng.shuffle(arms)
        packet_id = f"v51-independent-review-{index:03d}"
        packets.append(
            {
                "packet_id": packet_id,
                "conversation": case["messages"],
                "candidates": {
                    label: keyed[(case["id"], arm)]["response"] for label, arm in zip(("A", "B"), arms, strict=True)
                },
            }
        )
        mapping.append(
            {"packet_id": packet_id, "case_id": case["id"], "label_to_arm": dict(zip(("A", "B"), arms, strict=True))}
        )

    REVIEW.mkdir(parents=True)
    packet_path = REVIEW / "blinded-packets.jsonl"
    form_path = REVIEW / "review-form-template.json"
    rubric_path = REVIEW / "review-rubric.json"
    readme_path = REVIEW / "README.md"
    write_rows(packet_path, packets)
    write_rows(REVIEW / "sealed-mapping.jsonl", mapping)

    template = json.loads((SOURCE_REVIEW / "review-form-template.json").read_text())
    template.update(
        {
            "candidate": "bounded-support-v51",
            "status": "unfilled_awaiting_review",
            "ratings": [
                {
                    **copy.deepcopy(template["ratings"][0]),
                    "packet_id": f"v51-independent-review-{index:03d}",
                }
                for index in range(1, 57)
            ],
        }
    )
    write(form_path, template)
    rubric = json.loads((SOURCE_REVIEW / "review-rubric.json").read_text())
    write(rubric_path, rubric)
    readme_path.write_text(
        "# v51 blinded development review\n\n"
        "Please assess all 56 synthetic development conversations and 112 paired responses. Candidate labels are randomized. "
        "Rate each response independently before recording a pair preference. Complete every required field, quote exact evidence, "
        "and explain any unratable response. Preserve packet IDs and response text. Do not request the sealed mapping.\n\n"
        "Method: v51 applies 22 deterministic repairs to the frozen v50 paired outputs; there was no new model inference or "
        "training run. The repairs address the v50 assessment's targeted findings while retaining the original case set and "
        "all non-targeted response slots. Read and rate the blinded response packet before consulting any implementation notes.\n\n"
        "These synthetic development cases do not establish clinical validation. This review packet does not authorize "
        "promotion or deployment.\n"
    )

    member_hashes = {path.name: digest(path) for path in (packet_path, form_path, rubric_path, readme_path)}
    manifest = {
        "candidate": "bounded-support-v51",
        "source_candidate": "bounded-support-v50",
        "synthetic_cases": 56,
        "paired_responses": 112,
        "response_slots_repaired": 22,
        "blinded_packet_sha256": member_hashes[packet_path.name],
        "review_form_sha256": member_hashes[form_path.name],
        "rubric_sha256": member_hashes[rubric_path.name],
        "readme_sha256": member_hashes[readme_path.name],
        "offline_repair_proof_sha256": digest(SOURCE / "offline-repair-proof.json"),
        "release_audit_sha256": digest(SOURCE / "comprehensive-release-audit.json"),
        "fresh_model_inference": False,
        "review_completed": False,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    write(REVIEW / "manifest.json", manifest)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as zipped:
        for name in (*member_hashes, "manifest.json"):
            zipped.write(REVIEW / name, name)
    with zipfile.ZipFile(ARCHIVE) as zipped:
        names = zipped.namelist()
        if "sealed-mapping.jsonl" in names or len(names) != 5:
            raise ValueError("v51 archive leaked mapping or contains unexpected files")
        for name, expected in member_hashes.items():
            if hashlib.sha256(zipped.read(name)).hexdigest() != expected:
                raise ValueError(f"v51 packet hash mismatch: {name}")
    return str(ARCHIVE)


if __name__ == "__main__":
    print(build())
