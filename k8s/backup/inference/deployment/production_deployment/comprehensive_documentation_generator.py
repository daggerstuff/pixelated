#!/usr/bin/env python3
"""
Comprehensive Documentation Generator - Task 5.5.3.1 Part 3

Complete documentation generation system that combines all components:
- Dataset metadata generation
- Schema documentation
- Quality metrics documentation
- Usage guides and examples
- API documentation
- Statistical reports
"""

import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import statistics

# Local imports
from conversation_database import ConversationDatabase
from dataset_documentation import DatasetDocumentationGenerator, DatasetMetadata, SchemaField, ExportFormatDoc, QualityMetricDoc
from documentation_templates import DocumentationTemplateManager

class ComprehensiveDocumentationGenerator:
    """Complete documentation generation system."""
    
    def __init__(self, database: ConversationDatabase, output_dir: Path = None):
        self.database = database
        self.output_dir = output_dir or Path("/home/vivi/pixelated/ai/docs")
        self.output_dir.mkdir(exist_ok=True)
        
        # Initialize components
        self.doc_generator = DatasetDocumentationGenerator(database)
        self.template_manager = DocumentationTemplateManager(self.output_dir)
        
        print(f"📚 Comprehensive documentation generator initialized")
        print(f"   Output directory: {self.output_dir}")
    
    def generate_export_format_documentation(self) -> Dict[str, ExportFormatDoc]:
        """Generate comprehensive export format documentation."""
        
        formats = {
            'jsonl': ExportFormatDoc(
                format_name='jsonl',
                description='JSON Lines format optimized for streaming and large-scale processing',
                file_extension='jsonl',
                use_cases=[
                    'Machine learning training pipelines',
                    'Streaming data processing',
                    'Large-scale analysis',
                    'Custom data processing workflows'
                ],
                schema_fields=self.doc_generator._generate_jsonl_schema(),
                example_record={
                    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
                    "messages": [
                        {"role": "user", "content": "I'm feeling anxious."},
                        {"role": "assistant", "content": "I understand your feelings..."}
                    ],
                    "quality_score": 0.85
                },
                validation_rules=[
                    'Each line must be valid JSON',
                    'Required fields must be present',
                    'Quality score must be 0.0-1.0',
                    'Messages must have role and content'
                ],
                best_practices=[
                    'Use for large datasets (>10K conversations)',
                    'Stream processing for memory efficiency',
                    'Validate each record during processing',
                    'Use compression for storage optimization'
                ]
            ),
            'csv': ExportFormatDoc(
                format_name='csv',
                description='Comma-separated values format for spreadsheet compatibility and analysis',
                file_extension='csv',
                use_cases=[
                    'Data analysis with Excel/Google Sheets',
                    'Statistical analysis with R/Python',
                    'Business intelligence tools',
                    'Legacy system integration'
                ],
                schema_fields=self.doc_generator._generate_csv_schema(),
                example_record={
                    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
                    "messages_json": '[{"role": "user", "content": "Hello"}]',
                    "quality_score": 0.85
                },
                validation_rules=[
                    'Valid CSV format with headers',
                    'JSON fields must be valid JSON strings',
                    'No missing required columns',
                    'Proper escaping of special characters'
                ],
                best_practices=[
                    'Use for tabular analysis',
                    'Parse JSON fields when needed',
                    'Handle large text fields carefully',
                    'Consider encoding for special characters'
                ]
            ),
            'parquet': ExportFormatDoc(
                format_name='parquet',
                description='Columnar storage format optimized for analytical queries and compression',
                file_extension='parquet',
                use_cases=[
                    'Big data analytics with Spark/Dask',
                    'Data warehousing and ETL',
                    'High-performance analytical queries',
                    'Cloud storage optimization'
                ],
                schema_fields=self.doc_generator._generate_parquet_schema(),
                example_record={
                    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
                    "messages_json": '[{"role": "user", "content": "Hello"}]',
                    "quality_score": 0.85
                },
                validation_rules=[
                    'Valid Parquet schema',
                    'Consistent data types',
                    'No null values in required columns',
                    'Proper column metadata'
                ],
                best_practices=[
                    'Use for analytical workloads',
                    'Leverage columnar compression',
                    'Partition large datasets',
                    'Use with Apache Arrow for performance'
                ]
            ),
            'huggingface': ExportFormatDoc(
                format_name='huggingface',
                description='HuggingFace Datasets compatible format for ML model training',
                file_extension='jsonl',
                use_cases=[
                    'Training transformer models',
                    'HuggingFace ecosystem integration',
                    'Research and experimentation',
                    'Model fine-tuning workflows'
                ],
                schema_fields=self.doc_generator._generate_huggingface_schema(),
                example_record={
                    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
                    "messages": [
                        {"role": "user", "content": "Hello"},
                        {"role": "assistant", "content": "Hi there!"}
                    ],
                    "quality_score": 0.85
                },
                validation_rules=[
                    'Compatible with HuggingFace Datasets',
                    'Valid message format',
                    'Consistent field types',
                    'Proper tokenization support'
                ],
                best_practices=[
                    'Use with HuggingFace Datasets library',
                    'Consider tokenization requirements',
                    'Filter by quality for training',
                    'Use dataset streaming for large files'
                ]
            ),
            'openai': ExportFormatDoc(
                format_name='openai',
                description='OpenAI fine-tuning format for GPT model customization',
                file_extension='jsonl',
                use_cases=[
                    'OpenAI GPT fine-tuning',
                    'Chat completion training',
                    'Custom model development',
                    'API-compatible training data'
                ],
                schema_fields=self.doc_generator._generate_openai_schema(),
                example_record={
                    "messages": [
                        {"role": "user", "content": "Hello"},
                        {"role": "assistant", "content": "Hi there!"}
                    ]
                },
                validation_rules=[
                    'OpenAI API compatible format',
                    'Valid role values (user/assistant/system)',
                    'Non-empty message content',
                    'Proper conversation structure'
                ],
                best_practices=[
                    'Use high-quality conversations only',
                    'Follow OpenAI content policies',
                    'Validate before uploading',
                    'Consider token limits'
                ]
            )
        }
        
        return formats
    
    def generate_statistical_report(self, metadata: DatasetMetadata) -> Dict[str, Any]:
        """Generate comprehensive statistical report."""
        
        try:
            with self.database._get_connection() as conn:
                # Conversation length distribution
                cursor = conn.execute("SELECT turn_count FROM conversations WHERE turn_count IS NOT NULL")
                turn_counts = [row[0] for row in cursor.fetchall()]
                
                # Word count distribution
                cursor = conn.execute("SELECT word_count FROM conversations WHERE word_count IS NOT NULL")
                word_counts = [row[0] for row in cursor.fetchall()]
                
                # Quality score distribution
                cursor = conn.execute("SELECT overall_quality FROM conversation_quality WHERE overall_quality IS NOT NULL")
                quality_scores = [row[0] for row in cursor.fetchall()]
                
                # Source distribution
                cursor = conn.execute("SELECT dataset_source, COUNT(*) FROM conversations GROUP BY dataset_source")
                source_distribution = dict(cursor.fetchall())
                
                # Tier distribution
                cursor = conn.execute("SELECT tier, COUNT(*) FROM conversations WHERE tier IS NOT NULL GROUP BY tier")
                tier_distribution = dict(cursor.fetchall())
                
                # Language distribution
                cursor = conn.execute("SELECT language, COUNT(*) FROM conversations WHERE language IS NOT NULL GROUP BY language")
                language_distribution = dict(cursor.fetchall())
                
                # Quality metrics statistics
                quality_metrics = {}
                for metric in ['overall_quality', 'therapeutic_accuracy', 'clinical_compliance', 
                              'safety_score', 'conversation_coherence', 'emotional_authenticity']:
                    cursor = conn.execute(f"SELECT {metric} FROM conversation_quality WHERE {metric} IS NOT NULL")
                    values = [row[0] for row in cursor.fetchall()]
                    if values:
                        quality_metrics[metric] = {
                            'count': len(values),
                            'mean': statistics.mean(values),
                            'median': statistics.median(values),
                            'std': statistics.stdev(values) if len(values) > 1 else 0,
                            'min': min(values),
                            'max': max(values),
                            'percentiles': {
                                '25th': statistics.quantiles(values, n=4)[0] if len(values) >= 4 else min(values),
                                '75th': statistics.quantiles(values, n=4)[2] if len(values) >= 4 else max(values),
                                '90th': statistics.quantiles(values, n=10)[8] if len(values) >= 10 else max(values),
                                '95th': statistics.quantiles(values, n=20)[18] if len(values) >= 20 else max(values)
                            }
                        }
                
                # Tag statistics
                cursor = conn.execute("SELECT tag_value, COUNT(*) FROM conversation_tags WHERE tag_type = 'tag' GROUP BY tag_value ORDER BY COUNT(*) DESC LIMIT 20")
                top_tags = dict(cursor.fetchall())
                
                # Category statistics
                cursor = conn.execute("SELECT tag_value, COUNT(*) FROM conversation_tags WHERE tag_type = 'category' GROUP BY tag_value ORDER BY COUNT(*) DESC")
                category_distribution = dict(cursor.fetchall())
                
                # Technique statistics
                cursor = conn.execute("SELECT tag_value, COUNT(*) FROM conversation_tags WHERE tag_type = 'technique' GROUP BY tag_value ORDER BY COUNT(*) DESC")
                technique_distribution = dict(cursor.fetchall())
                
                report = {
                    'overview': {
                        'total_conversations': metadata.total_conversations,
                        'total_turns': metadata.total_turns,
                        'total_words': metadata.total_words,
                        'total_characters': metadata.total_characters,
                        'average_turns_per_conversation': metadata.total_turns / metadata.total_conversations if metadata.total_conversations > 0 else 0,
                        'average_words_per_conversation': metadata.total_words / metadata.total_conversations if metadata.total_conversations > 0 else 0
                    },
                    'distributions': {
                        'conversation_lengths': {
                            'mean': statistics.mean(turn_counts) if turn_counts else 0,
                            'median': statistics.median(turn_counts) if turn_counts else 0,
                            'std': statistics.stdev(turn_counts) if len(turn_counts) > 1 else 0,
                            'min': min(turn_counts) if turn_counts else 0,
                            'max': max(turn_counts) if turn_counts else 0
                        },
                        'word_counts': {
                            'mean': statistics.mean(word_counts) if word_counts else 0,
                            'median': statistics.median(word_counts) if word_counts else 0,
                            'std': statistics.stdev(word_counts) if len(word_counts) > 1 else 0,
                            'min': min(word_counts) if word_counts else 0,
                            'max': max(word_counts) if word_counts else 0
                        },
                        'sources': source_distribution,
                        'tiers': tier_distribution,
                        'languages': language_distribution
                    },
                    'quality_metrics': quality_metrics,
                    'content_analysis': {
                        'top_tags': top_tags,
                        'categories': category_distribution,
                        'therapeutic_techniques': technique_distribution
                    },
                    'data_quality': {
                        'conversations_with_quality_scores': len(quality_scores),
                        'quality_coverage_percent': (len(quality_scores) / metadata.total_conversations * 100) if metadata.total_conversations > 0 else 0,
                        'high_quality_conversations': len([q for q in quality_scores if q >= 0.8]),
                        'medium_quality_conversations': len([q for q in quality_scores if 0.5 <= q < 0.8]),
                        'low_quality_conversations': len([q for q in quality_scores if q < 0.5])
                    }
                }
                
                return report
                
        except Exception as e:
            print(f"Error generating statistical report: {e}")
            return {}
    
    def generate_complete_documentation(self) -> Dict[str, Path]:
        """Generate complete documentation suite."""
        
        print("📊 Generating dataset metadata...")
        metadata = self.doc_generator.generate_dataset_metadata()
        
        print("📋 Generating schema documentation...")
        schema_docs = self.doc_generator.generate_schema_documentation()
        
        print("📈 Generating quality metrics documentation...")
        quality_metrics = self.doc_generator.generate_quality_metrics_documentation()
        
        print("📤 Generating export format documentation...")
        export_formats = self.generate_export_format_documentation()
        
        print("📊 Generating statistical report...")
        stats_report = self.generate_statistical_report(metadata)
        
        print("📝 Generating documentation files...")
        generated_files = self.template_manager.generate_documentation(
            metadata=metadata,
            schema_docs=schema_docs,
            quality_metrics=quality_metrics,
            export_formats=export_formats
        )
        
        # Generate additional files
        print("📄 Generating additional documentation files...")
        
        # Statistics report
        stats_file = self.output_dir / "statistics_report.json"
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats_report, f, indent=2, default=str)
        generated_files['statistics_report.json'] = stats_file
        
        # Metadata file
        metadata_file = self.output_dir / "dataset_metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata.__dict__, f, indent=2, default=str)
        generated_files['dataset_metadata.json'] = metadata_file
        
        # Schema definitions
        schema_file = self.output_dir / "schema_definitions.json"
        schema_dict = {}
        for format_name, fields in schema_docs.items():
            schema_dict[format_name] = [
                {
                    'name': field.name,
                    'type': field.type,
                    'description': field.description,
                    'required': field.required,
                    'example': field.example,
                    'constraints': field.constraints
                }
                for field in fields
            ]
        
        with open(schema_file, 'w', encoding='utf-8') as f:
            json.dump(schema_dict, f, indent=2, default=str)
        generated_files['schema_definitions.json'] = schema_file
        
        # Create index file
        index_content = f"""# Pixelated Empathy AI Dataset Documentation

Welcome to the comprehensive documentation for the Pixelated Empathy AI therapeutic conversations dataset.

## Documentation Files

### Core Documentation
- [**README**](readme.md) - Dataset overview and getting started guide
- [**Schema Documentation**](schema.md) - Detailed schema for all export formats
- [**Quality Metrics**](quality_metrics.md) - Quality assessment and filtering guide
- [**Usage Guide**](usage_guide.md) - Best practices and code examples

### Technical References
- [**Dataset Metadata**](dataset_metadata.json) - Machine-readable dataset metadata
- [**Schema Definitions**](schema_definitions.json) - JSON schema definitions
- [**Statistics Report**](statistics_report.json) - Comprehensive statistical analysis

## Quick Stats

- **Total Conversations**: {metadata.total_conversations:,}
- **Total Turns**: {metadata.total_turns:,}
- **Total Words**: {metadata.total_words:,}
- **Quality Score Range**: {metadata.quality_score_range['min']:.3f} - {metadata.quality_score_range['max']:.3f}
- **Languages**: {len(metadata.languages)}
- **Data Sources**: {len(metadata.sources)}

## Export Formats Available

{chr(10).join([f"- **{fmt.upper()}**: {doc.description}" for fmt, doc in export_formats.items()])}

## Getting Started

1. Read the [README](readme.md) for an overview
2. Check the [Usage Guide](usage_guide.md) for code examples
3. Review [Quality Metrics](quality_metrics.md) for data filtering
4. Consult [Schema Documentation](schema.md) for technical details

---

*Documentation generated on {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}*
"""
        
        index_file = self.output_dir / "index.md"
        with open(index_file, 'w', encoding='utf-8') as f:
            f.write(index_content)
        generated_files['index.md'] = index_file
        
        return generated_files

def main():
    """Generate comprehensive dataset documentation."""
    print("📚 COMPREHENSIVE DATASET DOCUMENTATION GENERATOR - Task 5.5.3.1")
    print("=" * 70)
    
    # Initialize database and generator
    db = ConversationDatabase()
    doc_generator = ComprehensiveDocumentationGenerator(db)
    
    try:
        # Generate complete documentation
        generated_files = doc_generator.generate_complete_documentation()
        
        print(f"\n✅ Documentation generation completed successfully!")
        print(f"📁 Output directory: {doc_generator.output_dir}")
        print(f"📄 Generated {len(generated_files)} documentation files:")
        
        for filename, filepath in generated_files.items():
            file_size = filepath.stat().st_size / 1024  # KB
            print(f"   - {filename} ({file_size:.1f} KB)")
        
        print(f"\n🌐 View documentation:")
        print(f"   Start with: {doc_generator.output_dir / 'index.md'}")
        print(f"   Main guide: {doc_generator.output_dir / 'readme.md'}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
