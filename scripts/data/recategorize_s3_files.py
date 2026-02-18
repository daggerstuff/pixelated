#!/usr/bin/env python3
"""
Re-categorize S3 'Other' Files Using Hybrid Taxonomy Classifier

Processes files from OVHAI S3 bucket and re-categorizes them using the
Phase 2 hybrid taxonomy classifier (keyword + LLM fallback).

Usage:
    uv run scripts/data/recategorize_s3_files.py --limit 5
    uv run scripts/data/recategorize_s3_files.py --output-dir metrics/
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from collections import Counter
from datetime import datetime
from dataclasses import dataclass, field

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.taxonomy_classifier import TherapeuticCategory
from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
from ai.infrastructure.s3.s3_dataset_loader import S3DatasetLoader, S3Config

logger = logging.getLogger(__name__)


@dataclass
class RecategorizationStats:
    """Statistics for recategorization process."""
    total_files: int = 0
    total_records: int = 0
    classified_records: int = 0
    low_confidence_records: int = 0
    category_counts: Dict[str, int] = field(default_factory=dict)
    avg_confidence: float = 0.0
    start_time: str = ""
    end_time: str = ""
    duration_seconds: float = 0.0


class S3Recategorizer:
    """
    Re-categorize S3 files using the hybrid taxonomy classifier.
    
    Uses Phase 2 hybrid classifier: keyword-based (fast) with LLM fallback (accurate).
    """
    
    def __init__(
        self,
        output_dir: Path = Path("metrics"),
        confidence_threshold: float = 0.70
    ):
        """
        Initialize the recategorizer.
        
        Args:
            output_dir: Directory for output statistics
            confidence_threshold: Minimum confidence for classification
        """
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.confidence_threshold = confidence_threshold
        
        # Initialize S3 loader with OVHAI configuration
        s3_config = S3Config(
            endpoint_url=os.getenv("OVH_S3_ENDPOINT"),
            bucket_name="pixel-data",
            access_key_id=os.getenv("OVH_S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID"),
            secret_access_key=os.getenv("OVH_S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("OVH_S3_REGION", "us-east-va"),
        )
        self.s3_loader = S3DatasetLoader(s3_config)
        
        # Initialize hybrid classifier
        self.classifier = HybridTaxonomyClassifier(
            enable_llm=True,
            keyword_confidence_threshold=0.80,
            final_confidence_threshold=self.confidence_threshold
        )
        
        logger.info("Initialized S3 Recategorizer")
        logger.info(f"S3 Endpoint: {s3_config.endpoint_url}")
        logger.info(f"S3 Bucket: {s3_config.bucket_name}")
        logger.info(f"Using NVIDIA NIM GLM4.7 for low-confidence cases")
    
    def list_files_to_recategorize(
        self,
        prefix: str = "processed_ready/",
        limit: Optional[int] = None
    ) -> List[str]:
        """
        List files that need recategorization.
        
        Args:
            prefix: S3 prefix to list files from
            limit: Maximum number of files to return
            
        Returns:
            List of S3 keys
        """
        logger.info(f"Listing files in s3://pixel-data/{prefix}")
        
        try:
            all_keys = self.s3_loader.list_objects(prefix=prefix)
            jsonl_files = [k for k in all_keys if k.endswith('.jsonl')]
            
            if limit:
                jsonl_files = jsonl_files[:limit]
            
            logger.info(f"Found {len(jsonl_files)} JSONL files to process")
            return jsonl_files
            
        except Exception as e:
            logger.error(f"Failed to list S3 files: {e}")
            return []
    
    def extract_text_from_record(self, record: Dict[str, Any]) -> str:
        """
        Extract text content from a record in various formats.
        
        Args:
            record: Dataset record
            
        Returns:
            Extracted text content
        """
        if "text" in record:
            return record["text"]
        elif "messages" in record and isinstance(record["messages"], list):
            texts = []
            for msg in record["messages"]:
                if isinstance(msg, dict) and "content" in msg:
                    texts.append(msg["content"])
            return " ".join(texts)
        elif "conversation" in record and isinstance(record["conversation"], list):
            texts = []
            for turn in record["conversation"]:
                if isinstance(turn, dict) and "content" in turn:
                    texts.append(turn["content"])
            return " ".join(texts)
        else:
            # Fallback: try to find any text field
            for key in ["input", "prompt", "query", "question"]:
                if key in record and isinstance(record[key], str):
                    return record[key]
            return ""
    
    def process_file(
        self,
        s3_key: str,
        output_prefix: str = "categorized/"
    ) -> Dict[str, Any]:
        """
        Process a single S3 file and recategorize its records.
        
        Args:
            s3_key: S3 key for input file
            output_prefix: S3 prefix for output files
            
        Returns:
            File processing statistics
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
        
        try:
            # Load file from S3
            records = self.s3_loader.load_jsonl(s3_key)
            stats["total_records"] = len(records)
            
            total_confidence = 0.0
            processed_records = []
            
            for record in records:
                # Extract text
                text = self.extract_text_from_record(record)
                
                if not text:
                    logger.warning(f"No text found in record: {record.keys()}")
                    processed_records.append(record)
                    continue
                
                # Classify using hybrid classifier
                classification = self.classifier.classify(text)
                total_confidence += classification.confidence
                
                # Update record metadata
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
                    record["metadata"]["category"] = "uncategorized"
                    record["metadata"]["category_confidence"] = classification.confidence
                    stats["low_confidence"] += 1
                
                processed_records.append(record)
            
            # Calculate average confidence
            if stats["total_records"] > 0:
                stats["avg_confidence"] = total_confidence / stats["total_records"]
            
            # Save to S3
            filename = Path(s3_key).name
            output_key = f"{output_prefix}{filename}"
            self.s3_loader.save_jsonl(output_key, processed_records)
            
            logger.info(f"✅ {filename}: {stats['classified']}/{stats['total_records']} "
                       f"(avg confidence: {stats['avg_confidence']:.2%})")
            
        except Exception as e:
            logger.error(f"Failed to process {s3_key}: {e}")
            stats["error"] = str(e)
        
        return stats
    
    def process_all_files(
        self,
        input_prefix: str = "processed_ready/",
        output_prefix: str = "categorized/",
        limit: Optional[int] = None
    ) -> RecategorizationStats:
        """
        Process all files and generate aggregate statistics.
        
        Args:
            input_prefix: S3 prefix for input files
            output_prefix: S3 prefix for output files
            limit: Maximum number of files to process
            
        Returns:
            Aggregate statistics
        """
        start_time = datetime.utcnow()
        
        # List files
        files_to_process = self.list_files_to_recategorize(
            prefix=input_prefix,
            limit=limit
        )
        
        logger.info(f"Processing {len(files_to_process)} files")
        
        # Initialize stats
        stats = RecategorizationStats(
            start_time=start_time.isoformat(),
            total_files=len(files_to_process),
            category_counts={cat.value: 0 for cat in TherapeuticCategory}
        )
        
        total_confidence = 0.0
        file_stats_list = []
        
        # Process each file
        for i, s3_key in enumerate(files_to_process, 1):
            logger.info(f"\n[{i}/{len(files_to_process)}] Processing: {s3_key}")
            
            file_stats = self.process_file(s3_key, output_prefix=output_prefix)
            
            # Aggregate
            stats.total_records += file_stats["total_records"]
            stats.classified_records += file_stats["classified"]
            stats.low_confidence_records += file_stats["low_confidence"]
            
            for cat, count in file_stats["categories"].items():
                stats.category_counts[cat] = stats.category_counts.get(cat, 0) + count
            
            if file_stats["total_records"] > 0:
                total_confidence += file_stats["avg_confidence"] * file_stats["total_records"]
            
            file_stats_list.append(file_stats)
        
        # Finalize stats
        end_time = datetime.utcnow()
        stats.end_time = end_time.isoformat()
        stats.duration_seconds = (end_time - start_time).total_seconds()
        
        if stats.total_records > 0:
            stats.avg_confidence = total_confidence / stats.total_records
        
        # Save detailed stats
        output_file = self.output_dir / "recategorization_stats.json"
        with open(output_file, 'w') as f:
            json.dump({
                "summary": stats.__dict__,
                "file_details": file_stats_list
            }, f, indent=2)
        
        logger.info(f"💾 Saved statistics: {output_file}")
        
        return stats


