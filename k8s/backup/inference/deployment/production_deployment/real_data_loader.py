#!/usr/bin/env python3
"""
Real Data Loader for Production System

Loads our actual processed conversations from JSONL files into the production system.
This fixes the critical issue where production was only using 3 test conversations
instead of our 2.59M+ processed conversations.
"""

import json
import uuid
from pathlib import Path
from typing import Dict, List, Any, Iterator
from datetime import datetime, timezone
import logging

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from enterprise_config import get_config
from enterprise_logging import get_logger
from enterprise_error_handling import handle_error

# Database imports
sys.path.append(str(Path(__file__).parent.parent / "database"))
from conversation_database import ConversationDatabase
from conversation_schema import ConversationSchema, ConversationTier, ProcessingStatus

class RealDataLoader:
    """Loads actual processed conversations into production database."""
    
    def __init__(self, database: ConversationDatabase):
        self.config = get_config()
        self.logger = get_logger("real_data_loader")
        self.database = database
        
        # Define our processed data files
        self.data_files = {
            'priority_1': '/home/vivi/pixelated/ai/data/processed/priority_complete_fixed/priority_1_complete.jsonl',
            'priority_2': '/home/vivi/pixelated/ai/data/processed/priority_complete_fixed/priority_2_complete.jsonl',
            'priority_3': '/home/vivi/pixelated/ai/data/processed/priority_complete_fixed/priority_3_complete.jsonl',
            'professional_psychology': '/home/vivi/pixelated/ai/data/processed/professional_complete_integration/psychology_10k_complete.jsonl',
            'professional_soulchat': '/home/vivi/pixelated/ai/data/processed/phase_2_professional_datasets/task_5_9_soulchat/soulchat_2_0_conversations.jsonl',
            'professional_neuro': '/home/vivi/pixelated/ai/data/processed/phase_2_professional_datasets/task_5_13_neuro_qa_sft/neuro_qa_sft_conversations.jsonl',
            'cot_reasoning': '/home/vivi/pixelated/ai/data/processed/phase_3_cot_reasoning/phase_3_cot_reasoning_consolidated.jsonl',
            'additional_specialized': '/home/vivi/pixelated/ai/data/processed/task_5_31_additional_specialized/additional_specialized_conversations.jsonl'
        }
        
        self.logger.info("Real data loader initialized")
    
    def load_all_processed_data(self, batch_size: int = 1000) -> Dict[str, int]:
        """Load all processed conversations into the database."""
        
        self.logger.info("Starting to load all processed conversations into database...")
        
        results = {'loaded': 0, 'failed': 0, 'skipped': 0}
        
        for dataset_name, file_path in self.data_files.items():
            file_path_obj = Path(file_path)
            
            if not file_path_obj.exists():
                self.logger.warning(f"Data file not found: {file_path}")
                continue
            
            self.logger.info(f"Loading {dataset_name} from {file_path}")
            
            try:
                # Load conversations from file
                conversations = list(self._load_conversations_from_file(file_path_obj, dataset_name))
                
                if not conversations:
                    self.logger.warning(f"No conversations loaded from {dataset_name}")
                    continue
                
                # Insert in batches
                batch_results = self.database.batch_insert_conversations(conversations, batch_size)
                
                results['loaded'] += batch_results['inserted']
                results['failed'] += batch_results['failed']
                
                self.logger.info(f"Loaded {dataset_name}: {batch_results['inserted']} inserted, {batch_results['failed']} failed")
                
            except Exception as e:
                handle_error(e, "real_data_loader", {
                    "operation": "load_dataset",
                    "dataset_name": dataset_name,
                    "file_path": file_path
                })
                results['failed'] += 1
        
        self.logger.info(f"Data loading complete: {results['loaded']} loaded, {results['failed']} failed")
        return results
    
    def _load_conversations_from_file(self, file_path: Path, dataset_name: str) -> Iterator[ConversationSchema]:
        """Load conversations from a JSONL file."""
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Parse JSON
                    conv_data = json.loads(line)
                    
                    # Convert to ConversationSchema
                    conversation = self._convert_to_schema(conv_data, dataset_name, line_num)
                    
                    if conversation:
                        yield conversation
                    
                except Exception as e:
                    self.logger.error(f"Error parsing line {line_num} in {file_path}: {e}")
                    continue
    
    def _convert_to_schema(self, conv_data: Dict[str, Any], dataset_name: str, line_num: int) -> ConversationSchema:
        """Convert raw conversation data to ConversationSchema."""
        
        try:
            # Generate conversation ID if not present
            conversation_id = conv_data.get('conversation_id') or str(uuid.uuid4())
            
            # Determine tier
            tier = self._determine_tier(dataset_name, conv_data)
            
            # Extract conversations
            conversations = conv_data.get('conversations', [])
            if not conversations:
                # Try alternative formats
                if 'conversation' in conv_data:
                    conversations = conv_data['conversation']
                elif 'messages' in conv_data:
                    conversations = conv_data['messages']
                else:
                    self.logger.warning(f"No conversations found in {dataset_name} line {line_num}")
                    return None
            
            # Calculate basic metrics
            turn_count = len(conversations) if isinstance(conversations, list) else 0
            word_count = self._calculate_word_count(conversations)
            
            # Extract quality metrics
            quality_metrics = conv_data.get('quality_metrics', {})
            overall_quality = quality_metrics.get('overall_quality', 0.0)
            therapeutic_accuracy = quality_metrics.get('therapeutic_accuracy', 0.0)
            safety_score = quality_metrics.get('safety_score', 0.0)
            
            # If no quality metrics, assign reasonable defaults based on tier
            if overall_quality == 0.0:
                overall_quality = self._get_default_quality(tier)
            
            # Extract tags and categories
            tags = conv_data.get('tags', [])
            categories = conv_data.get('categories', [])
            techniques = conv_data.get('therapeutic_techniques', [])
            
            # Create schema object
            conversation = ConversationSchema(
                conversation_id=conversation_id,
                dataset_source=dataset_name,
                tier=tier,
                conversations=conversations,
                title=conv_data.get('title'),
                summary=conv_data.get('summary'),
                overall_quality=overall_quality,
                therapeutic_accuracy=therapeutic_accuracy,
                safety_score=safety_score,
                tags=tags,
                categories=categories,
                therapeutic_techniques=techniques,
                processing_status=ProcessingStatus.PROCESSED,
                turn_count=turn_count,
                word_count=word_count,
                processed_at=datetime.now(timezone.utc),
                processing_version="5.5.0",
                metadata=conv_data.get('metadata', {})
            )
            
            return conversation
            
        except Exception as e:
            self.logger.error(f"Error converting conversation from {dataset_name} line {line_num}: {e}")
            return None
    
    def _determine_tier(self, dataset_name: str, conv_data: Dict[str, Any]) -> ConversationTier:
        """Determine conversation tier based on dataset name."""
        
        if 'priority_1' in dataset_name:
            return ConversationTier.PRIORITY_1
        elif 'priority_2' in dataset_name:
            return ConversationTier.PRIORITY_2
        elif 'priority_3' in dataset_name:
            return ConversationTier.PRIORITY_3
        elif 'professional' in dataset_name:
            return ConversationTier.PROFESSIONAL
        elif 'cot' in dataset_name:
            return ConversationTier.COT_REASONING
        else:
            return ConversationTier.RESEARCH
    
    def _calculate_word_count(self, conversations: List[Dict[str, str]]) -> int:
        """Calculate total word count in conversations."""
        
        total_words = 0
        
        try:
            if isinstance(conversations, list):
                for exchange in conversations:
                    if isinstance(exchange, dict):
                        for role, text in exchange.items():
                            if isinstance(text, str):
                                total_words += len(text.split())
        except:
            pass
        
        return total_words
    
    def _get_default_quality(self, tier: ConversationTier) -> float:
        """Get default quality score based on tier."""
        
        quality_defaults = {
            ConversationTier.PRIORITY_1: 0.85,
            ConversationTier.PRIORITY_2: 0.75,
            ConversationTier.PRIORITY_3: 0.65,
            ConversationTier.PROFESSIONAL: 0.80,
            ConversationTier.COT_REASONING: 0.70,
            ConversationTier.RESEARCH: 0.60
        }
        
        return quality_defaults.get(tier, 0.60)
    
    def get_loading_statistics(self) -> Dict[str, Any]:
        """Get statistics about available data files."""
        
        stats = {}
        total_conversations = 0
        
        for dataset_name, file_path in self.data_files.items():
            file_path_obj = Path(file_path)
            
            if file_path_obj.exists():
                # Count lines in file
                with open(file_path_obj, 'r') as f:
                    line_count = sum(1 for line in f if line.strip())
                
                file_size_mb = file_path_obj.stat().st_size / (1024 * 1024)
                
                stats[dataset_name] = {
                    'file_exists': True,
                    'conversation_count': line_count,
                    'file_size_mb': round(file_size_mb, 2),
                    'file_path': str(file_path_obj)
                }
                
                total_conversations += line_count
            else:
                stats[dataset_name] = {
                    'file_exists': False,
                    'conversation_count': 0,
                    'file_size_mb': 0,
                    'file_path': str(file_path_obj)
                }
        
        stats['total_available'] = total_conversations
        
        return stats

