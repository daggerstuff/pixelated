#!/usr/bin/env python3
"""
Demonstration script for therapeutic response generator.

This script shows the capabilities of the therapeutic response generator including:
- Generating evidence-based therapeutic responses
- Selecting appropriate techniques and modalities
- Creating complete therapeutic conversations
- Integrating psychology knowledge (DSM-5, PDM-2, Big Five)
- Clinical rationale and effectiveness tracking
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.therapeutic_response_generator import (
    TherapeuticResponseGenerator,
    TherapeuticTechnique,
    ResponseType,
    TherapeuticModality,
    ResponseContext
)
from ai.dataset_pipeline.client_scenario_generator import (
    ClientScenarioGenerator,
    ScenarioType,
    SeverityLevel,
    DemographicCategory
)


def main():
    """Demonstrate therapeutic response generator capabilities."""
    print("🩺 Therapeutic Response Generator Demo")
    print("=" * 60)
    
    # Initialize generators
    response_generator = TherapeuticResponseGenerator()
    scenario_generator = ClientScenarioGenerator()
    
    # Show available techniques and modalities
    print("\n🛠️ Available Therapeutic Techniques:")
    for technique in TherapeuticTechnique:
        print(f"  • {technique.value.replace('_', ' ').title()}")
    
    print("\n🎭 Available Therapeutic Modalities:")
    for modality in TherapeuticModality:
        print(f"  • {modality.value.replace('_', ' ').title()}")
    
    print("\n📋 Available Response Types:")
    for response_type in ResponseType:
        print(f"  • {response_type.value.replace('_', ' ').title()}")
    
    # Generate test scenarios
    print("\n🎯 Generating Test Scenarios:")
    
    # Scenario 1: Initial Assessment - Moderate Anxiety
    scenario1 = scenario_generator.generate_client_scenario(
        scenario_type=ScenarioType.INITIAL_ASSESSMENT,
        severity_level=SeverityLevel.MODERATE,
        demographic_category=DemographicCategory.YOUNG_ADULT
    )
    
    print(f"\n  Scenario 1: {scenario1.scenario_type.value.replace('_', ' ').title()}")
    print(f"    Client: {scenario1.demographics.age}yo {scenario1.demographics.gender}, {scenario1.demographics.occupation}")
    print(f"    Concern: {scenario1.presenting_problem.primary_concern}")
    print(f"    Severity: {scenario1.severity_level.value.title()}")
    print(f"    DSM-5: {', '.join(scenario1.clinical_formulation.dsm5_considerations[:2])}")
    
    # Scenario 2: Crisis Intervention
    scenario2 = scenario_generator.generate_client_scenario(
        scenario_type=ScenarioType.CRISIS_INTERVENTION,
        severity_level=SeverityLevel.CRISIS,
        demographic_category=DemographicCategory.MIDDLE_AGED
    )
    
    print(f"\n  Scenario 2: {scenario2.scenario_type.value.replace('_', ' ').title()}")
    print(f"    Client: {scenario2.demographics.age}yo {scenario2.demographics.gender}, {scenario2.demographics.occupation}")
    print(f"    Concern: {scenario2.presenting_problem.primary_concern}")
    print(f"    Crisis Type: {scenario2.session_context.get('crisis_type', 'General crisis')}")
    
    # Generate individual therapeutic responses
    print("\n💬 Individual Therapeutic Response Examples:")
    
    # Response 1: Empathic Reflection for Scenario 1
    print("\n  Response 1: Empathic Reflection (Humanistic)")
    context1 = ResponseContext(client_scenario=scenario1)
    response1 = response_generator.generate_therapeutic_response(
        context1,
        target_technique=TherapeuticTechnique.EMPATHIC_REFLECTION,
        target_modality=TherapeuticModality.HUMANISTIC
    )
    
    print(f"    Content: \"{response1.content}\"")
    print(f"    Technique: {response1.technique.value.replace('_', ' ').title()}")
    print(f"    Response Type: {response1.response_type.value.replace('_', ' ').title()}")
    print(f"    Modality: {response1.modality.value.replace('_', ' ').title()}")
    print(f"    Clinical Rationale: {response1.clinical_rationale}")
    print(f"    Target Symptoms: {', '.join(response1.target_symptoms[:2])}")
    print(f"    Effectiveness Indicators: {len(response1.effectiveness_indicators)} indicators")
    
    # Response 2: Safety Planning for Crisis
    print("\n  Response 2: Safety Planning (Crisis)")
    context2 = ResponseContext(client_scenario=scenario2)
    response2 = response_generator.generate_therapeutic_response(
        context2,
        target_technique=TherapeuticTechnique.SAFETY_PLANNING,
        target_modality=TherapeuticModality.TRAUMA_INFORMED
    )
    
    print(f"    Content: \"{response2.content}\"")
    print(f"    Technique: {response2.technique.value.replace('_', ' ').title()}")
    print(f"    Clinical Rationale: {response2.clinical_rationale}")
    print(f"    Contraindications: {len(response2.contraindications)} identified")
    print(f"    Follow-up Suggestions: {len(response2.follow_up_suggestions)} suggestions")
    
    # Response 3: Cognitive Behavioral Approach
    print("\n  Response 3: Open-Ended Questioning (CBT)")
    response3 = response_generator.generate_therapeutic_response(
        context1,
        target_technique=TherapeuticTechnique.OPEN_ENDED_QUESTIONING,
        target_modality=TherapeuticModality.COGNITIVE_BEHAVIORAL
    )
    
    print(f"    Content: \"{response3.content}\"")
    print(f"    Modality Focus: Thoughts and behaviors")
    print(f"    Clinical Rationale: {response3.clinical_rationale}")
    
    # Generate complete therapeutic conversation
    print("\n🗣️ Complete Therapeutic Conversation:")
    print("Generating full conversation for initial assessment scenario...")
    
    conversation = response_generator.generate_conversation_with_responses(
        scenario1,
        num_exchanges=4,
        target_modality=TherapeuticModality.COGNITIVE_BEHAVIORAL
    )
    
    print(f"\n  Conversation ID: {conversation.id}")
    print(f"  Total Messages: {len(conversation.messages)}")
    print(f"  Therapeutic Modality: {conversation.context.get('therapeutic_modality', 'Mixed')}")
    
    print(f"\n  Conversation Flow:")
    for i, message in enumerate(conversation.messages[:8], 1):  # Show first 8 messages
        role_icon = "🩺" if message.role == "therapist" else "👤"
        print(f"    {i}. {role_icon} {message.role.title()}: {message.content}")
        
        # Show therapist technique metadata
        if message.role == "therapist" and "technique" in message.meta:
            technique = message.meta["technique"].replace("_", " ").title()
            response_type = message.meta.get("response_type", "").replace("_", " ").title()
            print(f"       Technique: {technique} | Type: {response_type}")
    
    if len(conversation.messages) > 8:
        print(f"    ... and {len(conversation.messages) - 8} more messages")
    
    # Show technique adaptation
    print("\n🔄 Technique Adaptation Examples:")
    
    # Show how responses adapt to different scenarios
    scenarios = [scenario1, scenario2]
    techniques = [
        TherapeuticTechnique.VALIDATION,
        TherapeuticTechnique.PSYCHOEDUCATION,
        TherapeuticTechnique.GROUNDING_TECHNIQUES
    ]
    
    for i, (scenario, technique) in enumerate(zip(scenarios, techniques), 1):
        context = ResponseContext(client_scenario=scenario)
        response = response_generator.generate_therapeutic_response(
            context,
            target_technique=technique
        )
        
        print(f"\n  Adaptation {i}: {technique.value.replace('_', ' ').title()}")
        print(f"    Scenario: {scenario.scenario_type.value.replace('_', ' ').title()}")
        print(f"    Severity: {scenario.severity_level.value.title()}")
        print(f"    Response: \"{response.content[:80]}...\"")
        print(f"    Selected Modality: {response.modality.value.replace('_', ' ').title()}")
    
    # Generate response batch and show statistics
    print("\n📊 Batch Generation & Statistics:")
    print("Generating batch of responses for analysis...")
    
    test_scenarios = [scenario1, scenario2]
    batch_responses = response_generator.generate_response_batch(
        test_scenarios,
        responses_per_scenario=5
    )
    
    stats = response_generator.get_statistics(batch_responses)
    
    print(f"\n  Batch Statistics:")
    print(f"    Total Responses: {stats['total_responses']}")
    print(f"    Average Contraindications: {stats['average_contraindications']:.1f}")
    print(f"    Average Follow-ups: {stats['average_follow_ups']:.1f}")
    
    print(f"\n  Technique Distribution:")
    for technique, count in list(stats['techniques_used'].items())[:5]:
        print(f"    • {technique.replace('_', ' ').title()}: {count}")
    
    print(f"\n  Response Type Distribution:")
    for response_type, count in list(stats['response_types'].items())[:5]:
        print(f"    • {response_type.replace('_', ' ').title()}: {count}")
    
    print(f"\n  Modality Distribution:")
    for modality, count in list(stats['modalities_used'].items())[:5]:
        print(f"    • {modality.replace('_', ' ').title()}: {count}")
    
    # Export demonstration
    print("\n💾 Export Capabilities:")
    output_path = Path("demo_therapeutic_responses.json")
    success = response_generator.export_responses_to_json(batch_responses, output_path)
    
    if success:
        print(f"  ✅ Successfully exported {len(batch_responses)} responses to {output_path}")
        print(f"  📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
        
        # Show JSON structure preview
        import json
        with open(output_path, 'r') as f:
            data = json.load(f)
        
        print(f"  📋 JSON Structure:")
        print(f"    • responses: {len(data['responses'])} items")
        print(f"    • metadata: {list(data['metadata'].keys())}")
        
        if data['responses']:
            sample_response = data['responses'][0]
            print(f"    • sample response keys: {list(sample_response.keys())}")
    else:
        print("  ❌ Export failed")
    
    # Show clinical integration features
    print("\n🔗 Clinical Integration Features:")
    print("  • Evidence-based technique selection")
    print("  • DSM-5 diagnostic consideration integration")
    print("  • PDM-2 psychodynamic pattern awareness")
    print("  • Big Five personality factor adaptation")
    print("  • Crisis intervention protocols")
    print("  • Contraindication identification")
    print("  • Effectiveness indicator tracking")
    print("  • Clinical rationale generation")
    print("  • Modality-specific language adaptation")
    print("  • Cultural and demographic sensitivity")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Therapeutic Response Generator creates evidence-based, contextually")
    print("appropriate therapeutic responses that integrate multiple psychology")
    print("knowledge sources. This enables training of therapeutic AI systems")
    print("that can provide clinically sound, technique-specific responses")
    print("tailored to individual client presentations and therapeutic contexts.")


if __name__ == "__main__":
    main()
