#!/usr/bin/env python3
"""
Conversation Metadata and Provenance Tracking System - Task 5.5.3.2

Comprehensive tracking system for conversation metadata and data lineage:
- Complete conversation provenance tracking
- Metadata enrichment and validation
- Data lineage and transformation history
- Source attribution and licensing tracking
- Processing pipeline audit trails
- Quality assessment provenance
- Export and usage tracking
"""

import json
import hashlib
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
import logging

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from enterprise_config import get_config
from enterprise_logging import get_logger
from enterprise_error_handling import handle_error, with_retry

class ProvenanceEventType(Enum):
    """Types of provenance events."""
    CREATED = "created"
    IMPORTED = "imported"
    PROCESSED = "processed"
    TRANSFORMED = "transformed"
    QUALITY_ASSESSED = "quality_assessed"
    TAGGED = "tagged"
    EXPORTED = "exported"
    ACCESSED = "accessed"
    MODIFIED = "modified"
    VALIDATED = "validated"
    ARCHIVED = "archived"

class DataSource(Enum):
    """Data source types."""
    ORIGINAL = "original"
    SYNTHETIC = "synthetic"
    AUGMENTED = "augmented"
    CURATED = "curated"
    IMPORTED = "imported"
    DERIVED = "derived"

@dataclass
class ProvenanceEvent:
    """Individual provenance event record."""
    event_id: str
    conversation_id: str
    event_type: ProvenanceEventType
    timestamp: datetime
    actor: str  # System, user, or process that performed the action
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    input_data_hash: Optional[str] = None
    output_data_hash: Optional[str] = None
    processing_parameters: Dict[str, Any] = field(default_factory=dict)
    quality_metrics: Dict[str, float] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

@dataclass
class ConversationMetadata:
    """Comprehensive conversation metadata."""
    conversation_id: str
    original_id: Optional[str]  # ID from source system
    source_dataset: str
    source_type: DataSource
    created_at: datetime
    last_modified: datetime
    
    # Content metadata
    title: Optional[str]
    summary: Optional[str]
    language: str
    turn_count: int
    word_count: int
    character_count: int
    
    # Quality metadata
    quality_score: float
    quality_tier: int
    quality_assessment_date: Optional[datetime]
    quality_assessor: Optional[str]
    
    # Processing metadata
    processing_version: str
    processing_pipeline: List[str]
    processing_parameters: Dict[str, Any] = field(default_factory=dict)
    
    # Provenance metadata
    data_lineage: List[str] = field(default_factory=list)  # Parent conversation IDs
    derived_from: Optional[str] = None  # Direct parent
    transformation_history: List[str] = field(default_factory=list)
    
    # Attribution metadata
    original_source: Optional[str] = None
    license: Optional[str] = None
    attribution_required: bool = False
    usage_restrictions: List[str] = field(default_factory=list)
    
    # Classification metadata
    tags: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    therapeutic_techniques: List[str] = field(default_factory=list)
    content_warnings: List[str] = field(default_factory=list)
    
    # Technical metadata
    data_format_version: str = "2.0"
    checksum: Optional[str] = None
    file_size_bytes: Optional[int] = None
    compression_used: Optional[str] = None
    
    # Usage tracking
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    export_count: int = 0
    last_exported: Optional[datetime] = None
    
    # Validation metadata
    validation_status: str = "pending"  # pending, valid, invalid, needs_review
    validation_errors: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)
    last_validated: Optional[datetime] = None

@dataclass
class DataLineage:
    """Data lineage tracking for conversation transformations."""
    lineage_id: str
    conversation_id: str
    parent_conversations: List[str]
    transformation_type: str
    transformation_description: str
    transformation_timestamp: datetime
    transformation_actor: str
    input_metadata: Dict[str, Any]
    output_metadata: Dict[str, Any]
    transformation_parameters: Dict[str, Any] = field(default_factory=dict)
    quality_impact: Dict[str, float] = field(default_factory=dict)

