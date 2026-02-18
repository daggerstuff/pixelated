#!/usr/bin/env python3
"""
Generate Edge Cases for PIX-8 Dataset Enhancement

Generates 75K edge cases including 25K 'Nightmare Fuel' extreme scenarios
using NeMo Data Designer's EdgeCaseGenerator.

Target breakdown:
- 25K Nightmare Fuel (extreme scenarios)
- 50K Standard edge cases (crisis, cultural complexity, comorbidity, etc.)

Output: s3://pixel-data/edge_cases/pix8/
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from collections import Counter

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.edge_case_generator import EdgeCaseGenerator, EdgeCaseType

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PIX8EdgeCaseGenerator:
    """Generate edge cases for PIX-8 dataset enhancement."""
    
    def __init__(self, output_dir: Path = None):
        """
        Initialize the edge case generator.
        
        Args:
            output_dir: Local output directory for generated edge cases
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/generated/pix8_edge_cases")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.generator = EdgeCaseGenerator()
        
        logger.info(f"Initialized PIX-8 edge case generator")
        logger.info(f"Output directory: {self.output_dir}")
    
    def generate_nightmare_fuel(self, num_samples: int = 25000) -> Dict[str, Any]:
        """
        Generate 'Nightmare Fuel' extreme edge cases.
        
        These are the most challenging therapeutic scenarios:
        - Severe crisis situations
        - Complex trauma disclosures
        - Ethical dilemmas with no clear answer
        - Boundary violations
        
        Args:
            num_samples: Number of nightmare fuel scenarios (default: 25K)
            
        Returns:
            Statistics and metadata
        """
        logger.info(f"Generating {num_samples:,} Nightmare Fuel scenarios...")
        
        # Nightmare Fuel distribution
        nightmare_types = [
            (EdgeCaseType.CRISIS, 8000),
            (EdgeCaseType.TRAUMA_DISCLOSURE, 7000),
            (EdgeCaseType.ETHICAL_DILEMMA, 5000),
            (EdgeCaseType.BOUNDARY_VIOLATION, 5000),
        ]
        
        all_records = []
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "category": "nightmare_fuel",
            "total_generated": 0,
            "by_type": {}
        }
        
        for edge_type, count in nightmare_types:
            logger.info(f"  Generating {count:,} {edge_type.value} scenarios (extreme difficulty)...")
            
            result = self.generator.generate_edge_case_dataset(
                edge_case_type=edge_type,
                num_samples=count,
                difficulty_level="extreme"
            )
            
            if result and "data" in result:
                records = result["data"]
                
                # Tag as nightmare fuel
                for record in records:
                    if "metadata" not in record:
                        record["metadata"] = {}
                    record["metadata"]["nightmare_fuel"] = True
                    record["metadata"]["difficulty"] = "extreme"
                    record["metadata"]["pix8_category"] = "nightmare_fuel"
                
                all_records.extend(records)
                stats["by_type"][edge_type.value] = len(records)
                stats["total_generated"] += len(records)
                
                logger.info(f"    ✅ Generated {len(records):,} {edge_type.value} scenarios")
            else:
                logger.warning(f"    ⚠️  Failed to generate {edge_type.value} scenarios")
        
        # Save nightmare fuel dataset
        output_file = self.output_dir / "nightmare_fuel.jsonl"
        with open(output_file, 'w') as f:
            for record in all_records:
                f.write(json.dumps(record) + '\n')
        
        logger.info(f"✅ Saved {len(all_records):,} Nightmare Fuel scenarios to {output_file}")
        
        return stats
    
    def generate_standard_edge_cases(self, num_samples: int = 50000) -> Dict[str, Any]:
        """
        Generate standard edge cases across various categories.
        
        Args:
            num_samples: Number of standard edge cases (default: 50K)
            
        Returns:
            Statistics and metadata
        """
        logger.info(f"Generating {num_samples:,} standard edge cases...")
        
        # Standard edge case distribution
        edge_case_distribution = [
            (EdgeCaseType.CULTURAL_COMPLEXITY, 10000),
            (EdgeCaseType.COMORBIDITY, 10000),
            (EdgeCaseType.SUBSTANCE_ABUSE, 10000),
            (EdgeCaseType.RARE_DIAGNOSIS, 8000),
            (EdgeCaseType.MULTI_GENERATIONAL, 7000),
            (EdgeCaseType.SYSTEMIC_OPPRESSION, 5000),
        ]
        
        all_records = []
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "category": "standard_edge_cases",
            "total_generated": 0,
            "by_type": {}
        }
        
        for edge_type, count in edge_case_distribution:
            logger.info(f"  Generating {count:,} {edge_type.value} scenarios...")
            
            result = self.generator.generate_edge_case_dataset(
                edge_case_type=edge_type,
                num_samples=count,
                difficulty_level="high"
            )
            
            if result and "data" in result:
                records = result["data"]
                
                # Tag as standard edge case
                for record in records:
                    if "metadata" not in record:
                        record["metadata"] = {}
                    record["metadata"]["nightmare_fuel"] = False
                    record["metadata"]["difficulty"] = "high"
                    record["metadata"]["pix8_category"] = "edge_case"
                
                all_records.extend(records)
                stats["by_type"][edge_type.value] = len(records)
                stats["total_generated"] += len(records)
                
                logger.info(f"    ✅ Generated {len(records):,} {edge_type.value} scenarios")
            else:
                logger.warning(f"    ⚠️  Failed to generate {edge_type.value} scenarios")
        
        # Save standard edge cases dataset
        output_file = self.output_dir / "standard_edge_cases.jsonl"
        with open(output_file, 'w') as f:
            for record in all_records:
                f.write(json.dumps(record) + '\n')
        
        logger.info(f"✅ Saved {len(all_records):,} standard edge cases to {output_file}")
        
        return stats
    
    def generate_all(self) -> Dict[str, Any]:
        """
        Generate all edge cases for PIX-8.
        
        Total: 75K edge cases
        - 25K Nightmare Fuel
        - 50K Standard edge cases
        
        Returns:
            Aggregate statistics
        """
        logger.info("="*80)
        logger.info("PIX-8 EDGE CASE GENERATION")
        logger.info("="*80)
        logger.info("Target: 75K total edge cases")
        logger.info("  - 25K Nightmare Fuel (extreme scenarios)")
        logger.info("  - 50K Standard edge cases")
        logger.info("="*80)
        
        # Generate nightmare fuel
        nightmare_stats = self.generate_nightmare_fuel(num_samples=25000)
        
        # Generate standard edge cases
        standard_stats = self.generate_standard_edge_cases(num_samples=50000)
        
        # Aggregate statistics
        aggregate_stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "pix8_task": "edge_case_generation",
            "target_total": 75000,
            "actual_total": nightmare_stats["total_generated"] + standard_stats["total_generated"],
            "nightmare_fuel": nightmare_stats,
            "standard_edge_cases": standard_stats
        }
        
        # Save aggregate statistics
        stats_file = self.output_dir / "pix8_edge_cases_stats.json"
        with open(stats_file, 'w') as f:
            json.dump(aggregate_stats, f, indent=2)
        
        logger.info("\n" + "="*80)
        logger.info("📊 PIX-8 EDGE CASE GENERATION SUMMARY")
        logger.info("="*80)
        logger.info(f"Total generated: {aggregate_stats['actual_total']:,} / {aggregate_stats['target_total']:,}")
        logger.info(f"Nightmare Fuel: {nightmare_stats['total_generated']:,}")
        logger.info(f"Standard Edge Cases: {standard_stats['total_generated']:,}")
        logger.info(f"\n💾 Statistics saved: {stats_file}")
        logger.info("="*80)
        
        return aggregate_stats


def main():
    """Run PIX-8 edge case generation."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate edge cases for PIX-8 dataset enhancement"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/training_ready/data/generated/pix8_edge_cases"),
        help="Output directory for generated edge cases"
    )
    parser.add_argument(
        "--nightmare-only",
        action="store_true",
        help="Generate only Nightmare Fuel scenarios"
    )
    parser.add_argument(
        "--standard-only",
        action="store_true",
        help="Generate only standard edge cases"
    )
    
    args = parser.parse_args()
    
    generator = PIX8EdgeCaseGenerator(output_dir=args.output_dir)
    
    if args.nightmare_only:
        stats = generator.generate_nightmare_fuel()
    elif args.standard_only:
        stats = generator.generate_standard_edge_cases()
    else:
        stats = generator.generate_all()
    
    logger.info("\n✅ PIX-8 edge case generation complete!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
