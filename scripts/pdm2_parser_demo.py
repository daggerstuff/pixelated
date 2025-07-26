#!/usr/bin/env python3
"""
PDM-2 Parser Demo Script

This script demonstrates the capabilities of the PDM-2 (Psychodynamic Diagnostic Manual)
parser for psychology knowledge integration pipeline.

Features demonstrated:
- Attachment pattern parsing and analysis
- Defense mechanism categorization
- Psychodynamic pattern exploration
- Conversation template generation
- JSON export/import functionality
- Knowledge base statistics
"""

import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.pdm2_parser import (
    PDM2Parser, AttachmentStyle, DefenseMechanismLevel, PsychodynamicDomain
)


def main():
    """Run the PDM-2 parser demonstration."""
    print("=" * 80)
    print("PDM-2 Parser Demo")
    print("=" * 80)
    
    # 1. Initialize Parser
    print("\n1. Initializing PDM-2 Parser...")
    parser = PDM2Parser()
    print("✓ Parser initialized with psychodynamic concepts")
    
    # 2. Knowledge Base Statistics
    print("\n2. Knowledge Base Statistics:")
    stats = parser.get_statistics()
    print(f"   Total Attachment Patterns: {stats['total_attachment_patterns']}")
    print(f"   Total Defense Mechanisms: {stats['total_defense_mechanisms']}")
    print(f"   Total Psychodynamic Patterns: {stats['total_psychodynamic_patterns']}")
    print(f"   Version: {stats['version']}")
    
    print("   Defense Mechanisms by Level:")
    for level, count in stats['defense_mechanisms_by_level'].items():
        print(f"     - {level}: {count} mechanisms")
    
    print("   Psychodynamic Patterns by Domain:")
    for domain, count in stats['psychodynamic_patterns_by_domain'].items():
        print(f"     - {domain}: {count} patterns")
    
    # 3. Attachment Patterns
    print("\n3. Available Attachment Patterns:")
    attachment_patterns = parser.get_attachment_patterns()
    for i, pattern in enumerate(attachment_patterns, 1):
        print(f"   {i}. {pattern.name} ({pattern.style.value})")
        print(f"      Description: {pattern.description}")
        print(f"      Characteristics: {len(pattern.characteristics)} items")
    
    # 4. Defense Mechanisms
    print("\n4. Defense Mechanisms by Level:")
    for level in DefenseMechanismLevel:
        mechanisms = parser.get_defense_mechanisms_by_level(level)
        print(f"   {level.value.title()} Defenses ({len(mechanisms)} mechanisms):")
        for mechanism in mechanisms:
            print(f"     - {mechanism.name}: {mechanism.description}")
    
    # 5. Psychodynamic Patterns
    print("\n5. Psychodynamic Patterns by Domain:")
    for domain in PsychodynamicDomain:
        patterns = parser.get_psychodynamic_patterns_by_domain(domain)
        if patterns:
            print(f"   {domain.value.replace('_', ' ').title()} ({len(patterns)} patterns):")
            for pattern in patterns:
                print(f"     - {pattern.name}: {pattern.description}")
    
    # 6. Detailed Attachment Pattern Example
    print("\n6. Detailed Attachment Pattern (Secure Attachment):")
    secure_pattern = parser.get_attachment_pattern_by_style(AttachmentStyle.SECURE)
    if secure_pattern:
        print(f"   Name: {secure_pattern.name}")
        print(f"   Style: {secure_pattern.style.value}")
        print(f"   Description: {secure_pattern.description}")
        print("   Key Characteristics:")
        for char in secure_pattern.characteristics[:3]:
            print(f"     - {char}")
        print("   Behavioral Indicators:")
        for indicator in secure_pattern.behavioral_indicators[:3]:
            print(f"     - {indicator}")
        print("   Therapeutic Considerations:")
        for consideration in secure_pattern.therapeutic_considerations[:2]:
            print(f"     - {consideration}")
    
    # 7. Detailed Defense Mechanism Example
    print("\n7. Detailed Defense Mechanism (Sublimation):")
    sublimation = parser.get_defense_mechanism_by_name("Sublimation")
    if sublimation:
        print(f"   Name: {sublimation.name}")
        print(f"   Level: {sublimation.level.value}")
        print(f"   Description: {sublimation.description}")
        print(f"   Function: {sublimation.function}")
        print("   Examples:")
        for example in sublimation.examples:
            print(f"     - {example}")
        print("   Adaptive Aspects:")
        for aspect in sublimation.adaptive_aspects:
            print(f"     - {aspect}")
    
    # 8. Conversation Template Generation
    print("\n8. Conversation Template Generation:")
    
    # Generate attachment conversation
    attachment_conversations = parser.generate_conversation_templates(
        "attachment", AttachmentStyle.SECURE.value
    )
    print(f"   ✓ Generated {len(attachment_conversations)} attachment conversation template(s)")
    if attachment_conversations:
        conv = attachment_conversations[0]
        print(f"   Template ID: {conv.id}")
        print(f"   Messages: {len(conv.messages)}")
        print(f"   Context: {conv.context}")
        print("   Sample Messages:")
        for i, msg in enumerate(conv.messages[:3], 1):
            content_preview = msg.content[:80] + "..." if len(msg.content) > 80 else msg.content
            print(f"     {i}. [{msg.role}]: {content_preview}")
    
    # Generate defense mechanism conversation
    defense_conversations = parser.generate_conversation_templates(
        "defense", "Sublimation"
    )
    print(f"   ✓ Generated {len(defense_conversations)} defense mechanism conversation template(s)")
    
    # Generate psychodynamic pattern conversation
    pattern_conversations = parser.generate_conversation_templates(
        "pattern", "Anxious-Attachment Pattern"
    )
    print(f"   ✓ Generated {len(pattern_conversations)} psychodynamic pattern conversation template(s)")
    
    # 9. JSON Export
    print("\n9. JSON Export:")
    export_path = project_root / "data" / "psychology" / "pdm2_knowledge_base.json"
    success = parser.export_to_json(export_path)
    if success:
        print(f"   ✓ Exported knowledge base to: {export_path}")
        file_size = export_path.stat().st_size / 1024  # KB
        print(f"   File size: {file_size:.1f} KB")
        
        # Show JSON structure preview
        import json
        with open(export_path, 'r') as f:
            data = json.load(f)
        print("   JSON Structure:")
        print(f"     - version: {data['version']}")
        print(f"     - attachment_patterns: {len(data['attachment_patterns'])} items")
        print(f"     - defense_mechanisms: {len(data['defense_mechanisms'])} items")
        print(f"     - psychodynamic_patterns: {len(data['psychodynamic_patterns'])} items")
        
        # Sample attachment pattern
        if data['attachment_patterns']:
            sample_pattern = data['attachment_patterns'][0]
            print("   Sample Attachment Pattern (JSON):")
            print(f"     - name: {sample_pattern['name']}")
            print(f"     - style: {sample_pattern['style']}")
            print(f"     - characteristics: {len(sample_pattern['characteristics'])} items")
    
    # 10. JSON Loading Test
    print("\n10. JSON Loading Test:")
    new_parser = PDM2Parser()
    # Clear the knowledge base to test loading
    new_parser.knowledge_base = None
    success = new_parser.load_from_json(export_path)
    if success:
        print("   ✓ Successfully loaded knowledge base from JSON")
        loaded_stats = new_parser.get_statistics()
        print(f"   Loaded {loaded_stats['total_attachment_patterns']} attachment patterns")
        print(f"   Loaded {loaded_stats['total_defense_mechanisms']} defense mechanisms")
        print(f"   Loaded {loaded_stats['total_psychodynamic_patterns']} psychodynamic patterns")
    
    # 11. Sample Data Generation
    print("\n11. Sample Data Generation:")
    sample_data = parser.create_sample_concepts()
    print(f"   ✓ Generated {len(sample_data)} sample psychodynamic concepts")
    
    # Count by type
    type_counts = {}
    for item in sample_data:
        item_type = item['type']
        type_counts[item_type] = type_counts.get(item_type, 0) + 1
    
    print("   Sample Record Counts by Type:")
    for item_type, count in type_counts.items():
        print(f"     - {item_type}: {count} records")
    
    if sample_data:
        sample_record = sample_data[0]
        print("   Sample Record Structure:")
        print(f"     - name: {sample_record.get('name', 'N/A')}")
        print(f"     - type: {sample_record.get('type', 'N/A')}")
        if 'style' in sample_record:
            print(f"     - style: {sample_record['style']}")
        if 'level' in sample_record:
            print(f"     - level: {sample_record['level']}")
        if 'domain' in sample_record:
            print(f"     - domain: {sample_record['domain']}")
    
    print("\n" + "=" * 80)
    print("Demo completed successfully!")
    print("=" * 80)
    
    print("\nNext Steps:")
    print("1. The PDM-2 knowledge base has been exported to:", export_path)
    print("2. Use the parser in your psychodynamic conversation generation pipeline")
    print("3. Extend with additional attachment patterns, defense mechanisms, or psychodynamic concepts")
    print("4. Integrate with DSM-5 parser and Big Five personality frameworks")
    print("5. Generate therapeutic training conversations using psychodynamic principles")


if __name__ == "__main__":
    main()