if __name__ == "__main__":
    # Load real data into production database
    from conversation_database import ConversationDatabase
    
    print("🔄 REAL DATA LOADER - FIXING PRODUCTION DATA")
    print("=" * 60)
    
    # Initialize database and loader
    db = ConversationDatabase()
    loader = RealDataLoader(db)
    
    try:
        # Show available data
        stats = loader.get_loading_statistics()
        print(f"📊 Available data files:")
        for dataset_name, dataset_stats in stats.items():
            if dataset_name != 'total_available':
                if dataset_stats['file_exists']:
                    print(f"   ✅ {dataset_name}: {dataset_stats['conversation_count']:,} conversations ({dataset_stats['file_size_mb']:.1f}MB)")
                else:
                    print(f"   ❌ {dataset_name}: File not found")
        
        print(f"\n🎯 Total available: {stats['total_available']:,} conversations")
        
        # Check current database state
        db_stats = db.get_database_statistics()
        current_count = db_stats.get('total_conversations', 0)
        print(f"📊 Current database: {current_count} conversations")
        
        if current_count < stats['total_available']:
            print(f"\n🚀 Loading {stats['total_available'] - current_count:,} new conversations...")
            
            # Load all data
            results = loader.load_all_processed_data()
            
            print(f"✅ Data loading complete:")
            print(f"   Loaded: {results['loaded']:,} conversations")
            print(f"   Failed: {results['failed']:,} conversations")
            
            # Show final database state
            final_stats = db.get_database_statistics()
            final_count = final_stats.get('total_conversations', 0)
            print(f"   Final database: {final_count:,} conversations")
        else:
            print("✅ Database already contains all available conversations")
        
    finally:
        db.close()
    
    print("✅ Real data loading complete!")
