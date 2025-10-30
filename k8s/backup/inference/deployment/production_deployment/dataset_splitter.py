#!/usr/bin/env python3
"""
Dataset Splitter - Task 5.5.1.1

Implements proper stratified sampling for dataset splits:
- Stratified sampling by tier, quality, and source
- Conversation-level splitting (not random sampling)
- Quality-balanced splits across train/validation/test
- Reproducible splits with seed management
- Enterprise-grade performance and logging
"""

import json
import random
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from collections import defaultdict, Counter
import logging
import numpy as np

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from enterprise_config import get_config
from enterprise_logging import get_logger
from enterprise_error_handling import handle_error, with_retry

# Database imports
sys.path.append(str(Path(__file__).parent.parent / "database"))
from conversation_database import ConversationDatabase

@dataclass
class SplitConfiguration:
    """Configuration for dataset splitting."""
    train_ratio: float = 0.8
    validation_ratio: float = 0.1
    test_ratio: float = 0.1
    random_seed: int = 42
    stratify_by: List[str] = field(default_factory=lambda: ['tier', 'quality_range'])
    min_conversations_per_stratum: int = 10
    quality_ranges: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        'high': (0.8, 1.0),
        'medium': (0.6, 0.8),
        'low': (0.4, 0.6),
        'very_low': (0.0, 0.4)
    })

@dataclass
class SplitStatistics:
    """Statistics for dataset splits."""
    total_conversations: int
    train_count: int
    validation_count: int
    test_count: int
    stratification_stats: Dict[str, Dict[str, Dict[str, int]]]
    quality_distribution: Dict[str, Dict[str, float]]
    tier_distribution: Dict[str, Dict[str, int]]
    source_distribution: Dict[str, Dict[str, int]]
    split_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

