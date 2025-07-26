#!/usr/bin/env python3
"""
Demo script for DSM-5 parser functionality.

This script demonstrates the key features of the DSM-5 parser including:
- Loading and parsing DSM-5 diagnostic criteria
- Generating conversation templates for therapeutic training
- Exporting knowledge base to JSON format
- Statistical analysis of the knowledge base
"""

import sys
import json
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.dsm5_parser import DSM5Parser, DSMCategory
from ai.dataset_pipeline.logger import get_logger

logger = get_logger("dsm5_parser_demo")


def main():
    """Main demo function."""
    print("=" * 80)
    print("DSM-5 Parser Demo")
    print("=" * 80)
    
    # Initialize the parser
    print("\n1. Initializing DSM-5 Parser...")
    parser = DSM5Parser()
    print(f"✓ Parser initialized with {len(parser.get_disorders())} disorders")
    
    # Display statistics
    print("\n2. Knowledge Base Statistics:")
    stats = parser.get_statistics()
    print(f"   Total Disorders: {stats['total_disorders']}")
    print(f"   Total Criteria: {stats['total_criteria']}")
    print(f"   Version: {stats['version']}")
    print("   Categories:")
    for category, count in stats['categories'].items():
        print(f"     - {category}: {count} disorders")
    
    # Show available disorders
    print("\n3. Available Disorders:")
    disorders = parser.get_disorders()
    for i, disorder in enumerate(disorders, 1):
        print(f"   {i}. {disorder.name} ({disorder.code}) - {disorder.category.value}")
    
    # Demonstrate disorder lookup
    print("\n4. Disorder Lookup Examples:")
    
    # By name
    mdd = parser.get_disorder_by_name("Major Depressive Disorder")
    if mdd:
        print(f"   ✓ Found by name: {mdd.name}")
        print(f"     Code: {mdd.code}")
        print(f"     Category: {mdd.category.value}")
        print(f"     Minimum criteria: {mdd.minimum_criteria_count}")
        print(f"     Duration: {mdd.duration_requirement}")
        print(f"     Criteria count: {len(mdd.criteria)}")
    
    # By code
    disorder_by_code = parser.get_disorder_by_code("300.02")
    if disorder_by_code:
        print(f"   ✓ Found by code: {disorder_by_code.name} ({disorder_by_code.code})")
    
    # By category
    anxiety_disorders = parser.get_disorders_by_category(DSMCategory.ANXIETY)
    print(f"   ✓ Found {len(anxiety_disorders)} anxiety disorders:")
    for disorder in anxiety_disorders:
        print(f"     - {disorder.name}")
    
    # Show detailed disorder structure
    print("\n5. Detailed Disorder Structure (Major Depressive Disorder):")
    if mdd:
        print(f"   Name: {mdd.name}")
        print(f"   Code: {mdd.code}")
        print(f"   Category: {mdd.category.value}")
        print(f"   Duration Requirement: {mdd.duration_requirement}")
        print(f"   Minimum Criteria Count: {mdd.minimum_criteria_count}")
        
        print("   Diagnostic Criteria:")
        for criterion in mdd.criteria[:3]:  # Show first 3 criteria
            print(f"     {criterion.id}: {criterion.description}")
            if criterion.examples:
                print(f"        Examples: {', '.join(criterion.examples[:2])}")
        print(f"     ... and {len(mdd.criteria) - 3} more criteria")
        
        print("   Specifiers:")
        for specifier in mdd.specifiers:
            print(f"     {specifier.name}: {specifier.description}")
            if specifier.options:
                print(f"        Options: {', '.join(specifier.options[:3])}")
        
        print("   Exclusions:")
        for exclusion in mdd.exclusions[:2]:
            print(f"     - {exclusion}")
        
        print("   Differential Diagnosis:")
        for diff_dx in mdd.differential_diagnosis[:3]:
            print(f"     - {diff_dx}")
    
    # Generate conversation templates
    print("\n6. Conversation Template Generation:")
    conversations = parser.generate_conversation_templates("Major Depressive Disorder")
    if conversations:
        conv = conversations[0]
        print(f"   ✓ Generated {len(conversations)} conversation template(s)")
        print(f"   Template ID: {conv.id}")
        print(f"   Messages: {len(conv.messages)}")
        print(f"   Context: {conv.context}")
        
        print("   Sample Messages:")
        for i, message in enumerate(conv.messages[:4]):
            print(f"     {i+1}. [{message.role}]: {message.content[:80]}...")
        if len(conv.messages) > 4:
            print(f"     ... and {len(conv.messages) - 4} more messages")
    
    # Export to JSON
    print("\n7. JSON Export:")
    output_dir = project_root / "data" / "psychology"
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "dsm5_knowledge_base.json"
    
    success = parser.export_to_json(json_path)
    if success:
        print(f"   ✓ Exported knowledge base to: {json_path}")
        file_size = json_path.stat().st_size / 1024  # KB
        print(f"   File size: {file_size:.1f} KB")
        
        # Show sample JSON structure
        with open(json_path, 'r') as f:
            data = json.load(f)
        print("   JSON Structure:")
        print(f"     - version: {data['version']}")
        print(f"     - disorders: {len(data['disorders'])} items")
        print(f"     - categories: {len(data['categories'])} items")
        
        # Show sample disorder in JSON
        if data['disorders']:
            sample_disorder = data['disorders'][0]
            print(f"   Sample Disorder (JSON):")
            print(f"     - name: {sample_disorder['name']}")
            print(f"     - code: {sample_disorder['code']}")
            print(f"     - criteria: {len(sample_disorder['criteria'])} items")
    
    # Test JSON loading
    print("\n8. JSON Loading Test:")
    new_parser = DSM5Parser()
    load_success = new_parser.load_from_json(json_path)
    if load_success:
        loaded_disorders = new_parser.get_disorders()
        print(f"   ✓ Successfully loaded {len(loaded_disorders)} disorders from JSON")
        
        # Verify data integrity
        original_mdd = parser.get_disorder_by_name("Major Depressive Disorder")
        loaded_mdd = new_parser.get_disorder_by_name("Major Depressive Disorder")
        if original_mdd and loaded_mdd:
            print("   Data Integrity Check:")
            print(f"     ✓ Name matches: {original_mdd.name == loaded_mdd.name}")
            print(f"     ✓ Code matches: {original_mdd.code == loaded_mdd.code}")
            print(f"     ✓ Criteria count matches: {len(original_mdd.criteria) == len(loaded_mdd.criteria)}")
    
    # Sample data generation
    print("\n9. Sample Data Generation:")
    sample_data = parser.create_sample_disorders()
    print(f"   ✓ Generated {len(sample_data)} sample disorder records")
    if sample_data:
        sample = sample_data[0]
        print("   Sample Record Structure:")
        for key in ['name', 'code', 'category', 'minimum_criteria_count']:
            if key in sample:
                print(f"     - {key}: {sample[key]}")
    
    print("\n" + "=" * 80)
    print("Demo completed successfully!")
    print("=" * 80)
    
    # Show next steps
    print("\nNext Steps:")
    print("1. The DSM-5 knowledge base has been exported to:", json_path)
    print("2. Use the parser in your therapeutic conversation generation pipeline")
    print("3. Extend with additional disorders or more detailed criteria")
    print("4. Integrate with PDM-2 and Big Five personality frameworks")


if __name__ == "__main__":
    main()
