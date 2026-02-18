#!/usr/bin/env python3
"""
Generate Long-Running Therapy Sessions for PIX-8 Dataset Enhancement

Generates 200K long-running therapy sessions with minimum 20+ turns using:
1. Extraction from existing multi-turn datasets
2. NeMo Data Designer for synthetic session generation

Output: s3://pixel-data/long_sessions/pix8/
"""

import json
import logging
import sys
import subprocess
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from collections import Counter

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PIX8LongSessionGenerator:
    """Generate long-running therapy sessions for PIX-8 dataset enhancement."""
    
    def __init__(self, output_dir: Path = None, min_turns: int = 20):
        """
        Initialize the long session generator.
        
        Args:
            output_dir: Local output directory for generated sessions
            min_turns: Minimum number of turns to qualify as long-running
        """
        self.output_dir = output_dir or Path("ai/training_ready/data/generated/pix8_long_sessions")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.min_turns = min_turns
        self.extractor_script = Path(__file__).parent.parent / "ai/training/ready_packages/scripts/extract_long_running_therapy.py"
        
        logger.info(f"Initialized PIX-8 long session generator")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Minimum turns: {self.min_turns}")
    
    def extract_from_existing_datasets(self, target_count: int = 100000) -> Dict[str, Any]:
        """
        Extract long-running sessions from existing multi-turn datasets.
        
        Uses extract_long_running_therapy.py to scan S3 datasets for sessions
        with 20+ turns.
        
        Args:
            target_count: Target number of sessions to extract
            
        Returns:
            Statistics and metadata
        """
        logger.info(f"Extracting long-running sessions from existing datasets...")
        logger.info(f"Target: {target_count:,} sessions with ≥{self.min_turns} turns")
        
        output_file = self.output_dir / "extracted_long_sessions.jsonl"
        
        # Run extraction script
        cmd = [
            "python3",
            str(self.extractor_script),
            f"--min-turns={self.min_turns}",
            f"--output={output_file}",
            "--input-dir=s3://pixel-data/processed_ready/",
        ]
        
        logger.info(f"Running: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.info("Extraction complete!")
            logger.info(result.stdout)
            
            # Count extracted sessions
            extracted_count = 0
            if output_file.exists():
                with open(output_file, 'r') as f:
                    extracted_count = sum(1 for _ in f)
            
            stats = {
                "timestamp": datetime.utcnow().isoformat(),
                "method": "extraction",
                "source": "existing_datasets",
                "min_turns": self.min_turns,
                "extracted_count": extracted_count,
                "output_file": str(output_file)
            }
            
            logger.info(f"✅ Extracted {extracted_count:,} long-running sessions")
            
            return stats
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Extraction failed: {e}")
            logger.error(f"stdout: {e.stdout}")
            logger.error(f"stderr: {e.stderr}")
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "method": "extraction",
                "error": str(e),
                "extracted_count": 0
            }
    
    def generate_synthetic_sessions(self, target_count: int = 100000) -> Dict[str, Any]:
        """
        Generate synthetic long-running therapy sessions using NeMo Data Designer.
        
        Creates realistic multi-turn therapy conversations with:
        - Natural progression through therapeutic stages
        - Varied conversation lengths (20-50 turns)
        - Diverse therapeutic approaches
        
        Args:
            target_count: Target number of synthetic sessions
            
        Returns:
            Statistics and metadata
        """
        logger.info(f"Generating {target_count:,} synthetic long-running sessions...")
        
        # For now, this is a placeholder - NeMo Data Designer integration needed
        # In production, this would use NeMo's conversation generation capabilities
        
        output_file = self.output_dir / "synthetic_long_sessions.jsonl"
        
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": "synthetic_generation",
            "target_count": target_count,
            "generated_count": 0,
            "status": "not_implemented",
            "note": "NeMo Data Designer integration required for synthetic session generation"
        }
        
        logger.warning("⚠️  Synthetic session generation not yet implemented")
        logger.warning("    This requires NeMo Data Designer integration for conversation generation")
        
        return stats
    
    def generate_all(self, extraction_target: int = 100000, synthesis_target: int = 100000) -> Dict[str, Any]:
        """
        Generate all long-running sessions for PIX-8.
        
        Strategy:
        1. Extract 100K sessions from existing datasets
        2. Generate 100K synthetic sessions
        Total: 200K long-running sessions
        
        Args:
            extraction_target: Target for extraction
            synthesis_target: Target for synthesis
            
        Returns:
            Aggregate statistics
        """
        logger.info("="*80)
        logger.info("PIX-8 LONG-RUNNING SESSION GENERATION")
        logger.info("="*80)
        logger.info(f"Target: 200K total sessions (≥{self.min_turns} turns)")
        logger.info(f"  - {extraction_target:,} from extraction")
        logger.info(f"  - {synthesis_target:,} from synthesis")
        logger.info("="*80)
        
        # Extract from existing datasets
        extraction_stats = self.extract_from_existing_datasets(target_count=extraction_target)
        
        # Generate synthetic sessions
        synthesis_stats = self.generate_synthetic_sessions(target_count=synthesis_target)
        
        # Aggregate statistics
        total_generated = extraction_stats.get("extracted_count", 0) + synthesis_stats.get("generated_count", 0)
        
        aggregate_stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "pix8_task": "long_running_session_generation",
            "min_turns": self.min_turns,
            "target_total": extraction_target + synthesis_target,
            "actual_total": total_generated,
            "extraction": extraction_stats,
            "synthesis": synthesis_stats
        }
        
        # Save aggregate statistics
        stats_file = self.output_dir / "pix8_long_sessions_stats.json"
        with open(stats_file, 'w') as f:
            json.dump(aggregate_stats, f, indent=2)
        
        logger.info("\n" + "="*80)
        logger.info("📊 PIX-8 LONG SESSION GENERATION SUMMARY")
        logger.info("="*80)
        logger.info(f"Total generated: {total_generated:,} / {aggregate_stats['target_total']:,}")
        logger.info(f"Extracted: {extraction_stats.get('extracted_count', 0):,}")
        logger.info(f"Synthetic: {synthesis_stats.get('generated_count', 0):,}")
        logger.info(f"\n💾 Statistics saved: {stats_file}")
        
        if total_generated < aggregate_stats['target_total']:
            logger.warning(f"\n⚠️  Generated {total_generated:,} / {aggregate_stats['target_total']:,} sessions")
            logger.warning("    Consider additional data sources or synthetic generation")
        
        logger.info("="*80)
        
        return aggregate_stats


