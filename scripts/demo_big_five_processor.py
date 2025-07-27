#!/usr/bin/env python3
"""
Demonstration script for Big Five personality processor.

This script shows the capabilities of the Big Five processor including:
- Personality profile exploration
- Assessment instrument details
- Clinical guidelines access
- Conversation template generation
- Knowledge base statistics
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.big_five_processor import (
    BigFiveProcessor,
    PersonalityFactor,
    AssessmentType
)


def main():
    """Demonstrate Big Five processor capabilities."""
    print("🧠 Big Five Personality Assessment Processor Demo")
    print("=" * 60)
    
    # Initialize processor
    processor = BigFiveProcessor()
    
    # Show knowledge base statistics
    print("\n📊 Knowledge Base Statistics:")
    stats = processor.get_statistics()
    for key, value in stats.items():
        if isinstance(value, list):
            print(f"  {key}: {len(value)} items")
        else:
            print(f"  {key}: {value}")
    
    # Explore personality profiles
    print("\n🎭 Personality Profiles:")
    profiles = processor.get_personality_profiles()
    for profile in profiles:
        print(f"\n  {profile.name} ({profile.factor.value.upper()})")
        print(f"    Description: {profile.description}")
        print(f"    Facets: {len(profile.facets)}")
        print(f"    Clinical considerations: {len(profile.clinical_considerations)}")
        
        # Show high/low score interpretations
        if "high" in profile.score_interpretations:
            high_traits = profile.score_interpretations["high"][:2]  # First 2
            print(f"    High scorers: {', '.join(high_traits)}")
        
        if "low" in profile.score_interpretations:
            low_traits = profile.score_interpretations["low"][:2]  # First 2
            print(f"    Low scorers: {', '.join(low_traits)}")
    
    # Show assessment instruments
    print("\n📋 Assessment Instruments:")
    assessments = processor.get_assessments()
    for assessment in assessments:
        print(f"\n  {assessment.name}")
        print(f"    Type: {assessment.type.value}")
        print(f"    Items: {len(assessment.items)}")
        print(f"    Administration time: {assessment.administration_time}")
        print(f"    Target population: {', '.join(assessment.target_population)}")
        
        # Show sample reliability data
        if assessment.reliability_data:
            print("    Reliability (Cronbach's α):")
            for factor, alpha in list(assessment.reliability_data.items())[:3]:
                print(f"      {factor}: {alpha:.2f}")
    
    # Show clinical guidelines
    print("\n🏥 Clinical Guidelines:")
    guidelines = processor.knowledge_base.clinical_guidelines
    for category, items in guidelines.items():
        print(f"\n  {category.replace('_', ' ').title()}:")
        for item in items[:2]:  # Show first 2 items
            print(f"    • {item}")
        if len(items) > 2:
            print(f"    ... and {len(items) - 2} more")
    
    # Generate conversation templates
    print("\n💬 Sample Conversation Templates:")
    print("\nGenerating conversations for Openness to Experience...")
    conversations = processor.generate_conversation_templates(PersonalityFactor.OPENNESS)
    
    for i, conversation in enumerate(conversations, 1):
        print(f"\n  Conversation {i}: {conversation.context.get('type', 'Unknown')}")
        print(f"    ID: {conversation.id}")
        print(f"    Messages: {len(conversation.messages)}")
        
        # Show first message
        if conversation.messages:
            first_message = conversation.messages[0]
            print(f"    First message ({first_message.role}): {first_message.content[:100]}...")
    
    # Show research findings
    print("\n🔬 Research Findings:")
    findings = processor.knowledge_base.research_findings
    for category, items in findings.items():
        print(f"\n  {category.replace('_', ' ').title()}:")
        for item in items[:1]:  # Show first item
            print(f"    • {item}")
        if len(items) > 1:
            print(f"    ... and {len(items) - 1} more findings")
    
    # Demonstrate specific factor exploration
    print("\n🔍 Detailed Factor Exploration - Conscientiousness:")
    conscientiousness = processor.get_profile_by_factor(PersonalityFactor.CONSCIENTIOUSNESS)
    if conscientiousness:
        print(f"  Description: {conscientiousness.description}")
        print(f"  Facets:")
        for facet in conscientiousness.facets:
            print(f"    • {facet.name}: {facet.description}")
        
        print(f"  Therapeutic Implications:")
        for implication in conscientiousness.therapeutic_implications:
            print(f"    • {implication}")
    
    # Show assessment item examples
    print("\n📝 Sample Assessment Items:")
    bfi = processor.get_assessment_by_type(AssessmentType.BFI)
    if bfi:
        print(f"  From {bfi.name}:")
        for item in bfi.items[:3]:  # Show first 3 items
            reverse_note = " (reverse scored)" if item.reverse_scored else ""
            print(f"    • {item.text}{reverse_note}")
            print(f"      Factor: {item.factor.value.title()}")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Big Five processor provides comprehensive personality assessment")
    print("capabilities for therapeutic conversation generation and training data creation.")


if __name__ == "__main__":
    main()
