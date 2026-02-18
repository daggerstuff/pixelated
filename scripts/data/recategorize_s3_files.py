#!/usr/bin/env python3
"""
Re-categorize S3 'Other' Files Using Taxonomy Classifier

This script processes the 67 'Other' labeled files (132,801 records) from
s3://pixel-data/processed_ready/ and re-categorizes them using the taxonomy
classifier into 6 therapeutic categories.

Output: s3://pixel-data/categorized/
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List
from collections import Counter
from datetime import datetime

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.taxonomy_classifier import TherapeuticCategory
from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
from ai.data.loaders.s3_dataset_loader import S3DatasetLoader

logger = logging.getLogger(__name__)


class S3Recategorizer:
    """
    Re-categorize S3 files using the taxonomy classifier.
    
    Processes files from s3://pixel-data/processed_ready/ that are labeled 'Other'
    and writes categorized versions to s3://pixel-data/categorized/
    """
    
    def __init__(
        self,
        input_bucket: str = "pixel-data",
        input_prefix: str = "processed_ready/",
        output_bucket: str = "pixel-data",
        output_prefix: str = "categorized/",
        confidence_threshold: float = 0.70
    ):
        """
        Initialize the recategorizer.
        
        Args:
            input_bucket: S3 bucket for input files
            input_prefix: S3 prefix for input files
            output_bucket: S3 bucket for output files
            output_prefix: S3 prefix for output files
            confidence_threshold: Minimum confidence for classification
        """
        self.input_bucket = input_bucket
        self.input_prefix = input_prefix
        self.output_bucket = output_bucket
        self.output_prefix = output_prefix
        self.confidence_threshold = confidence_threshold
        
        self.s3_loader = S3DatasetLoader()
        self.classifier = HybridTaxonomyClassifier(enable_llm=True, confidence_threshold=0.80)
        
        logger.info(f"Initialized recategorizer with hybrid classifier: {input_bucket}/{input_prefix} -> {output_bucket}/{output_prefix}")
        logger.info(f"Using NVIDIA NIM GLM4.7 for low-confidence cases (threshold: 0.80)")
    
    def list_other_files(self) -> List[str]:
        """
        List all files labeled as 'Other' in the S3 bucket.
        
        Returns:
            List of S3 keys for 'Other' files
        """
        logger.info(f"Listing files in s3://{self.input_bucket}/{self.input_prefix}")
        
        # For now, return a sample - in production, use boto3 to list all files
        # and filter by metadata or filename pattern
        import boto3
        
        s3 = boto3.client('s3')
        
        try:
            response = s3.list_objects_v2(
                Bucket=self.input_bucket,
                Prefix=self.input_prefix
            )
            
            all_files = [obj['Key'] for obj in response.get('Contents', [])]
            
            # Filter for JSONL files
            jsonl_files = [f for f in all_files if f.endswith('.jsonl')]
            
            logger.info(f"Found {len(jsonl_files)} JSONL files")
            
            # TODO: Filter by 'Other' category metadata
            # For now, return all files - categorization will update them
            return jsonl_files
            
        except Exception as e:
            logger.error(f"Failed to list S3 files: {e}")
            return []
    
    def process_file_streaming(
        self,
        s3_key: str,
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """
        Process a single S3 file in streaming mode (S3 -> classify -> S3).
        
        Args:
            s3_key: S3 key for input file
            batch_size: Records to process before writing to S3
            
        Returns:
            Statistics for this file
        """
        logger.info(f"Processing: {s3_key}")
        
        stats = {
            "file": s3_key,
            "total_records": 0,
            "classified": 0,
            "low_confidence": 0,
            "categories": {cat.value: 0 for cat in TherapeuticCategory},
            "avg_confidence": 0.0
        }
        
        import boto3
        
        s3 = boto3.client('s3')
        
        # Output key
        filename = Path(s3_key).name
        output_key = f"{self.output_prefix}{filename}"
        
        total_confidence = 0.0
        records_buffer = []
        
        try:
            # Stream input from S3
            response = s3.get_object(Bucket=self.input_bucket, Key=s3_key)
            
            for line in response['Body'].iter_lines():
                if not line:
                    continue
                
                try:
                    record = json.loads(line)
                    stats["total_records"] += 1
                    
                    # Classify using hybrid classifier (keyword + LLM fallback)
                    # Extract text from record (handle various formats)
                    text = ""
                    if "text" in record:
                        text = record["text"]
                    elif "messages" in record:
                        text = " ".join([msg.get("content", "") for msg in record["messages"]])
                    elif "conversation" in record:
                        text = " ".join([turn.get("content", "") for turn in record["conversation"]])
                    
                    classification = self.classifier.classify(text)
                    total_confidence += classification.confidence
                    
                    # Update record with classification
                    if "metadata" not in record:
                        record["metadata"] = {}
                    
                    if classification.confidence >= self.confidence_threshold:
                        record["metadata"]["category"] = classification.category.value
                        record["metadata"]["category_confidence"] = classification.confidence
                        record["metadata"]["category_reasoning"] = classification.reasoning
                        record["metadata"]["recategorized_at"] = datetime.utcnow().isoformat()
                        stats["classified"] += 1
                        stats["categories"][classification.category.value] += 1
                    else:
                        stats["low_confidence"] += 1
                        record["metadata"]["category"] = "uncategorized"
                        record["metadata"]["category_confidence"] = classification.confidence
                    
                    # Add to buffer
                    records_buffer.append(json.dumps(record))
                    
                    # Write batch to S3
                    if len(records_buffer) >= batch_size:
                        self._write_batch_to_s3(output_key, records_buffer, append=True)
                        records_buffer = []
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in {s3_key}")
                    continue
            
            # Write remaining records
            if records_buffer:
                self._write_batch_to_s3(output_key, records_buffer, append=True)
            
            if stats["total_records"] > 0:
                stats["avg_confidence"] = total_confidence / stats["total_records"]
            
            logger.info(f"✅ {filename}: {stats['classified']}/{stats['total_records']} "
                       f"(avg confidence: {stats['avg_confidence']:.2f})")
            
        except Exception as e:
            logger.error(f"Failed to process {s3_key}: {e}")
            stats["error"] = str(e)
        
        return stats
    
    def _write_batch_to_s3(
        self,
        s3_key: str,
        records: List[str],
        append: bool = False
    ):
        """
        Write a batch of records to S3.
        
        Args:
            s3_key: S3 key for output file
            records: List of JSON strings
            append: Whether to append to existing file
        """
        import boto3
        
        s3 = boto3.client('s3')
        
        content = "\n".join(records) + "\n"
        
        if append:
            # TODO: Implement proper append logic (read existing, concatenate, write)
            # For now, this is simplified
            pass
        
        s3.put_object(
            Bucket=self.output_bucket,
            Key=s3_key,
            Body=content.encode('utf-8'),
            ContentType='application/x-ndjson'
        )
    
    def process_all_files(self, limit: int = None) -> Dict[str, Any]:
        """
        Process all 'Other' files and generate aggregate statistics.
        
        Args:
            limit: Maximum number of files to process (for testing)
            
        Returns:
            Aggregate statistics
        """
        other_files = self.list_other_files()
        
        if limit:
            other_files = other_files[:limit]
        
        logger.info(f"Processing {len(other_files)} files")
        
        aggregate_stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_files": len(other_files),
            "total_records": 0,
            "total_classified": 0,
            "total_low_confidence": 0,
            "categories": {cat.value: 0 for cat in TherapeuticCategory},
            "avg_confidence": 0.0,
            "file_stats": []
        }
        
        total_confidence = 0.0
        
        for i, s3_key in enumerate(other_files, 1):
            logger.info(f"\n[{i}/{len(other_files)}] Processing: {s3_key}")
            
            file_stats = self.process_file_streaming(s3_key)
            
            # Aggregate
            aggregate_stats["total_records"] += file_stats["total_records"]
            aggregate_stats["total_classified"] += file_stats["classified"]
            aggregate_stats["total_low_confidence"] += file_stats["low_confidence"]
            
            for cat, count in file_stats["categories"].items():
                aggregate_stats["categories"][cat] += count
            
            if file_stats["total_records"] > 0:
                total_confidence += file_stats["avg_confidence"] * file_stats["total_records"]
            
            aggregate_stats["file_stats"].append(file_stats)
        
        if aggregate_stats["total_records"] > 0:
            aggregate_stats["avg_confidence"] = total_confidence / aggregate_stats["total_records"]
        
        return aggregate_stats


def main():
    """Run the recategorization process."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Re-categorize S3 'Other' files")
    parser.add_argument("--limit", type=int, help="Limit number of files (for testing)")
    parser.add_argument("--threshold", type=float, default=0.70,
                       help="Confidence threshold (default: 0.70)")
    parser.add_argument("--output-stats", type=Path, 
                       default=Path("metrics/recategorization_stats.json"),
                       help="Output statistics file")
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    recategorizer = S3Recategorizer(confidence_threshold=args.threshold)
    stats = recategorizer.process_all_files(limit=args.limit)
    
    # Print summary
    print("\n" + "="*80)
    print("📊 RECATEGORIZATION SUMMARY")
    print("="*80)
    print(f"Files processed: {stats['total_files']}")
    print(f"Total records: {stats['total_records']:,}")
    print(f"Classified: {stats['total_classified']:,}")
    print(f"Low confidence: {stats['total_low_confidence']:,}")
    print(f"Avg confidence: {stats['avg_confidence']:.2%}")
    print("\nCategories:")
    for cat, count in sorted(stats['categories'].items(), key=lambda x: -x[1]):
        pct = (count / stats['total_records'] * 100) if stats['total_records'] > 0 else 0
        print(f"  • {cat}: {count:,} ({pct:.1f}%)")
    
    # Save statistics
    args.output_stats.parent.mkdir(exist_ok=True)
    with open(args.output_stats, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\n💾 Saved statistics: {args.output_stats}")


if __name__ == "__main__":
    main()
