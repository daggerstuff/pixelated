"""Build a clinician-facing blinded bundle, with coordinator mappings kept outside."""

import hashlib
import json
import shutil
import zipfile

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows


def main():
    target = DIRECTORY / "acknowledgment-candidate-v8"
    bundle = target / "qualified-review"
    archive = target / "Paige-Taylor-blinded-review.zip"
    if bundle.exists() or archive.exists():
        raise ValueError("qualified bundle exists; no overwrite")
    source = DIRECTORY / "acknowledgment-v1/qualified-review"
    cases = rows(target / "cases.jsonl")
    results = rows(OUTPUT / target.name / "results.jsonl")
    if len(results) != 2 * len(cases) or any(r["status"] != "success" for r in results):
        raise ValueError("candidate incomplete; cannot silently omit failures")
    bundle.mkdir(parents=True)
    for name in (
        "blinded-packets.jsonl",
        "original-rubric.json",
        "original-review-form-template.json",
        "reviewer-intake.json",
    ):
        shutil.copyfile(source / name, bundle / name)
    lookup = {(r["case_id"], r["arm_id"]): r for r in results}
    packets, mapping, form = [], [], []
    for i, case in enumerate(cases):
        ident = f"followup-review-{i + 1:03d}"
        arms = ["base", "sft"]
        if hashlib.sha256(case["id"].encode()).digest()[0] % 2:
            arms.reverse()
        candidates = {label: lookup[case["id"], arm]["response"] for label, arm in zip(("A", "B"), arms, strict=True)}
        packets.append({"packet_id": ident, "conversation": case["messages"], "candidates": candidates})
        mapping.append(
            {"packet_id": ident, "case_id": case["id"], "label_to_arm": dict(zip(("A", "B"), arms, strict=True))}
        )
        form.append(
            {
                "packet_id": ident,
                "candidates": {
                    label: {
                        "task_met": None,
                        "acknowledgment_applicable": None,
                        "acknowledgment_met": None,
                        "critical_concern": None,
                        "evidence": None,
                        "rationale": None,
                        "criterion_disagreement": None,
                    }
                    for label in ("A", "B")
                },
            }
        )
    write_rows(bundle / "followup-blinded-packets.jsonl", packets)
    write(target / "qualified-review-sealed-mapping.json", mapping)
    write(bundle / "followup-review-form.json", {"reviewer": None, "completed_at": None, "ratings": form})
    criterion = rows(DIRECTORY / "acknowledgment-v11/judge-cases.jsonl")[0]["messages"][0]["content"]
    write(
        bundle / "prospective-nonclinical-criterion.json",
        {"criterion": criterion, "clinical_standard": False, "record_disagreement_separately": True},
    )
    write(
        bundle / "reviewer-assignment.json",
        {
            "reviewer_name": "Paige Taylor",
            "designation_source": "user",
            "human_verifier": "user",
            "clinical_qualification_verified": False,
            "independence_verified": False,
            "verification_status": "user will verify; confirmation pending",
            "verification_reference": None,
            "delivery": "prepared for user-managed sharing; not sent",
            "assessment_received": False,
        },
    )
    (bundle / "README.md").write_text(
        "# Blinded independent review\n\nDesignated reviewer: Paige Taylor. The user will verify clinical qualifications "
        "and independence; verification and the completed assessment are pending. No contact has been sent.\n\n"
        "Review the original 44 packets (88 responses) against the unchanged original rubric using the original form. "
        "Then review the 24 follow-up packets (48 responses) using the separate form and prospective nonclinical "
        "criterion. Record criterion disagreements explicitly. All materials are synthetic development data; this is "
        "not a holdout study. Model identities, mappings and automated ratings are withheld until ratings are frozen. "
        "Complete the intake with qualification/independence evidence and return the forms to the coordinator. "
        "Do not infer clinical validation or deployment authorization from this packet.\n"
    )
    files = {
        str(p.relative_to(bundle)): hashlib.sha256(p.read_bytes()).hexdigest() for p in bundle.rglob("*") if p.is_file()
    }
    write(
        bundle / "manifest.json",
        {
            "files_sha256": files,
            "original_packets": 44,
            "followup_packets": 24,
            "responses": 136,
            "qualification_verified": False,
            "review_completed": False,
        },
    )
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
        for p in sorted(bundle.rglob("*")):
            if p.is_file():
                zipped.write(p, p.relative_to(bundle))
    with zipfile.ZipFile(archive) as zipped:
        expected = {*files, "manifest.json"}
        if set(zipped.namelist()) != expected or any("sealed" in name for name in zipped.namelist()):
            raise ValueError("review archive contents differ")
        for name, digest in files.items():
            if hashlib.sha256(zipped.read(name)).hexdigest() != digest:
                raise ValueError("review archive hash differs")
    print(json.dumps({"archive": str(archive), "responses": 136, "manifest_verified": True, "sent": False}))


if __name__ == "__main__":
    main()
