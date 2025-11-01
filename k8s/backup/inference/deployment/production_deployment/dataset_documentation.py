#!/usr/bin/env python3
"""
Dataset Documentation System - Task 5.5.3.1

Comprehensive documentation system for Pixelated Empathy AI datasets:
- Dataset overview and structure documentation
- Schema documentation with examples
- Quality metrics and validation documentation
- Usage guidelines and best practices
- Statistical analysis and reports
- Export format documentation
- Integration guides and examples
"""

import json
import yaml
import markdown
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from jinja2 import Template, Environment, FileSystemLoader
import pandas as pd
import numpy as np
from collections import Counter, defaultdict

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from enterprise_config import get_config
from enterprise_logging import get_logger
from enterprise_error_handling import handle_error, with_retry

# Local imports
from conversation_database import ConversationDatabase
from export_validator import ExportValidator
from dataset_exporter import DatasetExporter

@dataclass
class DatasetMetadata:
    """Comprehensive dataset metadata."""
    name: str
    version: str
    description: str
    created_date: datetime
    last_updated: datetime
    total_conversations: int
    total_turns: int
    total_words: int
    total_characters: int
    languages: List[str]
    sources: List[str]
    tiers: List[str]
    quality_score_range: Dict[str, float]
    schema_version: str
    license: str
    contact_info: Dict[str, str]
    tags: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    therapeutic_techniques: List[str] = field(default_factory=list)

@dataclass
class SchemaField:
    """Documentation for a schema field."""
    name: str
    type: str
    description: str
    required: bool
    example: Any
    constraints: Optional[Dict[str, Any]] = None
    nested_fields: Optional[List['SchemaField']] = None

@dataclass
class ExportFormatDoc:
    """Documentation for an export format."""
    format_name: str
    description: str
    file_extension: str
    use_cases: List[str]
    schema_fields: List[SchemaField]
    example_record: Dict[str, Any]
    validation_rules: List[str]
    best_practices: List[str]

@dataclass
class QualityMetricDoc:
    """Documentation for quality metrics."""
    metric_name: str
    description: str
    range: Dict[str, float]
    calculation_method: str
    interpretation: str
    examples: List[Dict[str, Any]]

