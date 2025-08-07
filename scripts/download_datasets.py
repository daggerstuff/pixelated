#!/usr/bin/env python3
"""
External Dataset Download Script

Enterprise-grade script for downloading and validating external datasets
from HuggingFace and other sources with comprehensive error handling,
progress tracking, and integrity validation.

Usage:
    python scripts/download_datasets.py [--dataset DATASET_NAME] [--all]
    
Examples:
    python scripts/download_datasets.py --all
    python scripts/download_datasets.py --dataset mental_health_counseling
"""

import argparse
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.dataset_pipeline.config import config
from ai.dataset_pipeline.data_loader import DatasetLoader
from ai.dataset_pipeline.logger import create_logger
from ai.dataset_pipeline.utils import DatasetUtils


class DatasetDownloader:
    """Enterprise-grade dataset downloader with comprehensive monitoring."""
    
    def __init__(self):
        self.logger = create_logger("DatasetDownloader", Path("logs/downloads"))
        self.loader = DatasetLoader()
        self.download_stats = {
            "total_attempted": 0,
            "successful_downloads": 0,
            "failed_downloads": 0,
            "total_conversations": 0,
            "start_time": time.time()
        }
    
    def download_all_external_datasets(self) -> bool:
        """Download all external datasets from configuration."""
        self.logger.info("🚀 Starting download of all external datasets")
        self.logger.info(f"Total datasets to download: {len(config.external_datasets)}")
        
        success_count = 0
        
        for dataset_name, hf_path in config.external_datasets.items():
            self.download_stats["total_attempted"] += 1
            
            self.logger.info(f"📥 Downloading dataset: {dataset_name}")
            self.logger.info(f"   Source: {hf_path}")
            
            try:
                success = self.download_single_dataset(dataset_name, hf_path)
                if success:
                    success_count += 1
                    self.download_stats["successful_downloads"] += 1
                    self.logger.info(f"✅ Successfully downloaded: {dataset_name}")
                else:
                    self.download_stats["failed_downloads"] += 1
                    self.logger.error(f"❌ Failed to download: {dataset_name}")
                
            except Exception as e:
                self.download_stats["failed_downloads"] += 1
                self.logger.error(f"❌ Exception downloading {dataset_name}: {str(e)}")
        
        # Generate summary
        self._log_download_summary()
        
        return success_count == len(config.external_datasets)
    
    def download_single_dataset(self, dataset_name: str, hf_path: str) -> bool:
        """Download a single dataset with validation."""
        start_time = time.time()
        
        try:
            # Determine dataset tier based on name
            tier = self._determine_dataset_tier(dataset_name)
            
            # Download using the data loader
            success = self.loader.load_huggingface_dataset(
                dataset_name=dataset_name,
                hf_path=hf_path,
                tier=tier
            )
            
            if success:
                # Validate downloaded data
                if self._validate_downloaded_dataset(dataset_name):
                    # Save to cache/processed directory
                    self._save_processed_dataset(dataset_name)
                    
                    dataset_info = self.loader.datasets[dataset_name]
                    self.download_stats["total_conversations"] += dataset_info.actual_size
                    
                    duration = time.time() - start_time
                    self.logger.info(
                        f"Dataset {dataset_name} processed successfully",
                        size=dataset_info.actual_size,
                        duration_seconds=f"{duration:.2f}",
                        tier=tier.value
                    )
                    
                    return True
                else:
                    self.logger.error(f"Validation failed for {dataset_name}")
                    return False
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"Error downloading {dataset_name}: {str(e)}")
            return False
    
    def _determine_dataset_tier(self, dataset_name: str) -> Any:
        """Determine dataset tier based on name and characteristics."""
        from ai.dataset_pipeline.config import DatasetTier
        
        # Priority datasets (highest quality)
        if any(keyword in dataset_name.lower() for keyword in ["priority", "curated", "gold"]):
            return DatasetTier.TIER_1_PRIORITY
        
        # Professional therapeutic datasets
        if any(keyword in dataset_name.lower() for keyword in ["psych", "counseling", "therapy", "clinical"]):
            return DatasetTier.TIER_2_PROFESSIONAL
        
        # Chain-of-thought reasoning datasets
        if any(keyword in dataset_name.lower() for keyword in ["cot", "reasoning", "chain"]):
            return DatasetTier.TIER_3_REASONING
        
        # Research datasets
        if any(keyword in dataset_name.lower() for keyword in ["research", "academic", "empathy"]):
            return DatasetTier.TIER_5_RESEARCH
        
        # Default to professional tier
        return DatasetTier.TIER_2_PROFESSIONAL
    
    def _validate_downloaded_dataset(self, dataset_name: str) -> bool:
        """Validate downloaded dataset quality and format."""
        if dataset_name not in self.loader.loaded_data:
            return False
        
        data = self.loader.loaded_data[dataset_name]
        
        # Basic validation
        if not data or len(data) == 0:
            self.logger.warning(f"Dataset {dataset_name} is empty")
            return False
        
        # Sample validation
        sample_size = min(100, len(data))
        valid_samples = 0
        
        for i, item in enumerate(data[:sample_size]):
            if DatasetUtils.validate_conversation_format(item):
                valid_samples += 1
        
        validation_rate = valid_samples / sample_size
        
        self.logger.info(
            f"Dataset {dataset_name} validation",
            total_items=len(data),
            sample_size=sample_size,
            valid_samples=valid_samples,
            validation_rate=f"{validation_rate:.2%}"
        )
        
        # Require at least 80% validation rate
        return validation_rate >= 0.8
    
    def _save_processed_dataset(self, dataset_name: str):
        """Save processed dataset to output directory."""
        if dataset_name not in self.loader.loaded_data:
            return
        
        output_dir = config.output_dir / "external_datasets"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f"{dataset_name}.jsonl"
        
        # Save as JSONL
        data = self.loader.loaded_data[dataset_name]
        written_count = DatasetUtils.safe_jsonl_writer(iter(data), output_file)
        
        self.logger.info(f"Saved {written_count} items to {output_file}")
        
        # Save metadata
        metadata = {
            "dataset_name": dataset_name,
            "source": self.loader.datasets[dataset_name].source,
            "tier": self.loader.datasets[dataset_name].tier.value,
            "total_items": len(data),
            "download_time": self.loader.datasets[dataset_name].load_time,
            "format_type": self.loader.datasets[dataset_name].format_type
        }
        
        metadata_file = output_dir / f"{dataset_name}_metadata.json"
        DatasetUtils.safe_json_save(metadata, metadata_file)
    
    def _log_download_summary(self):
        """Log comprehensive download summary."""
        total_time = time.time() - self.download_stats["start_time"]
        
        self.logger.info("=" * 60)
        self.logger.info("DATASET DOWNLOAD SUMMARY")
        self.logger.info("=" * 60)
        self.logger.info(f"Total Time: {total_time:.2f} seconds")
        self.logger.info(f"Datasets Attempted: {self.download_stats['total_attempted']}")
        self.logger.info(f"Successful Downloads: {self.download_stats['successful_downloads']}")
        self.logger.info(f"Failed Downloads: {self.download_stats['failed_downloads']}")
        self.logger.info(f"Total Conversations: {self.download_stats['total_conversations']:,}")
        
        success_rate = (self.download_stats['successful_downloads'] / 
                       self.download_stats['total_attempted'] * 100 
                       if self.download_stats['total_attempted'] > 0 else 0)
        self.logger.info(f"Success Rate: {success_rate:.1f}%")
        self.logger.info("=" * 60)
        
        # Save summary to file
        summary_file = config.output_dir / "download_summary.json"
        summary_data = {
            "timestamp": time.time(),
            "stats": self.download_stats,
            "datasets": self.loader.get_dataset_summary()
        }
        DatasetUtils.safe_json_save(summary_data, summary_file)
        self.logger.info(f"Download summary saved to {summary_file}")