def main():
    """Run PIX-8 long-running session generation."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate long-running therapy sessions for PIX-8 dataset enhancement"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/training_ready/data/generated/pix8_long_sessions"),
        help="Output directory for generated sessions"
    )
    parser.add_argument(
        "--min-turns",
        type=int,
        default=20,
        help="Minimum number of turns to qualify as long-running (default: 20)"
    )
    parser.add_argument(
        "--extract-only",
        action="store_true",
        help="Only extract from existing datasets"
    )
    parser.add_argument(
        "--synthesis-only",
        action="store_true",
        help="Only generate synthetic sessions"
    )
    parser.add_argument(
        "--extraction-target",
        type=int,
        default=100000,
        help="Target number of extracted sessions (default: 100K)"
    )
    parser.add_argument(
        "--synthesis-target",
        type=int,
        default=100000,
        help="Target number of synthetic sessions (default: 100K)"
    )
    
    args = parser.parse_args()
    
    generator = PIX8LongSessionGenerator(
        output_dir=args.output_dir,
        min_turns=args.min_turns
    )
    
    if args.extract_only:
        stats = generator.extract_from_existing_datasets(target_count=args.extraction_target)
    elif args.synthesis_only:
        stats = generator.generate_synthetic_sessions(target_count=args.synthesis_target)
    else:
        stats = generator.generate_all(
            extraction_target=args.extraction_target,
            synthesis_target=args.synthesis_target
        )
    
    logger.info("\n✅ PIX-8 long session generation complete!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