def main():
    """Run the recategorization process."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Re-categorize S3 'Other' files using hybrid classifier")
    parser.add_argument("--limit", type=int, help="Limit number of files (for testing)")
    parser.add_argument("--threshold", type=float, default=0.70,
                       help="Confidence threshold (default: 0.70)")
    parser.add_argument("--output-dir", type=Path, default=Path("metrics"),
                       help="Output directory for statistics")
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    recategorizer = S3Recategorizer(
        output_dir=args.output_dir,
        confidence_threshold=args.threshold
    )
    stats = recategorizer.process_all_files(limit=args.limit)
    
    # Print summary
    print("\n" + "="*80)
    print("📊 RECATEGORIZATION SUMMARY")
    print("="*80)
    print(f"Files processed: {stats.total_files}")
    print(f"Total records: {stats.total_records:,}")
    print(f"Classified: {stats.classified_records:,}")
    print(f"Low confidence: {stats.low_confidence_records:,}")
    print(f"Avg confidence: {stats.avg_confidence:.2%}")
    print(f"Duration: {stats.duration_seconds:.1f}s")
    print("\nCategories:")
    for cat, count in sorted(stats.category_counts.items(), key=lambda x: -x[1]):
        pct = (count / stats.total_records * 100) if stats.total_records > 0 else 0
        print(f"  • {cat}: {count:,} ({pct:.1f}%)")
    print("="*80)


if __name__ == "__main__":
    main()
