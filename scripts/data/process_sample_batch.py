#!/usr/bin/env python3
"""
Process Sample Batch - Test Hybrid Classifier on Real Data

This script processes a sample batch of conversations from the training dataset
using the hybrid classifier (keyword + NVIDIA NIM GLM4.7 LLM).
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
from collections import Counter

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
from ai.pipelines.design.taxonomy_classifier import TherapeuticCategory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


def load_jsonl_sample(file_path: str, sample_size: int = 100) -> List[Dict[str, Any]]:
    """Load a sample of records from a JSONL file."""
    records = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= sample_size:
                break
            try:
                record = json.loads(line.strip())
                records.append(record)
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping invalid JSON at line {i+1}: {e}")
    
    return records


def analyze_results(results: List[Any]) -> Dict[str, Any]:
    """Analyze classification results and generate statistics."""
    stats = {
        'total_records': len(results),
        'category_distribution': Counter(),
        'method_distribution': Counter(),
        'confidence_by_category': {},
        'low_confidence_count': 0,
        'high_confidence_count': 0,
    }
    
    for result in results:
        category = result.category.value
        stats['category_distribution'][category] += 1
        stats['method_distribution'][result.classification_method] += 1
        
        # Track confidence
        if category not in stats['confidence_by_category']:
            stats['confidence_by_category'][category] = []
        stats['confidence_by_category'][category].append(result.confidence)
        
        if result.confidence < 0.5:
            stats['low_confidence_count'] += 1
        elif result.confidence >= 0.8:
            stats['high_confidence_count'] += 1
    
    # Calculate average confidence per category
    for category in stats['confidence_by_category']:
        confidences = stats['confidence_by_category'][category]
        stats['confidence_by_category'][category] = {
            'avg': sum(confidences) / len(confidences),
            'min': min(confidences),
            'max': max(confidences),
            'count': len(confidences)
        }
    
    return stats


def print_results(stats: Dict[str, Any], processing_stats: Dict[str, Any]):
    """Print formatted results."""
    print("\n" + "="*80)
    print("📊 SAMPLE BATCH CLASSIFICATION RESULTS")
    print("="*80)
    
    print(f"\n📈 Processing Stats:")
    print(f"  Total Records: {stats['total_records']}")
    print(f"  Processing Time: {processing_stats['processing_time']:.2f}s")
    print(f"  Records/Second: {processing_stats['records_per_second']:.1f}")
    
    print(f"\n🎯 Classification Method Distribution:")
    for method, count in stats['method_distribution'].items():
        pct = count / stats['total_records'] * 100
        print(f"  {method:20s}: {count:4d} ({pct:5.1f}%)")
    
    print(f"\n📂 Category Distribution:")
    for category, count in stats['category_distribution'].most_common():
        pct = count / stats['total_records'] * 100
        conf_stats = stats['confidence_by_category'][category]
        print(f"  {category:30s}: {count:4d} ({pct:5.1f}%) - Avg Conf: {conf_stats['avg']:.1%}")
    
    print(f"\n💯 Confidence Distribution:")
    print(f"  High Confidence (≥80%): {stats['high_confidence_count']:4d} ({stats['high_confidence_count']/stats['total_records']*100:5.1f}%)")
    print(f"  Low Confidence (<50%):  {stats['low_confidence_count']:4d} ({stats['low_confidence_count']/stats['total_records']*100:5.1f}%)")
    
    if processing_stats.get('estimated_cost'):
        print(f"\n💰 Cost Estimation:")
        print(f"  LLM API Calls: {processing_stats['llm_api_calls']}")
        print(f"  Estimated Cost: ${processing_stats['estimated_cost']:.4f}")
        full_cost = processing_stats['estimated_cost'] * (132801 / stats['total_records'])
        print(f"  Full Dataset (132,801): ${full_cost:.2f}")
    
    print("\n" + "="*80)


def save_detailed_results(results: List[Any], output_path: str):
    """Save detailed results to JSON file."""
    detailed = []
    
    for i, result in enumerate(results):
        detailed.append({
            'record_id': i,
            'category': result.category.value,
            'confidence': result.confidence,
            'method': result.classification_method,
            'reasoning': result.reasoning,
            'keywords': result.keywords_detected
        })
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(detailed, f, indent=2)
    
    logger.info(f"💾 Detailed results saved to: {output_path}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Process sample batch with hybrid classifier")
    parser.add_argument("--input", type=str, 
                       default="ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl",
                       help="Input JSONL file")
    parser.add_argument("--sample-size", type=int, default=100,
                       help="Number of records to process (default: 100)")
    parser.add_argument("--use-llm", action="store_true",
                       help="Enable LLM for low-confidence cases")
    parser.add_argument("--output", type=str, default=None,
                       help="Output JSON file for detailed results")
    
    args = parser.parse_args()
    
    # Set API key from environment
    if args.use_llm:
        if not os.getenv("OPENAI_API_KEY"):
            logger.error("❌ OPENAI_API_KEY not set. Set it or run without --use-llm")
            return 1
    
    logger.info("🚀 Starting Sample Batch Processing")
    logger.info(f"📁 Input: {args.input}")
    logger.info(f"📊 Sample Size: {args.sample_size}")
    logger.info(f"🤖 LLM Enabled: {args.use_llm}")
    
    # Load sample data
    logger.info(f"📥 Loading {args.sample_size} records...")
    records = load_jsonl_sample(args.input, args.sample_size)
    
    if not records:
        logger.error("❌ No records loaded")
        return 1
    
    logger.info(f"✅ Loaded {len(records)} records")
    
    # Initialize classifier
    logger.info("🔧 Initializing hybrid classifier...")
    classifier = HybridTaxonomyClassifier(enable_llm=args.use_llm)
    
    # Process batch
    logger.info("⚙️  Processing batch...")
    start_time = datetime.now()
    
    results = []
    for i, record in enumerate(records):
        if (i + 1) % 10 == 0 or i == 0:
            logger.info(f"  Processing record {i+1}/{len(records)}...")
        result = classifier.classify_record(record)
        # Add classification method to result
        # Check if LLM was actually used (not just mentioned in reasoning about "no LLM")
        if args.use_llm and "LLM" in result.reasoning and "no LLM" not in result.reasoning:
            result.classification_method = "llm"
        else:
            result.classification_method = "keyword"
        results.append(result)
    
    end_time = datetime.now()
    processing_time = (end_time - start_time).total_seconds()
    
    # Calculate processing stats
    llm_count = sum(1 for r in results if r.classification_method == "llm")
    processing_stats = {
        'llm_api_calls': llm_count,
        'estimated_cost': llm_count * 1000 * 0.20 / 1_000_000 + llm_count * 100 * 0.20 / 1_000_000,
        'processing_time': processing_time,
        'records_per_second': len(records) / processing_time if processing_time > 0 else 0
    }
    
    # Analyze results
    stats = analyze_results(results)
    
    # Print results
    print_results(stats, processing_stats)
    
    # Save detailed results if requested
    if args.output:
        save_detailed_results(results, args.output)
    
    logger.info("✅ Processing complete!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
