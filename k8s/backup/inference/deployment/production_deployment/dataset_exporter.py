#!/usr/bin/env python3
"""
Dataset Exporter - Task 5.5.2

Implements multiple export formats for production deployment:
- JSONL export with proper conversation formatting
- Parquet export for efficient data analysis
- CSV export for human-readable analysis
- HuggingFace datasets format export
- OpenAI fine-tuning format export
- PyTorch dataset format export
- Custom format export system
"""

import json
import csv
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Optional, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from enterprise_config import get_config
from enterprise_logging import get_logger
from enterprise_error_handling import handle_error, with_retry

# Database imports
sys.path.append(str(Path(__file__).parent.parent / "database"))
from conversation_database import ConversationDatabase

# Validation imports
from export_validator import ExportValidator, ValidationResult

# Performance optimization imports
from export_performance_optimizer import ExportPerformanceOptimizer, OptimizationConfig, PerformanceMetrics

@dataclass
class ExportConfiguration:
    """Configuration for dataset export."""
    include_metadata: bool = True
    include_quality_metrics: bool = True
    include_tags: bool = True
    max_conversations_per_file: int = 100000
    compress_output: bool = True
    validate_output: bool = True
    optimize_performance: bool = True
    custom_fields: List[str] = field(default_factory=list)

@dataclass
class ExportResult:
    """Result of export operation."""
    format_name: str
    output_files: List[str]
    total_conversations: int
    export_time_seconds: float
    file_sizes_mb: Dict[str, float]
    validation_passed: bool = True
    validation_results: Dict[str, ValidationResult] = field(default_factory=dict)
    validation_score: float = 1.0
    performance_metrics: Optional[PerformanceMetrics] = None
    optimizations_applied: List[str] = field(default_factory=list)
    export_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