class DatasetSplitter:
    """Enterprise-grade dataset splitter with stratified sampling."""
    
    def __init__(self, database: ConversationDatabase, config: SplitConfiguration = None):
        self.config = get_config()
        self.logger = get_logger("dataset_splitter")
        self.database = database
        self.split_config = config or SplitConfiguration()
        
        # Validate split ratios
        total_ratio = (self.split_config.train_ratio + 
                      self.split_config.validation_ratio + 
                      self.split_config.test_ratio)
        if abs(total_ratio - 1.0) > 0.001:
            raise ValueError(f"Split ratios must sum to 1.0, got {total_ratio}")
        
        # Set random seed for reproducibility
        random.seed(self.split_config.random_seed)
        np.random.seed(self.split_config.random_seed)
        
        self.logger.info("Dataset splitter initialized with stratified sampling")
    
    @with_retry(component="dataset_splitter")
    def create_splits(self, filters: Dict[str, Any] = None) -> Tuple[Dict[str, List[str]], SplitStatistics]:
        """Create stratified train/validation/test splits."""
        
        self.logger.info("Starting stratified dataset splitting...")
        
        # Load conversations with metadata
        conversations = self._load_conversations_for_splitting(filters)
        
        if not conversations:
            raise ValueError("No conversations found for splitting")
        
        self.logger.info(f"Loaded {len(conversations)} conversations for splitting")
        
        # Create stratification groups
        strata = self._create_stratification_groups(conversations)
        
        # Perform stratified splitting
        splits = self._perform_stratified_split(strata)
        
        # Calculate statistics
        statistics = self._calculate_split_statistics(conversations, splits)
        
        # Validate splits
        self._validate_splits(splits, statistics)
        
        self.logger.info(f"Dataset splitting complete: {statistics.train_count} train, "
                        f"{statistics.validation_count} validation, {statistics.test_count} test")
        
        return splits, statistics
    
    def _load_conversations_for_splitting(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Load conversations with all necessary metadata for splitting."""
        
        try:
            with self.database._get_connection() as conn:
                # Build query with filters
                where_clauses = []
                params = []
                
                if filters:
                    if 'dataset_source' in filters:
                        where_clauses.append("c.dataset_source = ?")
                        params.append(filters['dataset_source'])
                    
                    if 'tier' in filters:
                        where_clauses.append("c.tier = ?")
                        params.append(filters['tier'])
                    
                    if 'processing_status' in filters:
                        where_clauses.append("c.processing_status = ?")
                        params.append(filters['processing_status'])
                    
                    if 'min_quality' in filters:
                        where_clauses.append("q.overall_quality >= ?")
                        params.append(filters['min_quality'])
                
                where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
                
                query = f"""
                    SELECT 
                        c.conversation_id,
                        c.dataset_source,
                        c.tier,
                        c.processing_status,
                        c.turn_count,
                        c.word_count,
                        c.created_at,
                        COALESCE(q.overall_quality, 0.0) as overall_quality,
                        COALESCE(q.therapeutic_accuracy, 0.0) as therapeutic_accuracy,
                        COALESCE(q.safety_score, 0.0) as safety_score
                    FROM conversations c
                    LEFT JOIN conversation_quality q ON c.conversation_id = q.conversation_id
                    WHERE {where_sql}
                    ORDER BY c.created_at
                """
                
                cursor = conn.execute(query, params)
                conversations = [dict(row) for row in cursor.fetchall()]
                
                return conversations
                
        except Exception as e:
            handle_error(e, "dataset_splitter", {
                "operation": "load_conversations_for_splitting",
                "filters": filters
            })
            return []
    
    def _create_stratification_groups(self, conversations: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Create stratification groups based on configuration."""
        
        strata = defaultdict(list)
        
        for conv in conversations:
            # Create stratification key
            strat_key_parts = []
            
            for stratify_field in self.split_config.stratify_by:
                if stratify_field == 'tier':
                    strat_key_parts.append(f"tier:{conv['tier']}")
                
                elif stratify_field == 'quality_range':
                    quality = conv['overall_quality']
                    quality_range = self._get_quality_range(quality)
                    strat_key_parts.append(f"quality:{quality_range}")
                
                elif stratify_field == 'dataset_source':
                    strat_key_parts.append(f"source:{conv['dataset_source']}")
                
                elif stratify_field == 'word_count_range':
                    word_count = conv['word_count']
                    word_range = self._get_word_count_range(word_count)
                    strat_key_parts.append(f"words:{word_range}")
            
            strat_key = "|".join(strat_key_parts)
            strata[strat_key].append(conv)
        
        # Filter out strata with too few conversations
        filtered_strata = {}
        small_strata_conversations = []
        
        for strat_key, strat_conversations in strata.items():
            if len(strat_conversations) >= self.split_config.min_conversations_per_stratum:
                filtered_strata[strat_key] = strat_conversations
            else:
                small_strata_conversations.extend(strat_conversations)
                self.logger.warning(f"Stratum '{strat_key}' has only {len(strat_conversations)} conversations, "
                                  f"merging with general pool")
        
        # Add small strata to a general pool
        if small_strata_conversations:
            filtered_strata['general_pool'] = small_strata_conversations
        
        self.logger.info(f"Created {len(filtered_strata)} stratification groups")
        return filtered_strata
    
    def _get_quality_range(self, quality: float) -> str:
        """Get quality range category for a quality score."""
        
        for range_name, (min_qual, max_qual) in self.split_config.quality_ranges.items():
            if min_qual <= quality < max_qual:
                return range_name
        
        # Handle edge case for quality = 1.0
        if quality >= 1.0:
            return 'high'
        
        return 'very_low'
    
    def _get_word_count_range(self, word_count: int) -> str:
        """Get word count range category."""
        
        if word_count < 50:
            return 'short'
        elif word_count < 200:
            return 'medium'
        elif word_count < 500:
            return 'long'
        else:
            return 'very_long'
    
    def _perform_stratified_split(self, strata: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[str]]:
        """Perform stratified splitting across all strata."""
        
        splits = {
            'train': [],
            'validation': [],
            'test': []
        }
        
        for strat_key, strat_conversations in strata.items():
            # Shuffle conversations within stratum
            shuffled_conversations = strat_conversations.copy()
            random.shuffle(shuffled_conversations)
            
            # Calculate split sizes for this stratum
            total_count = len(shuffled_conversations)
            train_count = int(total_count * self.split_config.train_ratio)
            val_count = int(total_count * self.split_config.validation_ratio)
            test_count = total_count - train_count - val_count
            
            # Ensure minimum sizes
            if test_count < 1 and total_count >= 3:
                test_count = 1
                val_count = max(1, val_count - 1)
                train_count = total_count - val_count - test_count
            elif val_count < 1 and total_count >= 2:
                val_count = 1
                train_count = total_count - val_count - test_count
            
            # Split conversations
            train_end = train_count
            val_end = train_count + val_count
            
            train_conversations = shuffled_conversations[:train_end]
            val_conversations = shuffled_conversations[train_end:val_end]
            test_conversations = shuffled_conversations[val_end:]
            
            # Add to splits
            splits['train'].extend([conv['conversation_id'] for conv in train_conversations])
            splits['validation'].extend([conv['conversation_id'] for conv in val_conversations])
            splits['test'].extend([conv['conversation_id'] for conv in test_conversations])
            
            self.logger.debug(f"Stratum '{strat_key}': {len(train_conversations)} train, "
                            f"{len(val_conversations)} val, {len(test_conversations)} test")
        
        return splits
    
    def _calculate_split_statistics(self, conversations: List[Dict[str, Any]], 
                                  splits: Dict[str, List[str]]) -> SplitStatistics:
        """Calculate comprehensive statistics for the splits."""
        
        # Create conversation lookup
        conv_lookup = {conv['conversation_id']: conv for conv in conversations}
        
        # Initialize statistics
        stats = SplitStatistics(
            total_conversations=len(conversations),
            train_count=len(splits['train']),
            validation_count=len(splits['validation']),
            test_count=len(splits['test']),
            stratification_stats={},
            quality_distribution={},
            tier_distribution={},
            source_distribution={}
        )
        
        # Calculate distributions for each split
        for split_name, conv_ids in splits.items():
            split_conversations = [conv_lookup[conv_id] for conv_id in conv_ids]
            
            # Quality distribution
            quality_counts = Counter()
            for conv in split_conversations:
                quality_range = self._get_quality_range(conv['overall_quality'])
                quality_counts[quality_range] += 1
            
            total_split_count = len(split_conversations)
            stats.quality_distribution[split_name] = {
                range_name: count / total_split_count 
                for range_name, count in quality_counts.items()
            }
            
            # Tier distribution
            tier_counts = Counter(conv['tier'] for conv in split_conversations)
            stats.tier_distribution[split_name] = dict(tier_counts)
            
            # Source distribution
            source_counts = Counter(conv['dataset_source'] for conv in split_conversations)
            stats.source_distribution[split_name] = dict(source_counts)
        
        return stats
    
    def _validate_splits(self, splits: Dict[str, List[str]], statistics: SplitStatistics):
        """Validate that splits meet quality requirements."""
        
        validation_errors = []
        
        # Check split sizes
        total_conversations = statistics.total_conversations
        expected_train = int(total_conversations * self.split_config.train_ratio)
        expected_val = int(total_conversations * self.split_config.validation_ratio)
        expected_test = total_conversations - expected_train - expected_val
        
        train_diff = abs(statistics.train_count - expected_train)
        val_diff = abs(statistics.validation_count - expected_val)
        test_diff = abs(statistics.test_count - expected_test)
        
        # Allow 5% deviation from expected sizes
        tolerance = max(1, int(total_conversations * 0.05))
        
        if train_diff > tolerance:
            validation_errors.append(f"Train split size deviation: {train_diff} conversations")
        
        if val_diff > tolerance:
            validation_errors.append(f"Validation split size deviation: {val_diff} conversations")
        
        if test_diff > tolerance:
            validation_errors.append(f"Test split size deviation: {test_diff} conversations")
        
        # Check for overlap between splits
        train_set = set(splits['train'])
        val_set = set(splits['validation'])
        test_set = set(splits['test'])
        
        if train_set & val_set:
            validation_errors.append(f"Train/validation overlap: {len(train_set & val_set)} conversations")
        
        if train_set & test_set:
            validation_errors.append(f"Train/test overlap: {len(train_set & test_set)} conversations")
        
        if val_set & test_set:
            validation_errors.append(f"Validation/test overlap: {len(val_set & test_set)} conversations")
        
        # Check quality distribution balance
        for quality_range in self.split_config.quality_ranges.keys():
            train_pct = statistics.quality_distribution.get('train', {}).get(quality_range, 0)
            val_pct = statistics.quality_distribution.get('validation', {}).get(quality_range, 0)
            test_pct = statistics.quality_distribution.get('test', {}).get(quality_range, 0)
            
            # Check if distributions are reasonably balanced (within 10% relative difference)
            if train_pct > 0:
                val_diff_pct = abs(val_pct - train_pct) / train_pct
                test_diff_pct = abs(test_pct - train_pct) / train_pct
                
                if val_diff_pct > 0.3:  # 30% relative difference threshold
                    validation_errors.append(f"Quality range '{quality_range}' imbalanced: "
                                           f"train {train_pct:.3f}, val {val_pct:.3f}")
                
                if test_diff_pct > 0.3:
                    validation_errors.append(f"Quality range '{quality_range}' imbalanced: "
                                           f"train {train_pct:.3f}, test {test_pct:.3f}")
        
        # Log validation results
        if validation_errors:
            for error in validation_errors:
                self.logger.warning(f"Split validation warning: {error}")
        else:
            self.logger.info("Split validation passed - all quality checks met")
    
    def save_splits(self, splits: Dict[str, List[str]], statistics: SplitStatistics, 
                   output_dir: str = "/home/vivi/pixelated/ai/production_deployment/splits") -> Dict[str, str]:
        """Save splits to files with metadata."""
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate split version based on configuration and timestamp
        config_hash = hashlib.md5(
            json.dumps(self.split_config.__dict__, sort_keys=True).encode()
        ).hexdigest()[:8]
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        split_version = f"v{timestamp}_{config_hash}"
        
        split_dir = output_path / split_version
        split_dir.mkdir(parents=True, exist_ok=True)
        
        saved_files = {}
        
        # Save split files
        for split_name, conv_ids in splits.items():
            split_file = split_dir / f"{split_name}_split.json"
            with open(split_file, 'w') as f:
                json.dump({
                    'split_name': split_name,
                    'conversation_ids': conv_ids,
                    'count': len(conv_ids),
                    'split_version': split_version,
                    'created_at': datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
            
            saved_files[split_name] = str(split_file)
        
        # Save configuration
        config_file = split_dir / "split_config.json"
        with open(config_file, 'w') as f:
            json.dump({
                'split_configuration': self.split_config.__dict__,
                'split_version': split_version,
                'created_at': datetime.now(timezone.utc).isoformat()
            }, f, indent=2)
        
        saved_files['config'] = str(config_file)
        
        # Save statistics
        stats_file = split_dir / "split_statistics.json"
        with open(stats_file, 'w') as f:
            # Convert statistics to JSON-serializable format
            stats_dict = {
                'total_conversations': statistics.total_conversations,
                'train_count': statistics.train_count,
                'validation_count': statistics.validation_count,
                'test_count': statistics.test_count,
                'quality_distribution': statistics.quality_distribution,
                'tier_distribution': statistics.tier_distribution,
                'source_distribution': statistics.source_distribution,
                'split_timestamp': statistics.split_timestamp.isoformat(),
                'split_version': split_version
            }
            json.dump(stats_dict, f, indent=2)
        
        saved_files['statistics'] = str(stats_file)
        
        self.logger.info(f"Splits saved to: {split_dir}")
        return saved_files
    
    def load_splits(self, split_version: str, 
                   splits_dir: str = "/home/vivi/pixelated/ai/production_deployment/splits") -> Tuple[Dict[str, List[str]], SplitStatistics]:
        """Load previously saved splits."""
        
        split_path = Path(splits_dir) / split_version
        
        if not split_path.exists():
            raise FileNotFoundError(f"Split version not found: {split_version}")
        
        # Load splits
        splits = {}
        for split_name in ['train', 'validation', 'test']:
            split_file = split_path / f"{split_name}_split.json"
            if split_file.exists():
                with open(split_file, 'r') as f:
                    split_data = json.load(f)
                    splits[split_name] = split_data['conversation_ids']
        
        # Load statistics
        stats_file = split_path / "split_statistics.json"
        if stats_file.exists():
            with open(stats_file, 'r') as f:
                stats_data = json.load(f)
                statistics = SplitStatistics(
                    total_conversations=stats_data['total_conversations'],
                    train_count=stats_data['train_count'],
                    validation_count=stats_data['validation_count'],
                    test_count=stats_data['test_count'],
                    stratification_stats={},
                    quality_distribution=stats_data['quality_distribution'],
                    tier_distribution=stats_data['tier_distribution'],
                    source_distribution=stats_data['source_distribution'],
                    split_timestamp=datetime.fromisoformat(stats_data['split_timestamp'])
                )
        else:
            raise FileNotFoundError(f"Statistics file not found for split version: {split_version}")
        
        self.logger.info(f"Loaded splits version: {split_version}")
        return splits, statistics

if __name__ == "__main__":
    # Test the dataset splitter
    from conversation_database import ConversationDatabase
    
    print("🔄 DATASET SPLITTER TEST")
    print("=" * 50)
    
    # Initialize database and splitter
    db = ConversationDatabase()
    
    # Create test configuration
    config = SplitConfiguration(
        train_ratio=0.7,
        validation_ratio=0.15,
        test_ratio=0.15,
        random_seed=42,
        stratify_by=['tier', 'quality_range']
    )
    
    splitter = DatasetSplitter(db, config)
    
    try:
        # Create splits
        splits, statistics = splitter.create_splits()
        
        print(f"✅ Dataset splits created:")
        print(f"   Train: {statistics.train_count} conversations")
        print(f"   Validation: {statistics.validation_count} conversations")
        print(f"   Test: {statistics.test_count} conversations")
        print(f"   Total: {statistics.total_conversations} conversations")
        
        # Show quality distribution
        print(f"\n📊 Quality distribution:")
        for split_name, quality_dist in statistics.quality_distribution.items():
            print(f"   {split_name}: {quality_dist}")
        
        # Save splits
        saved_files = splitter.save_splits(splits, statistics)
        print(f"\n💾 Splits saved: {len(saved_files)} files")
        
    finally:
        db.close()
    
    print("✅ Dataset splitter test complete!")
