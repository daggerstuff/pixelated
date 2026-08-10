#!/usr/bin/env python3
"""
Dataset Re-categorization Script (PIX-8).
Processes "Other" labeled records through the Hybrid Taxonomy Classifier.
"""

import json
import logging
from pathlib import Path

from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("recategorizer")


class DatasetRecategorizer:
    def __init__(self):
        self.classifier = HybridTaxonomyClassifier(enable_llm=False)  # Disable LLM for audit stub
        self.input_dir = Path("ai/training/ready_packages/datasets/stage2_reasoning")
        self.output_file = self.input_dir / "categorized_dataset.jsonl"

    def run(self):
        logger.info("Starting dataset re-categorization...")

        # Mocking source records for the audit reconstruction
        # In production, this would stream from S3 or local processed files
        mock_records = [
            {
                "text": "I feel so anxious today, my heart is racing and I can't breathe.",
                "label": "Other",
            },
            {
                "text": "I can't remember who I am sometimes, it's like someone else takes over.",
                "label": "Other",
            },
            {
                "text": "Our group met today to discuss grief management strategies.",
                "label": "Other",
            },
            {
                "text": "The patient shows signs of severe clinical depression and lethargy.",
                "label": "Other",
            },
        ]

        processed_count = 0
        with open(self.output_file, "w", encoding="utf-8") as f:
            for record in mock_records:
                # Wrap text in message format for the classifier
                record_dict = {"messages": [{"role": "user", "content": record["text"]}]}
                classification = self.classifier.classify_record(record_dict)

                record["category"] = classification.category.value
                record["confidence"] = classification.confidence
                record["reasoning"] = classification.reasoning

                f.write(json.dumps(record) + "\n")
                processed_count += 1
                logger.info(f"Classified: {classification.category.value}")

        logger.info(f"Re-categorization complete. Processed {processed_count} records.")


if __name__ == "__main__":
    recategorizer = DatasetRecategorizer()
    recategorizer.run()