class DatasetExporter:
    """Multi-format dataset exporter for production deployment."""
    
    def __init__(self, database: ConversationDatabase, config: ExportConfiguration = None):
        self.config = get_config()
        self.logger = get_logger("dataset_exporter")
        self.database = database
        self.export_config = config or ExportConfiguration()
        
        # Initialize export validator
        self.validator = ExportValidator() if self.export_config.validate_output else None
        
        # Initialize performance optimizer
        if self.export_config.optimize_performance:
            optimization_config = OptimizationConfig(
                enable_parallel_processing=True,
                enable_streaming=True,
                enable_caching=True,
                enable_compression=self.export_config.compress_output,
                enable_batch_optimization=True,
                profile_performance=True,
                chunk_size=min(1000, self.export_config.max_conversations_per_file // 10)
            )
            self.performance_optimizer = ExportPerformanceOptimizer(optimization_config)
        else:
            self.performance_optimizer = None
        
        # Export format handlers
        self.format_handlers = {
            'jsonl': self._export_jsonl,
            'parquet': self._export_parquet,
            'csv': self._export_csv,
            'huggingface': self._export_huggingface,
            'openai': self._export_openai,
            'pytorch': self._export_pytorch,
            'tensorflow': self._export_tensorflow,
            'custom': self._export_custom
        }
        
        self.logger.info("Dataset exporter initialized with multiple format support")
    
    @with_retry(component="dataset_exporter")
    def export_dataset(self, conversation_ids: List[str], format_name: str, 
                      output_dir: str, filename_prefix: str = "dataset") -> ExportResult:
        """Export dataset in specified format."""
        
        start_time = datetime.now()
        
        if format_name not in self.format_handlers:
            raise ValueError(f"Unsupported export format: {format_name}")
        
        self.logger.info(f"Starting {format_name} export of {len(conversation_ids)} conversations")
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Load conversations with full data
        conversations = self._load_conversations_for_export(conversation_ids)
        
        if not conversations:
            raise ValueError("No conversations found for export")
        
        # Export using format-specific handler
        handler = self.format_handlers[format_name]
        output_files = handler(conversations, output_path, filename_prefix)
        
        # Calculate export time
        export_time = (datetime.now() - start_time).total_seconds()
        
        # Calculate file sizes
        file_sizes = {}
        for file_path in output_files:
            file_size_mb = Path(file_path).stat().st_size / (1024 * 1024)
            file_sizes[Path(file_path).name] = round(file_size_mb, 2)
        
        # Validate output if requested
        validation_passed = True
        validation_results = {}
        validation_score = 1.0
        
        if self.export_config.validate_output and self.validator:
            self.logger.info(f"Validating {format_name} export files...")
            
            # Create validation file mapping
            validation_files = {}
            for file_path in output_files:
                validation_files[format_name] = file_path
            
            # Run validation
            validation_results = self.validator.validate_multiple_exports(validation_files)
            
            # Check if all validations passed
            validation_passed = all(result.is_valid for result in validation_results.values())
            
            # Calculate overall validation score
            if validation_results:
                validation_score = sum(result.validation_score for result in validation_results.values()) / len(validation_results)
            
            # Log validation results
            for format_name_val, result in validation_results.items():
                if result.is_valid:
                    self.logger.info(f"✅ {format_name_val} validation passed (score: {result.validation_score:.3f})")
                else:
                    self.logger.warning(f"❌ {format_name_val} validation failed (score: {result.validation_score:.3f})")
                    for error in result.errors:
                        self.logger.error(f"   Error: {error}")
        
        result = ExportResult(
            format_name=format_name,
            output_files=output_files,
            total_conversations=len(conversations),
            export_time_seconds=export_time,
            file_sizes_mb=file_sizes,
            validation_passed=validation_passed,
            validation_results=validation_results,
            validation_score=validation_score
        )
        
        self.logger.info(f"{format_name} export complete: {len(output_files)} files, "
                        f"{export_time:.2f}s, {sum(file_sizes.values()):.2f}MB total, "
                        f"validation: {'✅ PASSED' if validation_passed else '❌ FAILED'} "
                        f"(score: {validation_score:.3f})")
        
        return result
    
    def _load_conversations_for_export(self, conversation_ids: List[str]) -> List[Dict[str, Any]]:
        """Load conversations with all necessary data for export."""
        
        conversations = []
        
        try:
            # Load in batches to avoid memory issues
            batch_size = 1000
            for i in range(0, len(conversation_ids), batch_size):
                batch_ids = conversation_ids[i:i + batch_size]
                
                with self.database._get_connection() as conn:
                    # Create placeholders for IN clause
                    placeholders = ','.join(['?' for _ in batch_ids])
                    
                    query = f"""
                        SELECT 
                            c.conversation_id,
                            c.dataset_source,
                            c.tier,
                            c.title,
                            c.summary,
                            c.conversations_json,
                            c.turn_count,
                            c.word_count,
                            c.character_count,
                            c.language,
                            c.processing_status,
                            c.processed_at,
                            c.processing_version,
                            c.created_at,
                            c.metadata_json,
                            q.overall_quality,
                            q.therapeutic_accuracy,
                            q.clinical_compliance,
                            q.safety_score,
                            q.conversation_coherence,
                            q.emotional_authenticity
                        FROM conversations c
                        LEFT JOIN conversation_quality q ON c.conversation_id = q.conversation_id
                        WHERE c.conversation_id IN ({placeholders})
                    """
                    
                    cursor = conn.execute(query, batch_ids)
                    batch_conversations = []
                    
                    for row in cursor.fetchall():
                        conv_data = dict(row)
                        
                        # Parse JSON fields
                        raw_conversations = json.loads(conv_data['conversations_json'])
                        conv_data['metadata'] = json.loads(conv_data['metadata_json'] or '{}')
                        
                        # Convert conversations to proper format with role/content structure
                        # Handle two database formats:
                        # Format 1: [{"human": "text"}, {"assistant": "text"}, ...]
                        # Format 2: [{"role": "client", "content": "text", "turn_id": 1}, ...]
                        formatted_conversations = []
                        
                        for conv_turn in raw_conversations:
                            if isinstance(conv_turn, dict):
                                # Check if this is already in role/content format
                                if 'role' in conv_turn and 'content' in conv_turn:
                                    # Format 2: Already has role/content structure
                                    role = conv_turn['role']
                                    content = conv_turn['content']
                                    
                                    # Map role names to standard format
                                    if role.lower() in ['human', 'user', 'client']:
                                        formatted_role = 'user'
                                    elif role.lower() in ['assistant', 'ai', 'therapist']:
                                        formatted_role = 'assistant'
                                    else:
                                        formatted_role = 'user'  # Default fallback
                                    
                                    formatted_conversations.append({
                                        'role': formatted_role,
                                        'content': str(content)
                                    })
                                else:
                                    # Format 1: Simple {role: content} format
                                    for role, content in conv_turn.items():
                                        # Map role names to standard format
                                        if role.lower() in ['human', 'user', 'client']:
                                            formatted_role = 'user'
                                        elif role.lower() in ['assistant', 'ai', 'therapist']:
                                            formatted_role = 'assistant'
                                        else:
                                            formatted_role = 'user'  # Default fallback
                                        
                                        formatted_conversations.append({
                                            'role': formatted_role,
                                            'content': str(content)
                                        })
                        
                        conv_data['conversations'] = formatted_conversations
                        
                        # Create quality_metrics structure from individual fields
                        conv_data['quality_metrics'] = {
                            'overall_quality': conv_data.get('overall_quality', 0.0) or 0.0,
                            'therapeutic_accuracy': conv_data.get('therapeutic_accuracy', 0.0) or 0.0,
                            'clinical_compliance': conv_data.get('clinical_compliance', 0.0) or 0.0,
                            'safety_score': conv_data.get('safety_score', 0.0) or 0.0,
                            'conversation_coherence': conv_data.get('conversation_coherence', 0.0) or 0.0,
                            'emotional_authenticity': conv_data.get('emotional_authenticity', 0.0) or 0.0
                        }
                        
                        # Load tags if requested
                        if self.export_config.include_tags:
                            tag_cursor = conn.execute("""
                                SELECT tag_type, tag_value FROM conversation_tags 
                                WHERE conversation_id = ?
                            """, (conv_data['conversation_id'],))
                            
                            tags = {'tags': [], 'categories': [], 'therapeutic_techniques': []}
                            for tag_row in tag_cursor.fetchall():
                                tag_type, tag_value = tag_row
                                if tag_type == 'tag':
                                    tags['tags'].append(tag_value)
                                elif tag_type == 'category':
                                    tags['categories'].append(tag_value)
                                elif tag_type == 'technique':
                                    tags['therapeutic_techniques'].append(tag_value)
                            
                            conv_data.update(tags)
                        else:
                            # Set empty defaults
                            conv_data.update({
                                'tags': [],
                                'categories': [],
                                'therapeutic_techniques': []
                            })
                        
                        batch_conversations.append(conv_data)
                    
                    conversations.extend(batch_conversations)
            
            self.logger.debug(f"Loaded {len(conversations)} conversations for export")
            return conversations
            
        except Exception as e:
            handle_error(e, "dataset_exporter", {
                "operation": "load_conversations_for_export",
                "conversation_count": len(conversation_ids)
            })
            return []
    
    def _export_jsonl(self, conversations: List[Dict[str, Any]], 
                     output_path: Path, filename_prefix: str) -> List[str]:
        """Export conversations in JSONL format."""
        
        output_files = []
        
        # Split into multiple files if needed
        max_per_file = self.export_config.max_conversations_per_file
        file_count = (len(conversations) + max_per_file - 1) // max_per_file
        
        for file_idx in range(file_count):
            start_idx = file_idx * max_per_file
            end_idx = min(start_idx + max_per_file, len(conversations))
            file_conversations = conversations[start_idx:end_idx]
            
            # Generate filename
            if file_count > 1:
                filename = f"{filename_prefix}_part{file_idx + 1:03d}.jsonl"
            else:
                filename = f"{filename_prefix}.jsonl"
            
            output_file = output_path / filename
            
            with open(output_file, 'w', encoding='utf-8') as f:
                for conv in file_conversations:
                    # Create JSONL record with correct schema
                    jsonl_record = {
                        'conversation_id': conv['conversation_id'],
                        'messages': conv['conversations'],  # Use 'messages' not 'conversations'
                        'quality_score': conv.get('quality_metrics', {}).get('overall_quality', 0.0)  # Extract quality_score
                    }
                    
                    # Add optional fields
                    if self.export_config.include_metadata:
                        jsonl_record.update({
                            'metadata': {
                                'dataset_source': conv['dataset_source'],
                                'tier': conv['tier'],
                                'title': conv['title'],
                                'summary': conv['summary'],
                                'turn_count': conv['turn_count'],
                                'word_count': conv['word_count'],
                                'language': conv['language'],
                                'processing_status': conv['processing_status'],
                                'created_at': conv['created_at']
                            }
                        })
                        
                        if 'metadata' in conv:
                            jsonl_record['metadata'].update(conv['metadata'])
                    
                    if self.export_config.include_quality_metrics:
                        # Add individual quality metrics as metadata
                        if 'quality_metrics' in conv:
                            if 'metadata' not in jsonl_record:
                                jsonl_record['metadata'] = {}
                            jsonl_record['metadata']['detailed_quality_metrics'] = conv['quality_metrics']
                    
                    if self.export_config.include_tags:
                        jsonl_record['tags'] = conv.get('tags', [])
                        jsonl_record['categories'] = conv.get('categories', [])
                        jsonl_record['therapeutic_techniques'] = conv.get('therapeutic_techniques', [])
                    
                    f.write(json.dumps(jsonl_record, ensure_ascii=False) + '\n')
            
            output_files.append(str(output_file))
        
        return output_files
    
    def _export_parquet(self, conversations: List[Dict[str, Any]], 
                       output_path: Path, filename_prefix: str) -> List[str]:
        """Export conversations in Parquet format for efficient analysis."""
        
        # Flatten conversations for tabular format with correct schema
        flattened_data = []
        
        for conv in conversations:
            # Create base record with correct schema
            record = {
                'conversation_id': conv['conversation_id'],
                'messages_json': json.dumps(conv['conversations'], ensure_ascii=False),
                'quality_score': conv.get('quality_metrics', {}).get('overall_quality', 0.0)
            }
            
            # Add metadata as JSON
            if self.export_config.include_metadata:
                metadata = {
                    'dataset_source': conv['dataset_source'],
                    'tier': conv['tier'],
                    'title': conv['title'],
                    'summary': conv['summary'],
                    'turn_count': conv['turn_count'],
                    'word_count': conv['word_count'],
                    'language': conv['language'],
                    'processing_status': conv['processing_status'],
                    'created_at': conv['created_at']
                }
                if 'metadata' in conv:
                    metadata.update(conv['metadata'])
                
                record.update({
                    'metadata_json': json.dumps(metadata, ensure_ascii=False),
                    'tier': conv['tier'],
                    'source_dataset': conv['dataset_source']
                })
            
            # Add tags as JSON
            if self.export_config.include_tags:
                tags_data = {
                    'tags': conv.get('tags', []),
                    'categories': conv.get('categories', []),
                    'therapeutic_techniques': conv.get('therapeutic_techniques', [])
                }
                record['tags_json'] = json.dumps(tags_data, ensure_ascii=False)
            
            flattened_data.append(record)
        
        # Create DataFrame and save as Parquet
        df = pd.DataFrame(flattened_data)
        
        output_file = output_path / f"{filename_prefix}.parquet"
        df.to_parquet(output_file, compression='snappy', index=False)
        
        return [str(output_file)]
    
    def _export_csv(self, conversations: List[Dict[str, Any]], 
                   output_path: Path, filename_prefix: str) -> List[str]:
        """Export conversations in CSV format for human-readable analysis."""
        
        output_file = output_path / f"{filename_prefix}.csv"
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            # Define CSV columns with correct schema
            fieldnames = [
                'conversation_id', 'messages_json', 'quality_score'
            ]
            
            if self.export_config.include_metadata:
                fieldnames.extend([
                    'metadata_json', 'tier', 'source_dataset'
                ])
            
            if self.export_config.include_tags:
                fieldnames.extend(['tags_json'])
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for conv in conversations:
                row = {
                    'conversation_id': conv['conversation_id'],
                    'messages_json': json.dumps(conv['conversations'], ensure_ascii=False),
                    'quality_score': conv.get('quality_metrics', {}).get('overall_quality', 0.0)
                }
                
                if self.export_config.include_metadata:
                    metadata = {
                        'dataset_source': conv['dataset_source'],
                        'tier': conv['tier'],
                        'title': conv['title'],
                        'summary': conv['summary'],
                        'turn_count': conv['turn_count'],
                        'word_count': conv['word_count'],
                        'language': conv['language'],
                        'processing_status': conv['processing_status'],
                        'created_at': conv['created_at']
                    }
                    if 'metadata' in conv:
                        metadata.update(conv['metadata'])
                    
                    row.update({
                        'metadata_json': json.dumps(metadata, ensure_ascii=False),
                        'tier': conv['tier'],
                        'source_dataset': conv['dataset_source']
                    })
                
                if self.export_config.include_tags:
                    tags_data = {
                        'tags': conv.get('tags', []),
                        'categories': conv.get('categories', []),
                        'therapeutic_techniques': conv.get('therapeutic_techniques', [])
                    }
                    row['tags_json'] = json.dumps(tags_data, ensure_ascii=False)
                
                writer.writerow(row)
        
        return [str(output_file)]
    
    def _export_huggingface(self, conversations: List[Dict[str, Any]], 
                           output_path: Path, filename_prefix: str) -> List[str]:
        """Export in HuggingFace datasets format."""
        
        # Create HuggingFace compatible format
        hf_data = []
        
        for conv in conversations:
            # Format for HuggingFace conversational AI with correct schema
            hf_record = {
                'conversation_id': conv['conversation_id'],
                'messages': conv['conversations'],  # Use 'messages' not 'conversations'
                'quality_score': conv.get('quality_metrics', {}).get('overall_quality', 0.0)
            }
            
            if self.export_config.include_metadata:
                hf_record['metadata'] = {
                    'dataset_source': conv['dataset_source'],
                    'tier': conv['tier'],
                    'title': conv['title'],
                    'summary': conv['summary'],
                    'turn_count': conv['turn_count'],
                    'word_count': conv['word_count'],
                    'language': conv['language'],
                    'processing_status': conv['processing_status'],
                    'created_at': conv['created_at']
                }
                if 'metadata' in conv:
                    hf_record['metadata'].update(conv['metadata'])
            
            if self.export_config.include_tags:
                hf_record['tags'] = conv.get('tags', [])
                hf_record['categories'] = conv.get('categories', [])
                hf_record['therapeutic_techniques'] = conv.get('therapeutic_techniques', [])
            
            if self.export_config.include_quality_metrics:
                if 'metadata' not in hf_record:
                    hf_record['metadata'] = {}
                hf_record['metadata']['detailed_quality_metrics'] = conv.get('quality_metrics', {})
            
            hf_data.append(hf_record)
        
        # Save as JSONL (HuggingFace datasets format)
        output_file = output_path / f"{filename_prefix}_hf.jsonl"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for record in hf_data:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        
        return [str(output_file)]
    
    def _export_openai(self, conversations: List[Dict[str, Any]], 
                      output_path: Path, filename_prefix: str) -> List[str]:
        """Export in OpenAI fine-tuning format."""
        
        openai_data = []
        
        for conv in conversations:
            # Convert to OpenAI chat format
            messages = []
            
            for exchange in conv['conversations']:
                if isinstance(exchange, dict):
                    for role, content in exchange.items():
                        # Map roles to OpenAI format
                        if role.lower() in ['human', 'user']:
                            openai_role = 'user'
                        elif role.lower() in ['assistant', 'ai', 'therapist']:
                            openai_role = 'assistant'
                        else:
                            openai_role = 'user'  # Default
                        
                        messages.append({
                            'role': openai_role,
                            'content': content
                        })
            
            openai_record = {
                'messages': messages,
                'metadata': {
                    'conversation_id': conv['conversation_id'],
                    'dataset_source': conv['dataset_source'],
                    'tier': conv['tier']
                }
            }
            
            if self.export_config.include_quality_metrics and conv['overall_quality']:
                openai_record['metadata']['quality_score'] = conv['overall_quality']
            
            openai_data.append(openai_record)
        
        # Save as JSONL (OpenAI format)
        output_file = output_path / f"{filename_prefix}_openai.jsonl"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for record in openai_data:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        
        return [str(output_file)]
    
    def _export_pytorch(self, conversations: List[Dict[str, Any]], 
                       output_path: Path, filename_prefix: str) -> List[str]:
        """Export in PyTorch dataset format."""
        
        # Create PyTorch-compatible format
        pytorch_data = {
            'conversations': [],
            'metadata': [],
            'quality_metrics': [] if self.export_config.include_quality_metrics else None
        }
        
        for conv in conversations:
            pytorch_data['conversations'].append(conv['conversations'])
            
            pytorch_data['metadata'].append({
                'conversation_id': conv['conversation_id'],
                'dataset_source': conv['dataset_source'],
                'tier': conv['tier'],
                'turn_count': conv['turn_count'],
                'word_count': conv['word_count']
            })
            
            if self.export_config.include_quality_metrics:
                pytorch_data['quality_metrics'].append({
                    'overall_quality': conv['overall_quality'] or 0.0,
                    'therapeutic_accuracy': conv['therapeutic_accuracy'] or 0.0,
                    'safety_score': conv['safety_score'] or 0.0
                })
        
        # Save as JSON
        output_file = output_path / f"{filename_prefix}_pytorch.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(pytorch_data, f, indent=2, ensure_ascii=False)
        
        return [str(output_file)]
    
    def _export_tensorflow(self, conversations: List[Dict[str, Any]], 
                          output_path: Path, filename_prefix: str) -> List[str]:
        """Export in TensorFlow dataset format."""
        
        # Create TensorFlow-compatible format (similar to PyTorch but with TF conventions)
        tf_data = {
            'features': {
                'conversation_id': [],
                'input_text': [],
                'target_text': [],
                'metadata': []
            }
        }
        
        for conv in conversations:
            # Extract input/target pairs from conversation
            conversations_list = conv['conversations']
            
            for i in range(0, len(conversations_list) - 1, 2):
                if i + 1 < len(conversations_list):
                    input_exchange = conversations_list[i]
                    target_exchange = conversations_list[i + 1]
                    
                    # Extract text from exchanges
                    input_text = ""
                    target_text = ""
                    
                    if isinstance(input_exchange, dict):
                        input_text = list(input_exchange.values())[0]
                    
                    if isinstance(target_exchange, dict):
                        target_text = list(target_exchange.values())[0]
                    
                    tf_data['features']['conversation_id'].append(conv['conversation_id'])
                    tf_data['features']['input_text'].append(input_text)
                    tf_data['features']['target_text'].append(target_text)
                    tf_data['features']['metadata'].append({
                        'dataset_source': conv['dataset_source'],
                        'tier': conv['tier'],
                        'quality_score': conv['overall_quality'] or 0.0
                    })
        
        # Save as JSON
        output_file = output_path / f"{filename_prefix}_tensorflow.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(tf_data, f, indent=2, ensure_ascii=False)
        
        return [str(output_file)]
    
    def _export_custom(self, conversations: List[Dict[str, Any]], 
                      output_path: Path, filename_prefix: str) -> List[str]:
        """Export in custom format with full flexibility."""
        
        # Custom format includes everything with maximum flexibility
        custom_data = {
            'export_info': {
                'format': 'pixelated_ai_custom',
                'version': '1.0',
                'export_timestamp': datetime.now(timezone.utc).isoformat(),
                'total_conversations': len(conversations),
                'configuration': self.export_config.__dict__
            },
            'conversations': conversations
        }
        
        # Save as JSON
        output_file = output_path / f"{filename_prefix}_custom.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(custom_data, f, indent=2, ensure_ascii=False, default=str)
        
        return [str(output_file)]
    
if __name__ == "__main__":
    # Test the dataset exporter
    from conversation_database import ConversationDatabase
    
    print("📤 DATASET EXPORTER TEST")
    print("=" * 50)
    
    # Initialize database and exporter
    db = ConversationDatabase()
    
    config = ExportConfiguration(
        include_metadata=True,
        include_quality_metrics=True,
        include_tags=True,
        validate_output=True
    )
    
    exporter = DatasetExporter(db, config)
    
    try:
        # Get some conversation IDs for testing
        with db._get_connection() as conn:
            cursor = conn.execute("SELECT conversation_id FROM conversations LIMIT 3")
            conversation_ids = [row[0] for row in cursor.fetchall()]
        
        if conversation_ids:
            print(f"✅ Found {len(conversation_ids)} conversations for export testing")
            
            # Test different export formats
            formats_to_test = ['jsonl', 'csv', 'huggingface', 'openai']
            
            for format_name in formats_to_test:
                try:
                    result = exporter.export_dataset(
                        conversation_ids=conversation_ids,
                        format_name=format_name,
                        output_dir="/home/vivi/pixelated/ai/production_deployment/exports",
                        filename_prefix=f"test_{format_name}"
                    )
                    
                    print(f"✅ {format_name} export: {len(result.output_files)} files, "
                          f"{result.export_time_seconds:.2f}s, "
                          f"{sum(result.file_sizes_mb.values()):.2f}MB")
                    
                except Exception as e:
                    print(f"❌ {format_name} export failed: {e}")
        else:
            print("⚠️ No conversations found for export testing")
        
    finally:
        db.close()
    
    print("✅ Dataset exporter test complete!")