class DatasetDocumentationGenerator:
    """Generates comprehensive dataset documentation."""
    
    def __init__(self, database: ConversationDatabase):
        self.config = get_config()
        self.logger = get_logger("dataset_documentation")
        self.database = database
        self.validator = ExportValidator()
        
        # Initialize Jinja2 environment for templates
        template_dir = Path(__file__).parent / "templates"
        template_dir.mkdir(exist_ok=True)
        self.jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))
        
        self.logger.info("Dataset documentation generator initialized")
    
    def generate_dataset_metadata(self) -> DatasetMetadata:
        """Generate comprehensive dataset metadata."""
        self.logger.info("Generating dataset metadata...")
        
        try:
            with self.database._get_connection() as conn:
                # Basic statistics
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_conversations,
                        SUM(turn_count) as total_turns,
                        SUM(word_count) as total_words,
                        SUM(character_count) as total_characters,
                        MIN(created_at) as earliest_date,
                        MAX(created_at) as latest_date
                    FROM conversations
                """)
                stats = cursor.fetchone()
                
                # Languages
                cursor = conn.execute("SELECT DISTINCT language FROM conversations WHERE language IS NOT NULL")
                languages = [row[0] for row in cursor.fetchall()]
                
                # Sources
                cursor = conn.execute("SELECT DISTINCT dataset_source FROM conversations")
                sources = [row[0] for row in cursor.fetchall()]
                
                # Tiers
                cursor = conn.execute("SELECT DISTINCT tier FROM conversations WHERE tier IS NOT NULL")
                tiers = [str(row[0]) for row in cursor.fetchall()]
                
                # Quality score range
                cursor = conn.execute("""
                    SELECT 
                        MIN(overall_quality) as min_quality,
                        MAX(overall_quality) as max_quality,
                        AVG(overall_quality) as avg_quality
                    FROM conversation_quality
                    WHERE overall_quality IS NOT NULL
                """)
                quality_stats = cursor.fetchone()
                
                # Tags and categories
                cursor = conn.execute("SELECT DISTINCT tag_value FROM conversation_tags WHERE tag_type = 'tag'")
                tags = [row[0] for row in cursor.fetchall()]
                
                cursor = conn.execute("SELECT DISTINCT tag_value FROM conversation_tags WHERE tag_type = 'category'")
                categories = [row[0] for row in cursor.fetchall()]
                
                cursor = conn.execute("SELECT DISTINCT tag_value FROM conversation_tags WHERE tag_type = 'technique'")
                techniques = [row[0] for row in cursor.fetchall()]
            
            metadata = DatasetMetadata(
                name="Pixelated Empathy AI Therapeutic Conversations",
                version="1.0.0",
                description="Comprehensive dataset of therapeutic conversations for AI training and research",
                created_date=datetime.fromisoformat(stats[4]) if stats[4] else datetime.now(timezone.utc),
                last_updated=datetime.fromisoformat(stats[5]) if stats[5] else datetime.now(timezone.utc),
                total_conversations=stats[0] or 0,
                total_turns=stats[1] or 0,
                total_words=stats[2] or 0,
                total_characters=stats[3] or 0,
                languages=languages,
                sources=sources,
                tiers=tiers,
                quality_score_range={
                    'min': quality_stats[0] or 0.0,
                    'max': quality_stats[1] or 1.0,
                    'average': quality_stats[2] or 0.0
                },
                schema_version="2.0",
                license="Proprietary - Pixelated Empathy AI",
                contact_info={
                    'organization': 'Pixelated Empathy AI',
                    'email': 'data@pixelated-empathy.ai',
                    'website': 'https://pixelated-empathy.ai'
                },
                tags=tags[:50],  # Limit to top 50 tags
                categories=categories,
                therapeutic_techniques=techniques
            )
            
            self.logger.info(f"Generated metadata for {metadata.total_conversations} conversations")
            return metadata
            
        except Exception as e:
            handle_error(e, "dataset_documentation", {
                "operation": "generate_dataset_metadata"
            })
            raise
    
    def generate_schema_documentation(self) -> Dict[str, List[SchemaField]]:
        """Generate comprehensive schema documentation for all export formats."""
        self.logger.info("Generating schema documentation...")
        
        schema_docs = {
            'jsonl': self._generate_jsonl_schema(),
            'csv': self._generate_csv_schema(),
            'parquet': self._generate_parquet_schema(),
            'huggingface': self._generate_huggingface_schema(),
            'openai': self._generate_openai_schema()
        }
        
        return schema_docs
    
    def _generate_jsonl_schema(self) -> List[SchemaField]:
        """Generate JSONL schema documentation."""
        return [
            SchemaField(
                name="conversation_id",
                type="string",
                description="Unique identifier for the conversation",
                required=True,
                example="550e8400-e29b-41d4-a716-446655440000",
                constraints={"format": "UUID v4"}
            ),
            SchemaField(
                name="messages",
                type="array",
                description="Array of conversation messages in chronological order",
                required=True,
                example=[
                    {"role": "user", "content": "I'm feeling anxious about my presentation."},
                    {"role": "assistant", "content": "I understand that presentations can be anxiety-provoking..."}
                ],
                nested_fields=[
                    SchemaField(
                        name="role",
                        type="string",
                        description="Role of the message sender",
                        required=True,
                        example="user",
                        constraints={"enum": ["user", "assistant"]}
                    ),
                    SchemaField(
                        name="content",
                        type="string",
                        description="Content of the message",
                        required=True,
                        example="I'm feeling anxious about my presentation.",
                        constraints={"min_length": 1, "max_length": 10000}
                    )
                ]
            ),
            SchemaField(
                name="quality_score",
                type="number",
                description="Overall quality score for the conversation",
                required=True,
                example=0.85,
                constraints={"minimum": 0.0, "maximum": 1.0}
            ),
            SchemaField(
                name="metadata",
                type="object",
                description="Additional metadata about the conversation",
                required=False,
                example={
                    "dataset_source": "professional_psychology",
                    "tier": 2,
                    "language": "en",
                    "created_at": "2025-08-03T14:30:00Z"
                },
                nested_fields=[
                    SchemaField(
                        name="dataset_source",
                        type="string",
                        description="Source dataset identifier",
                        required=False,
                        example="professional_psychology"
                    ),
                    SchemaField(
                        name="tier",
                        type="integer",
                        description="Quality tier (1-5, higher is better)",
                        required=False,
                        example=2,
                        constraints={"minimum": 1, "maximum": 5}
                    ),
                    SchemaField(
                        name="language",
                        type="string",
                        description="Language code (ISO 639-1)",
                        required=False,
                        example="en",
                        constraints={"format": "ISO 639-1"}
                    )
                ]
            ),
            SchemaField(
                name="tags",
                type="array",
                description="Array of tags associated with the conversation",
                required=False,
                example=["anxiety", "presentation", "coping_strategies"],
                nested_fields=[
                    SchemaField(
                        name="tag",
                        type="string",
                        description="Individual tag",
                        required=False,
                        example="anxiety"
                    )
                ]
            )
        ]
    
    def _generate_csv_schema(self) -> List[SchemaField]:
        """Generate CSV schema documentation."""
        return [
            SchemaField(
                name="conversation_id",
                type="string",
                description="Unique identifier for the conversation",
                required=True,
                example="550e8400-e29b-41d4-a716-446655440000"
            ),
            SchemaField(
                name="messages_json",
                type="string",
                description="JSON-encoded array of conversation messages",
                required=True,
                example='[{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]'
            ),
            SchemaField(
                name="quality_score",
                type="number",
                description="Overall quality score for the conversation",
                required=True,
                example=0.85
            ),
            SchemaField(
                name="metadata_json",
                type="string",
                description="JSON-encoded metadata object",
                required=False,
                example='{"dataset_source": "professional_psychology", "tier": 2}'
            ),
            SchemaField(
                name="tags_json",
                type="string",
                description="JSON-encoded tags and categories",
                required=False,
                example='{"tags": ["anxiety"], "categories": ["mental_health"]}'
            )
        ]
    
    def _generate_parquet_schema(self) -> List[SchemaField]:
        """Generate Parquet schema documentation."""
        return self._generate_csv_schema()  # Same structure as CSV
    
    def _generate_huggingface_schema(self) -> List[SchemaField]:
        """Generate HuggingFace schema documentation."""
        return self._generate_jsonl_schema()  # Same structure as JSONL
    
    def _generate_openai_schema(self) -> List[SchemaField]:
        """Generate OpenAI schema documentation."""
        return [
            SchemaField(
                name="messages",
                type="array",
                description="Array of conversation messages in OpenAI chat format",
                required=True,
                example=[
                    {"role": "user", "content": "I'm feeling anxious."},
                    {"role": "assistant", "content": "I understand your feelings..."}
                ],
                nested_fields=[
                    SchemaField(
                        name="role",
                        type="string",
                        description="Role of the message sender",
                        required=True,
                        example="user",
                        constraints={"enum": ["user", "assistant", "system"]}
                    ),
                    SchemaField(
                        name="content",
                        type="string",
                        description="Content of the message",
                        required=True,
                        example="I'm feeling anxious."
                    )
                ]
            ),
            SchemaField(
                name="conversation_id",
                type="string",
                description="Unique identifier for the conversation",
                required=False,
                example="550e8400-e29b-41d4-a716-446655440000"
            )
        ]
    
    def generate_quality_metrics_documentation(self) -> List[QualityMetricDoc]:
        """Generate documentation for quality metrics."""
        self.logger.info("Generating quality metrics documentation...")
        
        return [
            QualityMetricDoc(
                metric_name="overall_quality",
                description="Comprehensive quality assessment of the entire conversation",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Weighted average of all individual quality metrics",
                interpretation="Higher scores indicate better overall conversation quality. Scores above 0.8 are considered high quality.",
                examples=[
                    {"score": 0.95, "interpretation": "Excellent quality conversation with strong therapeutic value"},
                    {"score": 0.75, "interpretation": "Good quality conversation with minor issues"},
                    {"score": 0.45, "interpretation": "Below average quality, may need review"}
                ]
            ),
            QualityMetricDoc(
                metric_name="therapeutic_accuracy",
                description="Accuracy of therapeutic techniques and interventions used",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Assessment of evidence-based therapeutic approaches and their appropriate application",
                interpretation="Measures how well the conversation follows established therapeutic practices",
                examples=[
                    {"score": 0.90, "interpretation": "Excellent use of therapeutic techniques"},
                    {"score": 0.60, "interpretation": "Adequate therapeutic approach with room for improvement"}
                ]
            ),
            QualityMetricDoc(
                metric_name="clinical_compliance",
                description="Adherence to clinical guidelines and ethical standards",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Evaluation of compliance with clinical best practices and ethical guidelines",
                interpretation="Higher scores indicate better adherence to professional standards",
                examples=[
                    {"score": 0.95, "interpretation": "Excellent clinical compliance"},
                    {"score": 0.70, "interpretation": "Good compliance with minor deviations"}
                ]
            ),
            QualityMetricDoc(
                metric_name="safety_score",
                description="Assessment of conversation safety and risk factors",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Evaluation of potential harm, inappropriate content, or safety concerns",
                interpretation="Higher scores indicate safer conversations. Scores below 0.5 may require review.",
                examples=[
                    {"score": 0.98, "interpretation": "Very safe conversation with no concerns"},
                    {"score": 0.40, "interpretation": "Safety concerns present, requires review"}
                ]
            ),
            QualityMetricDoc(
                metric_name="conversation_coherence",
                description="Logical flow and coherence of the conversation",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Assessment of conversation structure, topic consistency, and logical progression",
                interpretation="Measures how well the conversation flows and maintains coherence",
                examples=[
                    {"score": 0.85, "interpretation": "Well-structured, coherent conversation"},
                    {"score": 0.55, "interpretation": "Some coherence issues, may jump between topics"}
                ]
            ),
            QualityMetricDoc(
                metric_name="emotional_authenticity",
                description="Authenticity and appropriateness of emotional responses",
                range={"min": 0.0, "max": 1.0},
                calculation_method="Evaluation of emotional intelligence, empathy, and appropriate emotional responses",
                interpretation="Higher scores indicate more authentic and appropriate emotional engagement",
                examples=[
                    {"score": 0.90, "interpretation": "Highly authentic emotional responses"},
                    {"score": 0.65, "interpretation": "Generally appropriate with some artificial responses"}
                ]
            )
        ]

def main():
    """Test dataset documentation generation."""
    print("📚 DATASET DOCUMENTATION GENERATOR - Task 5.5.3.1")
    print("=" * 60)
    
    # Initialize database and documentation generator
    db = ConversationDatabase()
    doc_generator = DatasetDocumentationGenerator(db)
    
    try:
        # Generate dataset metadata
        print("📊 Generating dataset metadata...")
        metadata = doc_generator.generate_dataset_metadata()
        print(f"✅ Dataset: {metadata.name}")
        print(f"   Version: {metadata.version}")
        print(f"   Conversations: {metadata.total_conversations:,}")
        print(f"   Total turns: {metadata.total_turns:,}")
        print(f"   Total words: {metadata.total_words:,}")
        print(f"   Languages: {', '.join(metadata.languages)}")
        print(f"   Sources: {len(metadata.sources)} datasets")
        print(f"   Quality range: {metadata.quality_score_range['min']:.3f} - {metadata.quality_score_range['max']:.3f}")
        
        # Generate schema documentation
        print(f"\n📋 Generating schema documentation...")
        schema_docs = doc_generator.generate_schema_documentation()
        print(f"✅ Generated schema docs for {len(schema_docs)} formats:")
        for format_name, fields in schema_docs.items():
            print(f"   {format_name}: {len(fields)} fields documented")
        
        # Generate quality metrics documentation
        print(f"\n📈 Generating quality metrics documentation...")
        quality_docs = doc_generator.generate_quality_metrics_documentation()
        print(f"✅ Generated documentation for {len(quality_docs)} quality metrics:")
        for metric in quality_docs:
            print(f"   {metric.metric_name}: {metric.range['min']}-{metric.range['max']}")
        
        print(f"\n✅ Dataset documentation generation completed successfully!")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