class ConversationProvenanceTracker:
    """Main provenance tracking system."""
    
    def __init__(self, database_connection=None):
        self.config = get_config()
        self.logger = get_logger("conversation_provenance")
        self.database = database_connection
        
        # Initialize tracking storage
        self.provenance_events: List[ProvenanceEvent] = []
        self.metadata_cache: Dict[str, ConversationMetadata] = {}
        self.lineage_cache: Dict[str, DataLineage] = {}
        
        self.logger.info("Conversation provenance tracker initialized")
    
    def create_conversation_metadata(self, conversation_id: str, 
                                   source_dataset: str,
                                   conversation_data: Dict[str, Any],
                                   source_type: DataSource = DataSource.ORIGINAL) -> ConversationMetadata:
        """Create comprehensive metadata for a new conversation."""
        
        now = datetime.now(timezone.utc)
        
        # Calculate content statistics
        messages = conversation_data.get('messages', conversation_data.get('conversations', []))
        turn_count = len(messages)
        
        # Calculate word and character counts
        total_words = 0
        total_chars = 0
        for message in messages:
            if isinstance(message, dict):
                content = ""
                if 'content' in message:
                    content = str(message['content'])
                else:
                    # Handle old format
                    for key, value in message.items():
                        if key not in ['role', 'turn_id']:
                            content += str(value) + " "
                
                words = len(content.split())
                total_words += words
                total_chars += len(content)
        
        # Generate content checksum
        content_str = json.dumps(messages, sort_keys=True, ensure_ascii=False)
        checksum = hashlib.sha256(content_str.encode('utf-8')).hexdigest()
        
        # Extract quality information
        quality_score = conversation_data.get('quality_score', 0.0)
        if isinstance(conversation_data.get('quality_metrics'), dict):
            quality_score = conversation_data['quality_metrics'].get('overall_quality', quality_score)
        
        # Determine quality tier
        quality_tier = self._calculate_quality_tier(quality_score)
        
        metadata = ConversationMetadata(
            conversation_id=conversation_id,
            original_id=conversation_data.get('original_id'),
            source_dataset=source_dataset,
            source_type=source_type,
            created_at=now,
            last_modified=now,
            
            # Content metadata
            title=conversation_data.get('title'),
            summary=conversation_data.get('summary'),
            language=conversation_data.get('language', 'en'),
            turn_count=turn_count,
            word_count=total_words,
            character_count=total_chars,
            
            # Quality metadata
            quality_score=quality_score,
            quality_tier=quality_tier,
            quality_assessment_date=now,
            quality_assessor="automated_system",
            
            # Processing metadata
            processing_version=conversation_data.get('processing_version', '1.0'),
            processing_pipeline=conversation_data.get('processing_pipeline', ['import']),
            processing_parameters=conversation_data.get('processing_parameters', {}),
            
            # Technical metadata
            checksum=checksum,
            file_size_bytes=len(content_str.encode('utf-8')),
            
            # Classification metadata
            tags=conversation_data.get('tags', []),
            categories=conversation_data.get('categories', []),
            therapeutic_techniques=conversation_data.get('therapeutic_techniques', []),
            
            # Validation metadata
            validation_status="valid" if quality_score > 0 else "pending"
        )
        
        # Cache metadata
        self.metadata_cache[conversation_id] = metadata
        
        # Record creation event
        self.record_provenance_event(
            conversation_id=conversation_id,
            event_type=ProvenanceEventType.CREATED,
            actor="system",
            description=f"Conversation created from {source_dataset}",
            metadata={
                'source_dataset': source_dataset,
                'source_type': source_type.value,
                'turn_count': turn_count,
                'word_count': total_words
            },
            output_data_hash=checksum
        )
        
        self.logger.info(f"Created metadata for conversation {conversation_id}")
        return metadata
    
    def record_provenance_event(self, conversation_id: str,
                               event_type: ProvenanceEventType,
                               actor: str,
                               description: str,
                               metadata: Dict[str, Any] = None,
                               input_data_hash: str = None,
                               output_data_hash: str = None,
                               processing_parameters: Dict[str, Any] = None,
                               quality_metrics: Dict[str, float] = None,
                               tags: List[str] = None) -> ProvenanceEvent:
        """Record a provenance event."""
        
        event = ProvenanceEvent(
            event_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            actor=actor,
            description=description,
            metadata=metadata or {},
            input_data_hash=input_data_hash,
            output_data_hash=output_data_hash,
            processing_parameters=processing_parameters or {},
            quality_metrics=quality_metrics or {},
            tags=tags or []
        )
        
        self.provenance_events.append(event)
        
        # Update conversation metadata if cached
        if conversation_id in self.metadata_cache:
            self.metadata_cache[conversation_id].last_modified = event.timestamp
        
        self.logger.debug(f"Recorded {event_type.value} event for conversation {conversation_id}")
        return event
    
    def track_transformation(self, parent_conversation_ids: List[str],
                           new_conversation_id: str,
                           transformation_type: str,
                           transformation_description: str,
                           actor: str,
                           transformation_parameters: Dict[str, Any] = None,
                           input_metadata: Dict[str, Any] = None,
                           output_metadata: Dict[str, Any] = None) -> DataLineage:
        """Track data transformation and lineage."""
        
        lineage = DataLineage(
            lineage_id=str(uuid.uuid4()),
            conversation_id=new_conversation_id,
            parent_conversations=parent_conversation_ids,
            transformation_type=transformation_type,
            transformation_description=transformation_description,
            transformation_timestamp=datetime.now(timezone.utc),
            transformation_actor=actor,
            input_metadata=input_metadata or {},
            output_metadata=output_metadata or {},
            transformation_parameters=transformation_parameters or {}
        )
        
        self.lineage_cache[new_conversation_id] = lineage
        
        # Update conversation metadata with lineage information
        if new_conversation_id in self.metadata_cache:
            metadata = self.metadata_cache[new_conversation_id]
            metadata.data_lineage = parent_conversation_ids
            metadata.derived_from = parent_conversation_ids[0] if parent_conversation_ids else None
            metadata.transformation_history.append(transformation_type)
        
        # Record transformation event
        self.record_provenance_event(
            conversation_id=new_conversation_id,
            event_type=ProvenanceEventType.TRANSFORMED,
            actor=actor,
            description=transformation_description,
            metadata={
                'transformation_type': transformation_type,
                'parent_conversations': parent_conversation_ids,
                'transformation_parameters': transformation_parameters or {}
            }
        )
        
        self.logger.info(f"Tracked transformation: {transformation_type} -> {new_conversation_id}")
        return lineage
    
    def update_quality_assessment(self, conversation_id: str,
                                 quality_metrics: Dict[str, float],
                                 assessor: str,
                                 assessment_method: str = "automated") -> None:
        """Update quality assessment with provenance tracking."""
        
        # Update cached metadata
        if conversation_id in self.metadata_cache:
            metadata = self.metadata_cache[conversation_id]
            metadata.quality_score = quality_metrics.get('overall_quality', metadata.quality_score)
            metadata.quality_tier = self._calculate_quality_tier(metadata.quality_score)
            metadata.quality_assessment_date = datetime.now(timezone.utc)
            metadata.quality_assessor = assessor
            metadata.last_modified = datetime.now(timezone.utc)
        
        # Record quality assessment event
        self.record_provenance_event(
            conversation_id=conversation_id,
            event_type=ProvenanceEventType.QUALITY_ASSESSED,
            actor=assessor,
            description=f"Quality assessed using {assessment_method}",
            metadata={
                'assessment_method': assessment_method,
                'quality_tier': self._calculate_quality_tier(quality_metrics.get('overall_quality', 0))
            },
            quality_metrics=quality_metrics
        )
        
        self.logger.info(f"Updated quality assessment for conversation {conversation_id}")
    
    def track_access(self, conversation_id: str, accessor: str, 
                    access_type: str = "read", purpose: str = None) -> None:
        """Track conversation access for usage monitoring."""
        
        # Update cached metadata
        if conversation_id in self.metadata_cache:
            metadata = self.metadata_cache[conversation_id]
            metadata.access_count += 1
            metadata.last_accessed = datetime.now(timezone.utc)
        
        # Record access event
        self.record_provenance_event(
            conversation_id=conversation_id,
            event_type=ProvenanceEventType.ACCESSED,
            actor=accessor,
            description=f"Conversation accessed for {purpose or access_type}",
            metadata={
                'access_type': access_type,
                'purpose': purpose
            }
        )
    
    def track_export(self, conversation_ids: List[str], export_format: str,
                    exporter: str, export_parameters: Dict[str, Any] = None,
                    export_destination: str = None) -> None:
        """Track conversation exports."""
        
        for conversation_id in conversation_ids:
            # Update cached metadata
            if conversation_id in self.metadata_cache:
                metadata = self.metadata_cache[conversation_id]
                metadata.export_count += 1
                metadata.last_exported = datetime.now(timezone.utc)
            
            # Record export event
            self.record_provenance_event(
                conversation_id=conversation_id,
                event_type=ProvenanceEventType.EXPORTED,
                actor=exporter,
                description=f"Exported in {export_format} format",
                metadata={
                    'export_format': export_format,
                    'export_destination': export_destination,
                    'export_parameters': export_parameters or {}
                }
            )
        
        self.logger.info(f"Tracked export of {len(conversation_ids)} conversations in {export_format} format")
    
    def get_conversation_provenance(self, conversation_id: str) -> Dict[str, Any]:
        """Get complete provenance information for a conversation."""
        
        # Get metadata
        metadata = self.metadata_cache.get(conversation_id)
        if not metadata:
            self.logger.warning(f"No metadata found for conversation {conversation_id}")
            return {}
        
        # Get provenance events
        events = [event for event in self.provenance_events if event.conversation_id == conversation_id]
        
        # Get lineage information
        lineage = self.lineage_cache.get(conversation_id)
        
        provenance_info = {
            'conversation_id': conversation_id,
            'metadata': asdict(metadata),
            'provenance_events': [asdict(event) for event in events],
            'lineage': asdict(lineage) if lineage else None,
            'provenance_summary': {
                'total_events': len(events),
                'creation_date': metadata.created_at.isoformat(),
                'last_modified': metadata.last_modified.isoformat(),
                'access_count': metadata.access_count,
                'export_count': metadata.export_count,
                'quality_tier': metadata.quality_tier,
                'has_lineage': lineage is not None,
                'transformation_count': len(metadata.transformation_history)
            }
        }
        
        return provenance_info
    
    def get_data_lineage_tree(self, conversation_id: str, max_depth: int = 10) -> Dict[str, Any]:
        """Get complete data lineage tree for a conversation."""
        
        def build_lineage_node(conv_id: str, depth: int = 0) -> Dict[str, Any]:
            if depth > max_depth:
                return {'conversation_id': conv_id, 'max_depth_reached': True}
            
            metadata = self.metadata_cache.get(conv_id)
            lineage = self.lineage_cache.get(conv_id)
            
            node = {
                'conversation_id': conv_id,
                'depth': depth,
                'metadata': {
                    'source_dataset': metadata.source_dataset if metadata else 'unknown',
                    'source_type': metadata.source_type.value if metadata else 'unknown',
                    'quality_score': metadata.quality_score if metadata else 0,
                    'created_at': metadata.created_at.isoformat() if metadata else None
                },
                'children': []
            }
            
            if lineage and lineage.parent_conversations:
                for parent_id in lineage.parent_conversations:
                    child_node = build_lineage_node(parent_id, depth + 1)
                    node['children'].append(child_node)
            
            return node
        
        return build_lineage_node(conversation_id)
    
    def _calculate_quality_tier(self, quality_score: float) -> int:
        """Calculate quality tier from quality score."""
        if quality_score >= 0.9:
            return 5  # Premium
        elif quality_score >= 0.8:
            return 4  # High
        elif quality_score >= 0.7:
            return 3  # Good
        elif quality_score >= 0.5:
            return 2  # Fair
        else:
            return 1  # Low
    
    def generate_provenance_report(self, conversation_ids: List[str] = None) -> Dict[str, Any]:
        """Generate comprehensive provenance report."""
        
        target_conversations = conversation_ids or list(self.metadata_cache.keys())
        
        # Collect statistics
        total_conversations = len(target_conversations)
        total_events = len([e for e in self.provenance_events if e.conversation_id in target_conversations])
        
        # Event type distribution
        event_type_counts = {}
        for event in self.provenance_events:
            if event.conversation_id in target_conversations:
                event_type = event.event_type.value
                event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
        
        # Source distribution
        source_distribution = {}
        quality_distribution = {'tier_1': 0, 'tier_2': 0, 'tier_3': 0, 'tier_4': 0, 'tier_5': 0}
        
        for conv_id in target_conversations:
            metadata = self.metadata_cache.get(conv_id)
            if metadata:
                source = metadata.source_dataset
                source_distribution[source] = source_distribution.get(source, 0) + 1
                quality_distribution[f'tier_{metadata.quality_tier}'] += 1
        
        # Lineage statistics
        conversations_with_lineage = len([conv_id for conv_id in target_conversations if conv_id in self.lineage_cache])
        
        report = {
            'report_generated': datetime.now(timezone.utc).isoformat(),
            'scope': {
                'total_conversations': total_conversations,
                'conversation_ids': target_conversations[:10] if len(target_conversations) > 10 else target_conversations,
                'truncated': len(target_conversations) > 10
            },
            'provenance_statistics': {
                'total_events': total_events,
                'events_per_conversation': total_events / total_conversations if total_conversations > 0 else 0,
                'event_type_distribution': event_type_counts
            },
            'data_distribution': {
                'source_datasets': source_distribution,
                'quality_tiers': quality_distribution
            },
            'lineage_statistics': {
                'conversations_with_lineage': conversations_with_lineage,
                'lineage_coverage_percent': (conversations_with_lineage / total_conversations * 100) if total_conversations > 0 else 0
            },
            'usage_statistics': {
                'total_accesses': sum(self.metadata_cache[conv_id].access_count for conv_id in target_conversations if conv_id in self.metadata_cache),
                'total_exports': sum(self.metadata_cache[conv_id].export_count for conv_id in target_conversations if conv_id in self.metadata_cache)
            }
        }
        
        return report

