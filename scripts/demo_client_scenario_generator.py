#!/usr/bin/env python3
"""
Demonstration script for client scenario generator.

This script shows the capabilities of the client scenario generator including:
- Generating realistic client scenarios with demographics and clinical formulations
- Creating diverse scenario types and severity levels
- Integrating DSM-5, PDM-2, and Big Five psychology knowledge
- Generating therapeutic conversation templates from scenarios
- Quality validation and statistics
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.client_scenario_generator import (
    ClientScenarioGenerator,
    ScenarioType,
    SeverityLevel,
    DemographicCategory
)


def main():
    """Demonstrate client scenario generator capabilities."""
    print("👤 Client Scenario Generator Demo")
    print("=" * 60)
    
    # Initialize generator
    generator = ClientScenarioGenerator()
    
    # Show available scenario types and categories
    print("\n📋 Available Scenario Types:")
    for scenario_type in ScenarioType:
        print(f"  • {scenario_type.value.replace('_', ' ').title()}")
    
    print("\n⚡ Severity Levels:")
    for severity in SeverityLevel:
        print(f"  • {severity.value.title()}")
    
    print("\n👥 Demographic Categories:")
    for category in DemographicCategory:
        print(f"  • {category.value.replace('_', ' ').title()}")
    
    # Generate individual scenario examples
    print("\n🎯 Individual Scenario Examples:")
    
    # Example 1: Initial Assessment - Young Adult
    print("\n  Example 1: Initial Assessment - Young Adult")
    scenario1 = generator.generate_client_scenario(
        scenario_type=ScenarioType.INITIAL_ASSESSMENT,
        severity_level=SeverityLevel.MODERATE,
        demographic_category=DemographicCategory.YOUNG_ADULT
    )
    
    print(f"    ID: {scenario1.id}")
    print(f"    Demographics: {scenario1.demographics.age}yo {scenario1.demographics.gender}, {scenario1.demographics.occupation}")
    print(f"    Cultural Background: {scenario1.demographics.cultural_background}")
    print(f"    Primary Concern: {scenario1.presenting_problem.primary_concern}")
    print(f"    Duration: {scenario1.presenting_problem.duration}")
    print(f"    Symptoms: {', '.join(scenario1.presenting_problem.symptoms[:3])}")
    print(f"    DSM-5 Considerations: {', '.join(scenario1.clinical_formulation.dsm5_considerations[:2])}")
    print(f"    Attachment Style: {scenario1.clinical_formulation.attachment_style}")
    
    # Show personality profile
    personality = scenario1.clinical_formulation.personality_profile
    print(f"    Personality Profile:")
    for factor, level in list(personality.items())[:3]:
        print(f"      • {factor.title()}: {level}")
    
    # Example 2: Crisis Intervention - Middle Aged
    print("\n  Example 2: Crisis Intervention - Middle Aged")
    scenario2 = generator.generate_client_scenario(
        scenario_type=ScenarioType.CRISIS_INTERVENTION,
        severity_level=SeverityLevel.CRISIS,
        demographic_category=DemographicCategory.MIDDLE_AGED
    )
    
    print(f"    ID: {scenario2.id}")
    print(f"    Demographics: {scenario2.demographics.age}yo {scenario2.demographics.gender}, {scenario2.demographics.occupation}")
    print(f"    Primary Concern: {scenario2.presenting_problem.primary_concern}")
    print(f"    Crisis Context: {scenario2.session_context.get('crisis_type', 'N/A')}")
    print(f"    Safety Assessment: {scenario2.session_context.get('safety_assessment_needed', False)}")
    print(f"    Learning Objectives: {len(scenario2.learning_objectives)} objectives")
    print(f"    Complexity Factors: {len(scenario2.complexity_factors)} factors")
    
    # Generate scenario batch
    print("\n📊 Batch Scenario Generation:")
    print("Generating diverse batch of 10 scenarios...")
    scenarios = generator.generate_scenario_batch(count=10)
    
    # Show statistics
    stats = generator.get_statistics(scenarios)
    print(f"\n  Batch Statistics:")
    print(f"    Total Scenarios: {stats['total_scenarios']}")
    print(f"    Average Complexity Factors: {stats['average_complexity_factors']:.1f}")
    
    print(f"\n  Scenario Type Distribution:")
    for scenario_type, count in stats['scenario_types'].items():
        print(f"    • {scenario_type.replace('_', ' ').title()}: {count}")
    
    print(f"\n  Severity Level Distribution:")
    for severity, count in stats['severity_levels'].items():
        print(f"    • {severity.title()}: {count}")
    
    print(f"\n  Age Distribution:")
    for age_group, count in stats['age_distribution'].items():
        print(f"    • {age_group}: {count}")
    
    print(f"\n  Cultural Background Diversity:")
    for culture, count in list(stats['cultural_backgrounds'].items())[:4]:
        print(f"    • {culture}: {count}")
    
    # Show quality validation
    print("\n✅ Quality Validation:")
    high_quality_scenarios = []
    
    for scenario in scenarios[:5]:  # Check first 5
        validation = generator.validate_scenario_quality(scenario)
        print(f"  Scenario {scenario.id[-4:]}:")
        print(f"    Quality Score: {validation['quality_score']:.2f}")
        print(f"    Valid: {validation['is_valid']}")
        print(f"    Strengths: {len(validation['strengths'])}")
        print(f"    Issues: {len(validation['issues'])}")
        
        if validation['is_valid']:
            high_quality_scenarios.append(scenario)
    
    print(f"\n  High Quality Scenarios: {len(high_quality_scenarios)}/5")
    
    # Generate conversation templates
    print("\n💬 Conversation Template Generation:")
    if high_quality_scenarios:
        example_scenario = high_quality_scenarios[0]
        conversations = generator.generate_conversation_templates(example_scenario)
        
        print(f"  Generated {len(conversations)} conversation(s) for scenario {example_scenario.id[-4:]}")
        
        if conversations:
            conversation = conversations[0]
            print(f"  Conversation ID: {conversation.id}")
            print(f"  Messages: {len(conversation.messages)}")
            print(f"  Context Keys: {list(conversation.context.keys())}")
            
            print(f"\n  Sample Message Exchange:")
            for i, message in enumerate(conversation.messages[:4], 1):
                role_icon = "🩺" if message.role == "therapist" else "👤"
                print(f"    {i}. {role_icon} {message.role.title()}: {message.content[:80]}...")
                
                # Show key metadata
                key_meta = {k: v for k, v in message.meta.items() if k in ['type', 'presenting_problem', 'crisis_expression']}
                if key_meta:
                    print(f"       Meta: {key_meta}")
    
    # Show scenario variations
    print("\n🔄 Scenario Variations:")
    if scenarios:
        base_scenario = scenarios[0]
        variations = generator.generate_scenario_variations(base_scenario, count=3)
        
        print(f"  Base Scenario: {base_scenario.scenario_type.value} - {base_scenario.severity_level.value}")
        print(f"  Generated {len(variations)} variations:")
        
        for i, variation in enumerate(variations, 1):
            print(f"    Variation {i}: {variation.scenario_type.value} - {variation.severity_level.value}")
            print(f"      Age: {variation.demographics.age} vs {base_scenario.demographics.age}")
            print(f"      Occupation: {variation.demographics.occupation} vs {base_scenario.demographics.occupation}")
    
    # Export demonstration
    print("\n💾 Export Capabilities:")
    output_path = Path("demo_client_scenarios.json")
    success = generator.export_scenarios_to_json(scenarios, output_path)
    
    if success:
        print(f"  ✅ Successfully exported {len(scenarios)} scenarios to {output_path}")
        print(f"  📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
        
        # Show JSON structure preview
        import json
        with open(output_path, 'r') as f:
            data = json.load(f)
        
        print(f"  📋 JSON Structure:")
        print(f"    • scenarios: {len(data['scenarios'])} items")
        print(f"    • metadata: {list(data['metadata'].keys())}")
        
        if data['scenarios']:
            sample_scenario = data['scenarios'][0]
            print(f"    • sample scenario keys: {list(sample_scenario.keys())}")
    else:
        print("  ❌ Export failed")
    
    # Show integration capabilities
    print("\n🔗 Psychology Knowledge Integration:")
    print("  • DSM-5 diagnostic criteria integration")
    print("  • PDM-2 attachment styles and defense mechanisms")
    print("  • Big Five personality factor assessment")
    print("  • Clinical formulation synthesis")
    print("  • Evidence-based therapeutic considerations")
    print("  • Realistic demographic diversity")
    print("  • Scenario complexity and learning objectives")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Client Scenario Generator creates comprehensive, realistic client")
    print("presentations that integrate multiple psychology knowledge sources.")
    print("These scenarios provide rich training data for therapeutic AI systems,")
    print("enabling them to understand diverse client presentations and develop")
    print("appropriate therapeutic responses across various clinical contexts.")


if __name__ == "__main__":
    main()
