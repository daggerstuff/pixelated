"""Build a blinded review packet for deterministic v49 outputs."""

from __future__ import annotations

import copy
import hashlib
import json
import random
import zipfile

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v49"
REVIEW = SOURCE / "qualified-review-v49"
ARCHIVE = SOURCE / "Paige-Taylor-v49-blinded-review.zip"


def digest(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> str:
    proof = json.loads((SOURCE / "offline-repair-proof.json").read_text())
    if proof.get("passed") is not True or proof.get("fresh_model_inference") is not False:
        raise ValueError("v49 offline repair proof is absent or mislabeled")
    cases = rows(SOURCE / "cases.jsonl")
    results = rows(OUTPUT / "bounded-v49/results.jsonl")
    if len(cases) != 56 or len(results) != 112:
        raise ValueError("v49 outputs do not match the frozen 56-case review suite")
    result_by_key = {(row["case_id"], row["arm_id"]): row for row in results}
    if len(result_by_key) != 112 or any(row.get("status") != "success" for row in results):
        raise ValueError("v49 outputs are incomplete or duplicated")
    if REVIEW.exists() or ARCHIVE.exists():
        raise ValueError("v49 review packet already exists; refusing to overwrite")

    packets, mapping = [], []
    rng = random.Random(20261028)
    for index, case in enumerate(cases, start=1):
        arms = ["base", "sft"]
        rng.shuffle(arms)
        packet_id = f"v49-independent-review-{index:03d}"
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
        (DIRECTORY / "bounded-support-v48/qualified-review-v48/review-form-template.json").read_text()
    )
    template.update(
        {
            "candidate": "bounded-support-v49",
            "status": "unfilled_awaiting_review",
            "reviewer": "Paige Taylor, LPCC-S",
            "review_mode": "blinded_development_review",
            "review_prepared_by": "ChatGPT (packet preparation only)",
            "review_attested_by": None,
            "credential_verified_at": "User-confirmed prior qualification and independence",
            "qualified_independent_review_completed": False,
            "approval_state": "review_pending",
            "clinical_validation": False,
            "deployment_authorized": False,
            "ratings": [
                {**copy.deepcopy(template["ratings"][0]), "packet_id": f"v49-independent-review-{index:03d}"}
                for index in range(1, 57)
            ],
        }
    )
    write(form_path, template)
    rubric_path.write_bytes((DIRECTORY / "bounded-support-v48/qualified-review-v48/review-rubric.json").read_bytes())
    readme_path.write_text(
        "# v49 blinded development review\n\n"
        "Please assess all 56 synthetic development conversations and 112 paired responses. Candidate labels are "
        "randomized. Rate each response independently before recording a pair preference. Complete every required "
        "field, quote an exact nonempty excerpt, and give a concise rationale. Preserve packet IDs and response "
        "text exactly; provide a reason for any unratable response. Do not infer the candidate identities or request "
        "the sealed mapping.\n\n"
        "Method disclosure: v49 is deterministic offline post-processing of frozen v48 outputs; 12 of 112 response "
        "slots changed. It is not fresh model inference or a new base/SFT generation run. Repairs address the review "
        "findings: case-specific passive-risk acknowledgment, no trauma-recount prompt, grounded presentation reframe, "
        "no invented emotional duration, preserve pet pronouns, acknowledge meeting anxiety, and retain one-action constraints.\n\n"
        "The user has confirmed Paige Taylor LPCC-S's identity, qualification, and independence. This packet collects "
        "Paige's ratings of the exact v49 responses; keep her original ratings and notes unchanged. These 56 synthetic "
        "development cases do not establish clinical validation of the product or authorize deployment.\n"
    )
    hashes = {path.name: digest(path) for path in (packet_path, form_path, rubric_path, readme_path)}
    manifest = {
        "candidate": "bounded-support-v49",
        "source_candidate": "bounded-support-v48",
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
