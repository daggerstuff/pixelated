#!/usr/bin/env python3
"""
Comprehensive Metadata and Provenance System - Task 5.5.3.2 Part 3

Integration system that combines all metadata and provenance components:
- Complete conversation lifecycle tracking
- Integrated metadata enrichment and validation
- Comprehensive provenance reporting
- Export and usage tracking integration
- Metadata consistency and integrity checking
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from dataclasses import asdict

# Local imports
from conversation_provenance_tracker import (
    ConversationProvenanceTracker, ConversationMetadata, ProvenanceEvent, 
    DataLineage, ProvenanceEventType, DataSource
)
from metadata_enrichment_system import (
    MetadataEnrichmentSystem, MetadataValidationResult, ContentAnalyzer
)

class ComprehensiveMetadataSystem:
    """Complete metadata and provenance management system."""
    
    def __init__(self, database_connection=None):
        # Initialize core components
        self.provenance_tracker = ConversationProvenanceTracker(database_connection)
        self.enrichment_system = MetadataEnrichmentSystem(self.provenance_tracker)
        
        # Integration state
        self.processed_conversations = set()
        self.validation_cache = {}
        
        print("📚 Comprehensive metadata and provenance system initialized")
    
    def process_conversation_complete_lifecycle(self, conversation_id: str,
                                              conversation_data: Dict[str, Any],
                                              source_dataset: str,
                                              source_type: DataSource = DataSource.ORIGINAL) -> Dict[str, Any]:
        """Process complete conversation lifecycle with full metadata and provenance tracking."""
        
        print(f"🔄 Processing complete lifecycle for conversation {conversation_id}")
        
        # Step 1: Create initial metadata with provenance tracking
        metadata = self.provenance_tracker.create_conversation_metadata(
            conversation_id=conversation_id,
            source_dataset=source_dataset,
            conversation_data=conversation_data,
            source_type=source_type
        )
        
        # Step 2: Enrich metadata using content analysis
        enriched_metadata = self.enrichment_system.enrich_conversation_metadata(
            conversation_id=conversation_id,
            conversation_data=conversation_data,
            existing_metadata=metadata
        )
        
        # Step 3: Validate enriched metadata
        validation_result = self.enrichment_system.validate_metadata(enriched_metadata)
        self.validation_cache[conversation_id] = validation_result
        
        # Step 4: Update metadata based on validation
        enriched_metadata.validation_status = "valid" if validation_result.is_valid else "invalid"
        enriched_metadata.validation_errors = validation_result.errors
        enriched_metadata.validation_warnings = validation_result.warnings
        enriched_metadata.last_validated = validation_result.validation_timestamp
        
        # Step 5: Update provenance tracker cache
        self.provenance_tracker.metadata_cache[conversation_id] = enriched_metadata
        
        # Step 6: Mark as processed
        self.processed_conversations.add(conversation_id)
        
        # Return comprehensive result
        result = {
            'conversation_id': conversation_id,
            'processing_status': 'completed',
            'metadata': asdict(enriched_metadata),
            'validation_result': asdict(validation_result),
            'provenance_events_count': len([e for e in self.provenance_tracker.provenance_events 
                                          if e.conversation_id == conversation_id]),
            'processing_timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        print(f"✅ Completed lifecycle processing for conversation {conversation_id}")
        return result
    
    def get_comprehensive_conversation_info(self, conversation_id: str) -> Dict[str, Any]:
        """Get complete information about a conversation including metadata and provenance."""
        
        # Get provenance information
        provenance_info = self.provenance_tracker.get_conversation_provenance(conversation_id)
        
        # Get validation information
        validation_info = self.validation_cache.get(conversation_id)
        
        # Get lineage tree
        lineage_tree = self.provenance_tracker.get_data_lineage_tree(conversation_id)
        
        comprehensive_info = {
            'conversation_id': conversation_id,
            'provenance': provenance_info,
            'validation': asdict(validation_info) if validation_info else None,
            'lineage_tree': lineage_tree,
            'processing_status': {
                'is_processed': conversation_id in self.processed_conversations,
                'has_validation': conversation_id in self.validation_cache,
                'has_provenance': len(provenance_info.get('provenance_events', [])) > 0,
                'has_lineage': lineage_tree.get('children', []) != []
            }
        }
        
        return comprehensive_info
    
    def generate_metadata_quality_report(self, conversation_ids: List[str] = None) -> Dict[str, Any]:
        """Generate comprehensive metadata quality report."""
        
        target_conversations = conversation_ids or list(self.processed_conversations)
        
        # Collect metadata quality statistics
        quality_stats = {
            'total_conversations': len(target_conversations),
            'validation_summary': {
                'valid_conversations': 0,
                'invalid_conversations': 0,
                'pending_validation': 0,
                'total_errors': 0,
                'total_warnings': 0
            },
            'metadata_completeness': {
                'with_tags': 0,
                'with_categories': 0,
                'with_techniques': 0,
                'with_content_warnings': 0,
                'with_quality_scores': 0
            },
            'quality_distribution': {
                'tier_1': 0, 'tier_2': 0, 'tier_3': 0, 'tier_4': 0, 'tier_5': 0
            },
            'content_analysis_summary': {
                'total_techniques_detected': 0,
                'total_categories_assigned': 0,
                'total_warnings_flagged': 0
            }
        }
        
        for conv_id in target_conversations:
            # Get metadata
            metadata = self.provenance_tracker.metadata_cache.get(conv_id)
            if not metadata:
                continue
            
            # Validation statistics
            validation = self.validation_cache.get(conv_id)
            if validation:
                if validation.is_valid:
                    quality_stats['validation_summary']['valid_conversations'] += 1
                else:
                    quality_stats['validation_summary']['invalid_conversations'] += 1
                
                quality_stats['validation_summary']['total_errors'] += len(validation.errors)
                quality_stats['validation_summary']['total_warnings'] += len(validation.warnings)
            else:
                quality_stats['validation_summary']['pending_validation'] += 1
            
            # Completeness statistics
            if metadata.tags:
                quality_stats['metadata_completeness']['with_tags'] += 1
            if metadata.categories:
                quality_stats['metadata_completeness']['with_categories'] += 1
            if metadata.therapeutic_techniques:
                quality_stats['metadata_completeness']['with_techniques'] += 1
            if metadata.content_warnings:
                quality_stats['metadata_completeness']['with_content_warnings'] += 1
            if metadata.quality_score > 0:
                quality_stats['metadata_completeness']['with_quality_scores'] += 1
            
            # Quality tier distribution
            tier_key = f'tier_{metadata.quality_tier}'
            if tier_key in quality_stats['quality_distribution']:
                quality_stats['quality_distribution'][tier_key] += 1
            
            # Content analysis summary
            quality_stats['content_analysis_summary']['total_techniques_detected'] += len(metadata.therapeutic_techniques)
            quality_stats['content_analysis_summary']['total_categories_assigned'] += len(metadata.categories)
            quality_stats['content_analysis_summary']['total_warnings_flagged'] += len(metadata.content_warnings)
        
        # Calculate percentages
        total = quality_stats['total_conversations']
        if total > 0:
            quality_stats['validation_summary']['validation_rate'] = (
                quality_stats['validation_summary']['valid_conversations'] / total * 100
            )
            quality_stats['metadata_completeness']['completeness_rate'] = (
                quality_stats['metadata_completeness']['with_quality_scores'] / total * 100
            )
        
        # Add recommendations
        recommendations = []
        
        if quality_stats['validation_summary']['invalid_conversations'] > 0:
            recommendations.append(f"Review {quality_stats['validation_summary']['invalid_conversations']} conversations with validation errors")
        
        if quality_stats['validation_summary']['pending_validation'] > 0:
            recommendations.append(f"Complete validation for {quality_stats['validation_summary']['pending_validation']} pending conversations")
        
        if quality_stats['metadata_completeness']['with_quality_scores'] < total * 0.9:
            recommendations.append("Improve quality score coverage - currently below 90%")
        
        quality_stats['recommendations'] = recommendations
        quality_stats['report_generated'] = datetime.now(timezone.utc).isoformat()
        
        return quality_stats
    
    def export_comprehensive_metadata(self, conversation_ids: List[str] = None,
                                    output_format: str = "json") -> Dict[str, Any]:
        """Export comprehensive metadata and provenance information."""
        
        target_conversations = conversation_ids or list(self.processed_conversations)
        
        export_data = {
            'export_metadata': {
                'export_timestamp': datetime.now(timezone.utc).isoformat(),
                'total_conversations': len(target_conversations),
                'export_format': output_format,
                'system_version': '1.0.0'
            },
            'conversations': []
        }
        
        for conv_id in target_conversations:
            conversation_info = self.get_comprehensive_conversation_info(conv_id)
            export_data['conversations'].append(conversation_info)
        
        # Track export in provenance
        self.provenance_tracker.track_export(
            conversation_ids=target_conversations,
            export_format=f"metadata_{output_format}",
            exporter="comprehensive_metadata_system",
            export_parameters={'include_provenance': True, 'include_validation': True}
        )
        
        return export_data
    
    def perform_metadata_integrity_check(self) -> Dict[str, Any]:
        """Perform comprehensive metadata integrity check."""
        
        integrity_report = {
            'check_timestamp': datetime.now(timezone.utc).isoformat(),
            'total_conversations_checked': len(self.processed_conversations),
            'integrity_issues': [],
            'statistics': {
                'conversations_with_issues': 0,
                'total_issues_found': 0,
                'critical_issues': 0,
                'warning_issues': 0
            }
        }
        
        for conv_id in self.processed_conversations:
            conversation_issues = []
            
            # Check metadata existence
            metadata = self.provenance_tracker.metadata_cache.get(conv_id)
            if not metadata:
                conversation_issues.append({
                    'type': 'critical',
                    'issue': 'missing_metadata',
                    'description': 'Conversation metadata not found in cache'
                })
            else:
                # Check metadata consistency
                if metadata.turn_count <= 0:
                    conversation_issues.append({
                        'type': 'critical',
                        'issue': 'invalid_turn_count',
                        'description': f'Turn count is {metadata.turn_count}, should be > 0'
                    })
                
                if metadata.quality_score < 0 or metadata.quality_score > 1:
                    conversation_issues.append({
                        'type': 'critical',
                        'issue': 'invalid_quality_score',
                        'description': f'Quality score {metadata.quality_score} outside valid range [0,1]'
                    })
                
                if metadata.quality_tier < 1 or metadata.quality_tier > 5:
                    conversation_issues.append({
                        'type': 'warning',
                        'issue': 'invalid_quality_tier',
                        'description': f'Quality tier {metadata.quality_tier} outside valid range [1,5]'
                    })
                
                # Check checksum consistency
                if not metadata.checksum:
                    conversation_issues.append({
                        'type': 'warning',
                        'issue': 'missing_checksum',
                        'description': 'Conversation checksum not calculated'
                    })
            
            # Check validation status
            validation = self.validation_cache.get(conv_id)
            if not validation:
                conversation_issues.append({
                    'type': 'warning',
                    'issue': 'missing_validation',
                    'description': 'Conversation has not been validated'
                })
            elif not validation.is_valid and metadata and metadata.validation_status == 'valid':
                conversation_issues.append({
                    'type': 'critical',
                    'issue': 'validation_status_mismatch',
                    'description': 'Validation result and metadata status do not match'
                })
            
            # Check provenance events
            events = [e for e in self.provenance_tracker.provenance_events if e.conversation_id == conv_id]
            if not events:
                conversation_issues.append({
                    'type': 'warning',
                    'issue': 'no_provenance_events',
                    'description': 'No provenance events recorded for conversation'
                })
            
            # Add conversation issues to report
            if conversation_issues:
                integrity_report['integrity_issues'].append({
                    'conversation_id': conv_id,
                    'issues': conversation_issues
                })
                
                integrity_report['statistics']['conversations_with_issues'] += 1
                integrity_report['statistics']['total_issues_found'] += len(conversation_issues)
                
                for issue in conversation_issues:
                    if issue['type'] == 'critical':
                        integrity_report['statistics']['critical_issues'] += 1
                    elif issue['type'] == 'warning':
                        integrity_report['statistics']['warning_issues'] += 1
        
        # Calculate integrity score
        total_conversations = len(self.processed_conversations)
        if total_conversations > 0:
            integrity_score = (
                (total_conversations - integrity_report['statistics']['conversations_with_issues']) 
                / total_conversations * 100
            )
            integrity_report['integrity_score_percent'] = integrity_score
        else:
            integrity_report['integrity_score_percent'] = 100.0
        
        return integrity_report

def main():
    """Test comprehensive metadata and provenance system."""
    print("📚 COMPREHENSIVE METADATA AND PROVENANCE SYSTEM - Task 5.5.3.2")
    print("=" * 70)
    
    # Initialize comprehensive system
    metadata_system = ComprehensiveMetadataSystem()
    
    # Test with sample conversations
    sample_conversations = [
        {
            'conversation_id': 'test-conv-001',
            'messages': [
                {'role': 'user', 'content': 'I feel anxious about my presentation tomorrow.'},
                {'role': 'assistant', 'content': 'Let\'s work on some cognitive behavioral techniques to help manage your anxiety.'}
            ],
            'quality_score': 0.85,
            'tags': ['anxiety'],
            'source_dataset': 'professional_psychology'
        },
        {
            'conversation_id': 'test-conv-002', 
            'messages': [
                {'role': 'user', 'content': 'I\'ve been feeling depressed lately and having trouble sleeping.'},
                {'role': 'assistant', 'content': 'Depression can definitely affect sleep patterns. Let\'s explore some mindfulness techniques.'}
            ],
            'quality_score': 0.78,
            'tags': ['depression', 'sleep'],
            'source_dataset': 'cot_reasoning'
        }
    ]
    
    # Process complete lifecycle for each conversation
    print("🔄 Processing conversation lifecycles...")
    processed_results = []
    
    for conv_data in sample_conversations:
        result = metadata_system.process_conversation_complete_lifecycle(
            conversation_id=conv_data['conversation_id'],
            conversation_data=conv_data,
            source_dataset=conv_data['source_dataset']
        )
        processed_results.append(result)
    
    print(f"✅ Processed {len(processed_results)} conversations")
    
    # Test comprehensive information retrieval
    print("\n📊 Retrieving comprehensive conversation information...")
    for conv_data in sample_conversations:
        conv_info = metadata_system.get_comprehensive_conversation_info(conv_data['conversation_id'])
        
        print(f"\n📋 Conversation {conv_data['conversation_id']}:")
        status = conv_info['processing_status']
        print(f"   Processed: {status['is_processed']}")
        print(f"   Validated: {status['has_validation']}")
        print(f"   Provenance events: {len(conv_info['provenance']['provenance_events'])}")
        
        if conv_info['validation']:
            validation = conv_info['validation']
            print(f"   Validation status: {'✅ Valid' if validation['is_valid'] else '❌ Invalid'}")
            if validation['errors']:
                print(f"   Validation errors: {len(validation['errors'])}")
    
    # Generate metadata quality report
    print("\n📈 Generating metadata quality report...")
    quality_report = metadata_system.generate_metadata_quality_report()
    
    print(f"✅ Quality report generated:")
    print(f"   Total conversations: {quality_report['total_conversations']}")
    print(f"   Valid conversations: {quality_report['validation_summary']['valid_conversations']}")
    print(f"   Validation rate: {quality_report['validation_summary'].get('validation_rate', 0):.1f}%")
    print(f"   Completeness rate: {quality_report['metadata_completeness'].get('completeness_rate', 0):.1f}%")
    
    # Perform integrity check
    print("\n🔍 Performing metadata integrity check...")
    integrity_report = metadata_system.perform_metadata_integrity_check()
    
    print(f"✅ Integrity check completed:")
    print(f"   Conversations checked: {integrity_report['total_conversations_checked']}")
    print(f"   Integrity score: {integrity_report['integrity_score_percent']:.1f}%")
    print(f"   Issues found: {integrity_report['statistics']['total_issues_found']}")
    print(f"   Critical issues: {integrity_report['statistics']['critical_issues']}")
    
    # Export comprehensive metadata
    print("\n📤 Exporting comprehensive metadata...")
    export_data = metadata_system.export_comprehensive_metadata()
    
    print(f"✅ Metadata export completed:")
    print(f"   Conversations exported: {export_data['export_metadata']['total_conversations']}")
    print(f"   Export format: {export_data['export_metadata']['export_format']}")
    
    print(f"\n✅ Comprehensive metadata and provenance system fully implemented!")
    print("✅ Complete conversation lifecycle tracking")
    print("✅ Integrated metadata enrichment and validation")
    print("✅ Comprehensive provenance reporting")
    print("✅ Metadata quality assessment")
    print("✅ Integrity checking and monitoring")
    print("✅ Export and usage tracking")
    print("✅ Data lineage and transformation tracking")

if __name__ == "__main__":
    main()
