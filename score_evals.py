import json
import os
import sys

# Add ai directory to path
sys.path.append(os.path.join(os.getcwd(), "ai"))

from training.clinical_validity_scorer import ClinicalValidityScorer

with open("ai/lab/evals/evaluation_results_v5.json") as f:
    evals = json.load(f)

for item in evals[:10]:
    score = ClinicalValidityScorer.score(item["response"])
    detail = ClinicalValidityScorer.score_detail(item["response"])
    print(f"ID: {item['id']}, Score: {score:.4f}")
    print(f"Detail: {detail}")
    print("-" * 20)
