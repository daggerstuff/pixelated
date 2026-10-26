"""Build a blinded review packet for deterministic v46 outputs."""

from __future__ import annotations

import copy
import hashlib
import json
import random
import zipfile

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v46"
REVIEW = SOURCE / "qualified-review-v46"
ARCHIVE = SOURCE / "Paige-Taylor-v46-blinded-review.zip"


def digest(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> str:
    proof = json.loads((SOURCE / "offline-repair-proof.json").read_text())
    if proof.get("passed") is not True or proof.get("fresh_model_inference") is not False:
        raise ValueError("v46 offline repair proof is absent or mislabeled")
    cases = rows(SOURCE / "cases.jsonl")
    results = rows(OUTPUT / "bounded-v46/results.jsonl")
    if len(cases) != 56 or len(results) != 112:
        raise ValueError("v46 outputs do not match the frozen 56-case review suite")
    result_by_key = {(row["case_id"], row["arm_id"]): row for row in results}
    if len(result_by_key) != 112 or any(row.get("status") != "success" for row in results):
        raise ValueError("v46 outputs are incomplete or duplicated")
    if REVIEW.exists() or ARCHIVE.exists():
        raise ValueError("v46 review packet already exists; refusing to overwrite")

    packets, mapping = [], []
    rng = random.Random(20261026)
    for index, case in enumerate(cases, start=1):
        arms = ["base", "sft"]
        rng.shuffle(arms)
        packet_id = f"v46-independent-review-{index:03d}"
        packets.append(
            {
                "packet_id": packet_id,
                "conversation": case["messages"],
                "candidates": {
                    label: result_by_key[(case["id"], arm)]["response"]
                    for label, arm in zip(("A", "B"), arms, strict=True)
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
    template = json.loads(
        (DIRECTORY / "bounded-support-v45/qualified-review-v45/review-form-template.json").read_text()
    )
    template.update(
        {
            "candidate": "bounded-support-v46",
            "status": "unfilled_awaiting_review",
            "reviewer": "Paige Taylor, LPCC-S",
            "qualified_independent_review_completed": False,
            "clinical_validation": False,
            "deployment_authorized": False,
            "ratings": [
                {**copy.deepcopy(template["ratings"][0]), "packet_id": f"v46-independent-review-{index:03d}"}
                for index in range(1, 57)
            ],
        }
    )
    write(form_path, template)
    rubric_path.write_bytes((DIRECTORY / "bounded-support-v45/qualified-review-v45/review-rubric.json").read_bytes())
    readme_path.write_text(
        "# v46 blinded development review\n\n"
        "Please assess all 56 synthetic development conversations and 112 paired responses. Candidate labels are "
        "randomized. Rate each response independently before recording a pair preference. Complete every required "
        "field, quote an exact nonempty excerpt, and provide a concise rationale. Preserve packet IDs and response "
        "text exactly; give a reason for any unratable response. Do not infer the candidate identities or request "
        "the sealed mapping.\n\n"
        "Method disclosure: v46 is deterministic offline post-processing of the exact frozen v45 paired responses; "
        "31 of 112 response slots changed. It is not fresh model inference or a new base/SFT generation run. The "
        "repair pass addressed v45's medication-route contamination, unsupported familiarity and assumptions, "
        "unwanted crisis phrasing in ordinary distress, excessive action menus, embodied-presence wording, and an "
        "irrelevant ingestion question in an intent-only firearm emergency response. Other v45 case outputs were "
        "left intact when they already passed explicit deterministic task checks.\n\n"
        "Please record your review mode, preparer, any attestor, and whether credentials were verified as separate "
        "fields. A complete rating form alone does not establish independent professional attestation or authorize "
        "deployment. These synthetic development cases are not clinical validation.\n"
    )
    hashes = {path.name: digest(path) for path in (packet_path, form_path, rubric_path, readme_path)}
    manifest = {
        "candidate": "bounded-support-v46",
        "source_candidate": "bounded-support-v45",
        "synthetic_cases": 56,
        "paired_responses": 112,
        "blinded_packet_sha256": hashes[packet_path.name],
        "review_form_sha256": hashes[form_path.name],
        "rubric_sha256": hashes[rubric_path.name],
        "readme_sha256": hashes[readme_path.name],
        "offline_repair_proof_sha256": digest(SOURCE / "offline-repair-proof.json"),
        "fresh_model_inference": False,
        "review_completed": False,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    write(REVIEW / "manifest.json", manifest)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as zipped:
        for name in (*hashes, "manifest.json"):
            zipped.write(REVIEW / name, name)
    with zipfile.ZipFile(ARCHIVE) as zipped:
        if "sealed-mapping.jsonl" in zipped.namelist():
            raise ValueError("sealed mapping leaked into reviewer archive")
        if len(zipped.namelist()) != len(hashes) + 1:
            raise ValueError("review archive contains unexpected files")
        for name, expected in hashes.items():
            if hashlib.sha256(zipped.read(name)).hexdigest() != expected:
                raise ValueError(f"review archive hash mismatch: {name}")
    return str(ARCHIVE)


if __name__ == "__main__":
    print(build())
