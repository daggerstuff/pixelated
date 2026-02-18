#!/usr/bin/env python3
"""
Validate Taxonomy Classifier Accuracy

This script validates the taxonomy classifier on a sample of records to ensure
>95% accuracy before processing all 67 'Other' files.

Strategy:
1. Sample 200 records from diverse 'Other' files
2. Manual review and labeling of ground truth
3. Compare classifier output vs. ground truth
4. Calculate accuracy, precision, recall per category
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple
from collections import Counter, defaultdict
import random

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.taxonomy_classifier import TaxonomyClassifier, TherapeuticCategory

logger = logging.getLogger(__name__)


class TaxonomyValidation:
    """Validate taxonomy classifier accuracy."""
    
    def __init__(self, sample_size: int = 200):
        """
        Initialize validation.
        
        Args:
            sample_size: Number of records to sample for validation
        """
        self.sample_size = sample_size
        self.classifier = TaxonomyClassifier()
        self.ground_truth = {}  # record_id -> category
        self.predictions = {}   # record_id -> (category, confidence)
    
    def sample_records_from_local(
        self,
        data_dir: Path,
        output_file: Path
    ) -> List[Dict[str, Any]]:
        """
        Sample records from local processed files for validation.
        
        Args:
            data_dir: Directory containing processed JSONL files
            output_file: Where to save sampled records
            
        Returns:
            List of sampled records
        """
        logger.info(f"Sampling {self.sample_size} records from {data_dir}")
        
        # Find all JSONL files
        jsonl_files = list(data_dir.glob("**/*.jsonl"))
        
        if not jsonl_files:
            logger.error(f"No JSONL files found in {data_dir}")
            return []
        
        logger.info(f"Found {len(jsonl_files)} JSONL files")
        
        # Sample records evenly across files
        samples = []
        records_per_file = max(1, self.sample_size // len(jsonl_files))
        
        for jsonl_file in jsonl_files[:min(20, len(jsonl_files))]:  # Limit to 20 files
            try:
                with open(jsonl_file, 'r') as f:
                    lines = [line for line in f if line.strip()]
                    
                    if not lines:
                        continue
                    
                    # Sample from this file
                    sample_count = min(records_per_file, len(lines))
                    sampled_lines = random.sample(lines, sample_count)
                    
                    for line in sampled_lines:
                        try:
                            record = json.loads(line)
                            # Add source file info
                            record["_validation_source"] = str(jsonl_file.name)
                            samples.append(record)
                        except json.JSONDecodeError:
                            continue
                    
            except Exception as e:
                logger.warning(f"Failed to sample from {jsonl_file.name}: {e}")
                continue
            
            if len(samples) >= self.sample_size:
                break
        
        # Trim to exact sample size
        samples = samples[:self.sample_size]
        
        logger.info(f"Sampled {len(samples)} records")
        
        # Save samples
        output_file.parent.mkdir(exist_ok=True)
        with open(output_file, 'w') as f:
            for record in samples:
                f.write(json.dumps(record) + "\n")
        
        logger.info(f"💾 Saved samples to {output_file}")
        
        return samples
    
    def classify_samples(
        self,
        samples_file: Path
    ) -> Dict[str, Tuple[str, float]]:
        """
        Run classifier on sampled records.
        
        Args:
            samples_file: File containing sampled records
            
        Returns:
            Dict mapping record index to (category, confidence)
        """
        logger.info(f"Classifying samples from {samples_file}")
        
        predictions = {}
        
        with open(samples_file, 'r') as f:
            for i, line in enumerate(f):
                if not line.strip():
                    continue
                
                try:
                    record = json.loads(line)
                    classification = self.classifier.classify_record(record)
                    
                    predictions[str(i)] = (
                        classification.category.value,
                        classification.confidence,
                        classification.reasoning
                    )
                    
                except json.JSONDecodeError:
                    continue
        
        logger.info(f"Classified {len(predictions)} samples")
        
        return predictions
    
    def generate_annotation_template(
        self,
        samples_file: Path,
        predictions: Dict[str, Tuple[str, float]],
        output_file: Path
    ):
        """
        Generate a human-friendly annotation template.
        
        Args:
            samples_file: File containing sampled records
            predictions: Classifier predictions
            output_file: Where to save annotation template
        """
        logger.info("Generating annotation template")
        
        with open(samples_file, 'r') as infile, open(output_file, 'w') as outfile:
            outfile.write("# Taxonomy Classifier Validation\n\n")
            outfile.write("## Instructions\n")
            outfile.write("Review each conversation and verify the predicted category.\n")
            outfile.write("Change 'PREDICTED' to 'CORRECT' or the correct category name.\n\n")
            outfile.write("## Categories\n")
            outfile.write("1. therapeutic_conversation - Standard therapy sessions\n")
            outfile.write("2. crisis_support - Active crisis intervention\n")
            outfile.write("3. mental_health_support - General mental health guidance\n")
            outfile.write("4. trauma_processing - PTSD, abuse, trauma-focused therapy\n")
            outfile.write("5. relationship_therapy - Couples, family, interpersonal issues\n")
            outfile.write("6. clinical_assessment - Diagnosis, evaluation, intake\n\n")
            outfile.write("="*80 + "\n\n")
            
            for i, line in enumerate(infile):
                if not line.strip():
                    continue
                
                try:
                    record = json.loads(line)
                    pred_cat, confidence, reasoning = predictions.get(str(i), ("unknown", 0.0, ""))
                    
                    outfile.write(f"## Record {i}\n\n")
                    outfile.write(f"**Predicted Category:** {pred_cat} (confidence: {confidence:.2f})\n")
                    outfile.write(f"**Reasoning:** {reasoning}\n\n")
                    outfile.write(f"**Conversation:**\n```\n")
                    
                    # Show first 3 messages
                    messages = record.get("messages", [])[:3]
                    for msg in messages:
                        role = msg.get("role", "unknown")
                        content = msg.get("content", "")[:200]  # Limit length
                        outfile.write(f"{role}: {content}\n")
                    
                    if len(record.get("messages", [])) > 3:
                        outfile.write(f"... ({len(record.get('messages', []))} total messages)\n")
                    
                    outfile.write("```\n\n")
                    outfile.write(f"**Ground Truth Category:** PREDICTED  <!-- Change to CORRECT or actual category -->\n\n")
                    outfile.write("="*80 + "\n\n")
                    
                except json.JSONDecodeError:
                    continue
        
        logger.info(f"💾 Saved annotation template to {output_file}")
        print(f"\n📝 NEXT STEP: Review and annotate {output_file}")
        print(f"   Change 'PREDICTED' to either 'CORRECT' or the actual category name")
    
    def calculate_accuracy(
        self,
        annotated_file: Path
    ) -> Dict[str, Any]:
        """
        Calculate accuracy from annotated file.
        
        Args:
            annotated_file: File with ground truth annotations
            
        Returns:
            Accuracy metrics
        """
        logger.info(f"Calculating accuracy from {annotated_file}")
        
        # Parse annotations
        ground_truth = {}
        predicted = {}
        
        with open(annotated_file, 'r') as f:
            content = f.read()
            
            # Extract ground truth labels
            import re
            
            pattern = r'## Record (\d+).*?Predicted Category:\*\* ([\w_]+).*?Ground Truth Category:\*\* (\w+)'
            matches = re.findall(pattern, content, re.DOTALL)
            
            for record_id, pred_cat, gt_label in matches:
                if gt_label == "PREDICTED":
                    continue  # Not annotated yet
                
                ground_truth[record_id] = pred_cat if gt_label == "CORRECT" else gt_label
                predicted[record_id] = pred_cat
        
        if not ground_truth:
            logger.error("No ground truth annotations found!")
            return {}
        
        # Calculate metrics
        total = len(ground_truth)
        correct = sum(1 for rid in ground_truth if ground_truth[rid] == predicted[rid])
        accuracy = correct / total if total > 0 else 0.0
        
        # Per-category metrics
        category_stats = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
        
        for record_id in ground_truth:
            gt_cat = ground_truth[record_id]
            pred_cat = predicted[record_id]
            
            if gt_cat == pred_cat:
                category_stats[gt_cat]["tp"] += 1
            else:
                category_stats[gt_cat]["fn"] += 1
                category_stats[pred_cat]["fp"] += 1
        
        # Calculate precision, recall, F1
        metrics = {
            "overall_accuracy": accuracy,
            "total_samples": total,
            "correct": correct,
            "incorrect": total - correct,
            "categories": {}
        }
        
        for cat in category_stats:
            tp = category_stats[cat]["tp"]
            fp = category_stats[cat]["fp"]
            fn = category_stats[cat]["fn"]
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
            
            metrics["categories"][cat] = {
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "support": tp + fn
            }
        
        return metrics


def main():
    """Run validation workflow."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate taxonomy classifier")
    parser.add_argument("--data-dir", type=Path, 
                       default=Path("ai/training/ready_packages/datasets/cache"),
                       help="Directory with processed JSONL files")
    parser.add_argument("--sample-size", type=int, default=200,
                       help="Number of samples for validation")
    parser.add_argument("--samples-file", type=Path,
                       default=Path("metrics/taxonomy_validation_samples.jsonl"),
                       help="Output file for samples")
    parser.add_argument("--annotation-file", type=Path,
                       default=Path("metrics/taxonomy_validation_annotations.md"),
                       help="Output file for annotations")
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    validator = TaxonomyValidation(sample_size=args.sample_size)
    
    # Step 1: Sample records
    print("\n" + "="*80)
    print("📊 STEP 1: Sampling Records")
    print("="*80)
    samples = validator.sample_records_from_local(args.data_dir, args.samples_file)
    
    if not samples:
        print("❌ No samples found!")
        return
    
    # Step 2: Classify samples
    print("\n" + "="*80)
    print("🤖 STEP 2: Classifying Samples")
    print("="*80)
    predictions = validator.classify_samples(args.samples_file)
    
    # Step 3: Generate annotation template
    print("\n" + "="*80)
    print("📝 STEP 3: Generating Annotation Template")
    print("="*80)
    validator.generate_annotation_template(args.samples_file, predictions, args.annotation_file)
    
    print("\n" + "="*80)
    print("✅ VALIDATION SETUP COMPLETE")
    print("="*80)
    print(f"\n📝 Next steps:")
    print(f"   1. Review {args.annotation_file}")
    print(f"   2. Change 'PREDICTED' to 'CORRECT' or actual category")
    print(f"   3. Run with --calculate-accuracy to get metrics")
    print(f"\n🎯 Target: >95% accuracy before processing all files")


if __name__ == "__main__":
    main()
