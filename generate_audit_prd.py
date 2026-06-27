import json

stories = []
for i in range(1, 31):
    stories.append(
        {
            "id": f"US-{i:03d}",
            "title": f"Audit Round {i}: Adversarial Hardening",
            "description": "As an adversarial auditor (Pied Piper, Man In Black, or Chaos Monkey), I want to relentlessly attack the database pipeline, simulation architecture, and chronological logic, identify a vulnerability, and deploy a fix.",
            "acceptanceCriteria": [
                "Identify exactly one vulnerability, unhandled edge case, or fragility in the pipeline.",
                "Implement a robust, deterministic fix for the identified issue.",
                "Typecheck passes",
                "Tests pass",
            ],
            "priority": i,
            "passes": False,
            "notes": "",
        }
    )

prd = {
    "project": "Pixelated",
    "branchName": "ralph/extended-audit-loop",
    "description": "Execute a 30-round adversarial auditing loop utilizing autonomous LLM red-teams (Pied Piper, Man In Black, and Chaos Monkey) to relentlessly attack and harden the database pipeline, simulation architecture, and chronological logic.",
    "userStories": stories,
}

with open("audit-prd.json", "w") as f:
    json.dump(prd, f, indent=2)

print("Created audit-prd.json with 30 rounds.")
