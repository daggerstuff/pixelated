"""Create a usable offline review packet without altering frozen evidence."""

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "docs/training/execution-2026-10-21/policy-resolution-v1/acknowledgment-candidate-v8"
ASSETS = Path(__file__).parent / "review_assets"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build(target=TARGET):
    source = target / "qualified-review"
    bundle = target / "qualified-review-v2"
    archive = target / "Paige-Taylor-blinded-review-v2.zip"
    if bundle.exists() or archive.exists():
        raise ValueError("Review v2 already exists; preserve issued packets")
    names = (
        "blinded-packets.jsonl",
        "followup-blinded-packets.jsonl",
        "original-rubric.json",
        "prospective-nonclinical-criterion.json",
    )
    files = {name: (source / name).read_bytes() for name in names}
    frozen = json.loads((source / "manifest.json").read_text())["files_sha256"]
    if any(digest(files[name]) != frozen[name] for name in names):
        raise ValueError("Frozen review inputs differ from their issued manifest")
    original = [json.loads(line) for line in files[names[0]].splitlines()]
    followup = [json.loads(line) for line in files[names[1]].splitlines()]
    if len(original) != 44 or len(followup) != 24:
        raise ValueError("Unexpected packet counts")
    packets = [dict(p, packet_id=p["id"], section="original") for p in original]
    packets += [dict(p, section="followup") for p in followup]
    ids = [p["packet_id"] for p in packets]
    if len(set(ids)) != 68 or any(set(p["candidates"]) != {"A", "B"} for p in packets):
        raise ValueError("Invalid blind identities")
    rubric = json.loads(files["original-rubric.json"])
    payload = {
        "bundle_id": "paige-taylor-v6-review-v2",
        "packet_sha256": {n: digest(files[n]) for n in names},
        "rubric_sha256": digest(files["original-rubric.json"]),
        "packets": packets,
        "dimensions": rubric["rating_protocol"]["dimensions"],
        "critical_failure_definition": rubric["rating_protocol"]["critical_failure"],
        "prospective_criterion": json.loads(files["prospective-nonclinical-criterion.json"])["criterion"],
        "reviewer_verification": {
            "reviewer": "Paige Taylor",
            "verified_by": "user",
            "verified_date": "2026-10-22",
            "qualification_verified": True,
            "independence_verified": True,
            "source": "Explicit user attestation; assessment not yet completed",
        },
    }
    template = {
        "schema_version": "paige-review-v2",
        "bundle_id": payload["bundle_id"],
        "packet_sha256": payload["packet_sha256"],
        "rubric_sha256": payload["rubric_sha256"],
        "reviewer_verification": payload["reviewer_verification"],
        "reviewer": "Paige Taylor",
        "reviewer_notes": "",
        "completed_at": None,
        "status": "draft",
        "ratings": {},
        "pair_preferences": {},
    }
    for p in packets:
        template["ratings"][p["packet_id"]] = {}
        for label in ("A", "B"):
            rating = {"rating_status": "", "evidence": "", "rationale": "", "criterion_disagreement": ""}
            if p["section"] == "original":
                rating.update(
                    dimension_scores=dict.fromkeys(payload["dimensions"]), critical_failure=None, quality_concerns=""
                )
            else:
                rating.update(
                    task_met=None, acknowledgment_applicable=None, acknowledgment_met=None, critical_concern=None
                )
            template["ratings"][p["packet_id"]][label] = rating
        if p["section"] == "original":
            template["pair_preferences"][p["packet_id"]] = {"preference": "", "rationale": ""}
    payload["template"] = template
    # Escape a closing script tag even if it occurs inside a response excerpt.
    encoded = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
    html = (ASSETS / "assessment.html").read_text().replace("__REVIEW_DATA__", encoded)
    files["START-HERE.html"] = html.encode()
    files["assessment-template.json"] = (json.dumps(template, indent=2) + "\n").encode()
    files["reviewer-assignment.json"] = (json.dumps(payload["reviewer_verification"], indent=2) + "\n").encode()
    files["README.txt"] = (
        b"PAIGE TAYLOR - BLINDED ASSESSMENT, VERSION 2\n\n"
        b"1. Extract this ZIP into a folder. Open START-HERE.html in Chrome, Edge, Firefox or Safari.\n"
        b"   No installation, server or internet connection is needed.\n"
        b"2. Read the instructions and each conversation; assess A and B independently.\n"
        b"   Use the dropdown choices and short text boxes. All clinical judgments start blank.\n"
        b"3. There are 44 original conversations (88 responses), then 24 follow-up conversations\n"
        b"   (48 responses). Some contexts overlap. Use the Next / Previous buttons or case selector.\n"
        b"4. Original responses: four scores from 0 to 2, critical failure yes/no, supporting excerpt,\n"
        b"   rationale and any other concerns. Then choose A, B, tie or unratable with a reason.\n"
        b"   Follow-up responses: task met, acknowledgment applicable/met, critical concern and reasons.\n"
        b"   If acknowledgment is not applicable, choose No; its met answer is then left blank.\n"
        b"   You may mark any response unratable and explain why instead of forcing a judgment.\n"
        b"5. Use Save draft regularly and before closing. It downloads a JSON answer file.\n"
        b"   To resume, reopen START-HERE.html and use Load saved answers. Browser recovery is\n"
        b"   best effort only; keep the downloaded draft.\n"
        b"6. When finished, choose Export completed assessment. The form checks missing answers.\n"
        b"   Return the downloaded assessment JSON to the person who provided this packet.\n"
        b"   It includes your ratings, explanations, completion time and evidence identifiers.\n\n"
        b"Your clinical qualification and independence were verified by the user on October 22, 2026;\n"
        b"you do not need to repeat that verification. Reviewer notes are optional.\n"
        b"The original rubric and conversation/response text are unchanged. Version 2 adds the\n"
        b"missing original rubric scores and pair preference fields and a browser form.\n"
        b"Model identities, coordinator mappings and automated ratings are excluded.\n"
        b"These are synthetic development examples, not patient records or a holdout study.\n"
        b"Record disagreements with the research criteria explicitly. Submission means the assessment\n"
        b"is complete, not that the model is approved or clinically validated. Unratable items remain visible.\n"
        b"The older ZIP is superseded for conducting this assessment.\n"
    )
    manifest = {
        "bundle_id": payload["bundle_id"],
        "supersedes": "Paige-Taylor-blinded-review.zip",
        "files_sha256": {n: digest(b) for n, b in files.items()},
        "original_packets": 44,
        "followup_packets": 24,
        "responses": 136,
        "qualification_verified": True,
        "independence_verified": True,
        "review_completed": False,
        "frozen_inputs_unchanged": list(names),
    }
    files["manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    bundle.mkdir()
    for name, content in files.items():
        (bundle / name).write_bytes(content)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
        for name, content in files.items():
            zipped.writestr(name, content)
    with zipfile.ZipFile(archive) as zipped:
        if set(zipped.namelist()) != set(files) or any(zipped.read(n) != b for n, b in files.items()):
            raise ValueError("Archive verification failed")
    return {"archive": str(archive), "sha256": digest(archive.read_bytes()), "files": len(files), "responses": 136}


if __name__ == "__main__":
    print(json.dumps(build()))