def main():
    """Test conversation provenance tracking system."""
    print("🔍 CONVERSATION PROVENANCE TRACKER - Task 5.5.3.2")
    print("=" * 60)
    
    # Initialize tracker
    tracker = ConversationProvenanceTracker()
    
    # Test with sample conversation
    sample_conversation = {
        'messages': [
            {'role': 'user', 'content': 'I feel anxious about my presentation.'},
            {'role': 'assistant', 'content': 'I understand your anxiety. Let me help you prepare.'}
        ],
        'quality_score': 0.85,
        'tags': ['anxiety', 'presentation'],
        'categories': ['mental_health'],
        'therapeutic_techniques': ['cognitive_behavioral_therapy']
    }
    
    conversation_id = "test-conv-001"
    
    # Create metadata
    print("📊 Creating conversation metadata...")
    metadata = tracker.create_conversation_metadata(
        conversation_id=conversation_id,
        source_dataset="test_dataset",
        conversation_data=sample_conversation
    )
    
    print(f"✅ Created metadata for conversation {conversation_id}")
    print(f"   Quality tier: {metadata.quality_tier}")
    print(f"   Word count: {metadata.word_count}")
    print(f"   Checksum: {metadata.checksum[:16]}...")
    
    # Record some events
    print("\n📝 Recording provenance events...")
    tracker.record_provenance_event(
        conversation_id=conversation_id,
        event_type=ProvenanceEventType.PROCESSED,
        actor="quality_assessor",
        description="Automated quality assessment completed",
        quality_metrics={'overall_quality': 0.85}
    )
    
    tracker.track_access(
        conversation_id=conversation_id,
        accessor="researcher_001",
        purpose="model_training"
    )
    
    tracker.track_export(
        conversation_ids=[conversation_id],
        export_format="jsonl",
        exporter="data_scientist",
        export_destination="training_pipeline"
    )
    
    # Get provenance information
    print("\n🔍 Retrieving provenance information...")
    provenance_info = tracker.get_conversation_provenance(conversation_id)
    
    print(f"✅ Provenance summary:")
    summary = provenance_info['provenance_summary']
    print(f"   Total events: {summary['total_events']}")
    print(f"   Access count: {summary['access_count']}")
    print(f"   Export count: {summary['export_count']}")
    print(f"   Quality tier: {summary['quality_tier']}")
    
    # Generate report
    print("\n📋 Generating provenance report...")
    report = tracker.generate_provenance_report([conversation_id])
    
    print(f"✅ Provenance report generated:")
    print(f"   Conversations: {report['scope']['total_conversations']}")
    print(f"   Total events: {report['provenance_statistics']['total_events']}")
    print(f"   Events per conversation: {report['provenance_statistics']['events_per_conversation']:.1f}")
    
    print(f"\n✅ Conversation provenance tracking system implemented!")
    print("✅ Comprehensive metadata tracking")
    print("✅ Complete provenance event logging")
    print("✅ Data lineage and transformation tracking")
    print("✅ Quality assessment provenance")
    print("✅ Usage and access monitoring")
    print("✅ Export tracking and audit trails")

if __name__ == "__main__":
    main()