def main():
    """Main entry point for dataset download script."""
    parser = argparse.ArgumentParser(
        description="Download external datasets for Pixel LLM training",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/download_datasets.py --all
    python scripts/download_datasets.py --dataset mental_health_counseling
    python scripts/download_datasets.py --dataset psych8k --validate-only
        """
    )
    
    parser.add_argument(
        "--all",
        action="store_true",
        help="Download all external datasets from configuration"
    )
    
    parser.add_argument(
        "--dataset",
        type=str,
        help="Download specific dataset by name"
    )
    
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate existing downloads without downloading"
    )
    
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=config.output_dir,
        help="Output directory for processed datasets"
    )
    
    args = parser.parse_args()
    
    if not args.all and not args.dataset:
        parser.error("Must specify either --all or --dataset")
    
    # Update output directory if specified
    if args.output_dir != config.output_dir:
        config.output_dir = args.output_dir
    
    downloader = DatasetDownloader()
    
    try:
        if args.all:
            success = downloader.download_all_external_datasets()
            if success:
                print("✅ All datasets downloaded successfully!")
                sys.exit(0)
            else:
                print("❌ Some datasets failed to download. Check logs for details.")
                sys.exit(1)
        
        elif args.dataset:
            if args.dataset not in config.external_datasets:
                print(f"❌ Dataset '{args.dataset}' not found in configuration.")
                print(f"Available datasets: {list(config.external_datasets.keys())}")
                sys.exit(1)
            
            hf_path = config.external_datasets[args.dataset]
            success = downloader.download_single_dataset(args.dataset, hf_path)
            
            if success:
                print(f"✅ Dataset '{args.dataset}' downloaded successfully!")
                sys.exit(0)
            else:
                print(f"❌ Failed to download dataset '{args.dataset}'. Check logs for details.")
                sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n⚠️ Download interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
