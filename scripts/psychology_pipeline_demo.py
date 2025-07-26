#!/usr/bin/env python3
"""
Psychology Knowledge Integration Pipeline Demo

Complete end-to-end demonstration of the psychology knowledge integration pipeline.
Processes raw psychology knowledge through all stages to produce balanced, validated
conversational training data.

Usage:
    python scripts/psychology_pipeline_demo.py [--output-dir OUTPUT_DIR] [--target-total TARGET_TOTAL]
"""

import argparse
import sys
from pathlib import Path
import json
import time
from typing import Dict, List, Any

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.pipelines.dataset_pipeline.dsm5_parser import DSM5Parser
from ai.pipelines.dataset_pipeline.pdm2_parser import PDM2Parser
from ai.pipelines.dataset_pipeline.bigfive_processor import BigFiveProcessor
from ai.pipelines.dataset_pipeline.psychology_conversation_converter import (
    PsychologyConversationConverter,
)
from ai.pipelines.dataset_pipeline.client_scenario_generator import ClientScenarioGenerator
from ai.pipelines.dataset_pipeline.therapeutic_response_generator import (
    TherapeuticResponseGenerator,
)
from ai.pipelines.dataset_pipeline.clinical_accuracy_validator import ClinicalAccuracyValidator
from ai.pipelines.dataset_pipeline.knowledge_category_balancer import KnowledgeCategoryBalancer


class PsychologyPipelineDemo:
    """Complete psychology knowledge integration pipeline demonstration."""

    def __init__(self, output_dir: Path, target_total: int = 50):
        self.output_dir = Path(output_dir)
        self.target_total = target_total
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize all pipeline components
        self.dsm5_parser = DSM5Parser()
        self.pdm2_parser = PDM2Parser()
        self.bigfive_processor = BigFiveProcessor()
        self.conversation_converter = PsychologyConversationConverter()
        self.scenario_generator = ClientScenarioGenerator()
        self.response_generator = TherapeuticResponseGenerator()
        self.validator = ClinicalAccuracyValidator()
        self.balancer = KnowledgeCategoryBalancer()

        print(f"🧠 Psychology Pipeline Demo Initialized")
        print(f"📁 Output Directory: {self.output_dir}")
        print(f"🎯 Target Total Items: {self.target_total}")
        print("=" * 60)

    def run_complete_pipeline(self) -> Dict[str, Any]:
        """Run the complete psychology knowledge integration pipeline."""

        results = {}
        start_time = time.time()

        print("\n🚀 Starting Psychology Knowledge Integration Pipeline")
        print("=" * 60)

        # Step 1: Parse and Structure Psychology Knowledge
        print("\n📚 STEP 1: Parsing Psychology Knowledge")
        print("-" * 40)
        knowledge_results = self._step1_parse_knowledge()
        results["knowledge_parsing"] = knowledge_results

        # Step 2: Generate Client Scenarios
        print("\n👥 STEP 2: Generating Client Scenarios")
        print("-" * 40)
        scenario_results = self._step2_generate_scenarios()
        results["scenario_generation"] = scenario_results

        # Step 3: Convert to Conversational Format
        print("\n💬 STEP 3: Converting to Conversational Format")
        print("-" * 40)
        conversation_results = self._step3_convert_conversations()
        results["conversation_conversion"] = conversation_results

        # Step 4: Generate Therapeutic Responses
        print("\n🩺 STEP 4: Generating Therapeutic Responses")
        print("-" * 40)
        response_results = self._step4_generate_responses(scenario_results["scenarios"])
        results["response_generation"] = response_results

        # Step 5: Validate Clinical Accuracy
        print("\n✅ STEP 5: Validating Clinical Accuracy")
        print("-" * 40)
        validation_results = self._step5_validate_accuracy(conversation_results["conversations"])
        results["clinical_validation"] = validation_results

        # Step 6: Balance Knowledge Categories
        print("\n⚖️ STEP 6: Balancing Knowledge Categories")
        print("-" * 40)
        balancing_results = self._step6_balance_categories(
            conversation_results["conversations"], validation_results["validations"]
        )
        results["category_balancing"] = balancing_results

        # Step 7: Generate Final Report
        print("\n📊 STEP 7: Generating Final Report")
        print("-" * 40)
        report_results = self._step7_generate_report(results)
        results["final_report"] = report_results

        total_time = time.time() - start_time
        results["pipeline_stats"] = {
            "total_time_seconds": total_time,
            "total_time_formatted": f"{total_time:.2f}s",
            "steps_completed": 7,
            "success": True,
        }

        print(f"\n🎉 Pipeline Complete! Total time: {total_time:.2f}s")
        print("=" * 60)

        return results

    def _step1_parse_knowledge(self) -> Dict[str, Any]:
        """Step 1: Parse and structure psychology knowledge."""

        print("🔍 Parsing DSM-5 diagnostic criteria...")
        dsm5_disorders = self.dsm5_parser.create_sample_disorders()
        dsm5_output = self.output_dir / "01_dsm5_disorders.json"
        self.dsm5_parser.export_to_json(dsm5_output)
        print(f"   ✓ Created {len(dsm5_disorders)} DSM-5 disorders → {dsm5_output}")

        print("🔍 Parsing PDM-2 psychodynamic frameworks...")
        pdm2_framework = self.pdm2_parser.create_pdm2_framework()
        pdm2_output = self.output_dir / "01_pdm2_framework.json"
        self.pdm2_parser.export_to_json(pdm2_output)
        print(
            f"   ✓ Created PDM-2 framework with {len(pdm2_framework.patterns)} patterns → {pdm2_output}"
        )

        print("🔍 Processing Big Five personality assessments...")
        personality_profiles = self.bigfive_processor.generate_sample_profiles(10)
        bigfive_output = self.output_dir / "01_bigfive_data.json"
        self.bigfive_processor.export_to_json(bigfive_output)
        print(f"   ✓ Created {len(personality_profiles)} personality profiles → {bigfive_output}")

        return {
            "dsm5_disorders": len(dsm5_disorders),
            "pdm2_patterns": len(pdm2_framework.patterns),
            "personality_profiles": len(personality_profiles),
            "files_created": [dsm5_output, pdm2_output, bigfive_output],
        }

    def _step2_generate_scenarios(self) -> Dict[str, Any]:
        """Step 2: Generate client scenarios from knowledge base."""

        print("👤 Generating client scenarios...")
        scenarios = self.scenario_generator.generate_scenario_dataset(scenarios_per_type=5)

        scenarios_output = self.output_dir / "02_client_scenarios.json"
        self.scenario_generator.export_scenarios_to_json(scenarios, scenarios_output)

        # Analyze scenario types
        scenario_types = {}
        for scenario in scenarios:
            scenario_type = scenario.scenario_type.value
            scenario_types[scenario_type] = scenario_types.get(scenario_type, 0) + 1

        print(f"   ✓ Generated {len(scenarios)} client scenarios → {scenarios_output}")
        print(f"   📊 Scenario types: {scenario_types}")

        return {
            "total_scenarios": len(scenarios),
            "scenario_types": scenario_types,
            "scenarios": scenarios,
            "output_file": scenarios_output,
        }

    def _step3_convert_conversations(self) -> Dict[str, Any]:
        """Step 3: Convert psychology knowledge to conversational format."""

        print("💭 Converting knowledge to conversations...")
        conversations = self.conversation_converter.generate_conversation_dataset(count_per_type=8)

        conversations_output = self.output_dir / "03_therapeutic_conversations.json"
        self.conversation_converter.export_conversations_to_json(
            conversations, conversations_output
        )

        # Analyze conversation types
        conversation_types = {}
        for conv in conversations:
            conv_type = conv.conversation_type.value
            conversation_types[conv_type] = conversation_types.get(conv_type, 0) + 1

        print(
            f"   ✓ Generated {len(conversations)} therapeutic conversations → {conversations_output}"
        )
        print(f"   📊 Conversation types: {conversation_types}")

        return {
            "total_conversations": len(conversations),
            "conversation_types": conversation_types,
            "conversations": conversations,
            "output_file": conversations_output,
        }

    def _step4_generate_responses(self, scenarios: List) -> Dict[str, Any]:
        """Step 4: Generate therapeutic responses."""

        print("🗣️ Generating therapeutic responses...")
        responses = self.response_generator.generate_response_dataset(
            scenarios, responses_per_scenario=2
        )

        responses_output = self.output_dir / "04_therapeutic_responses.json"
        self.response_generator.export_responses_to_json(responses, responses_output)

        # Analyze response types and approaches
        response_types = {}
        therapeutic_approaches = {}

        for response in responses:
            resp_type = response.response_type.value
            approach = response.therapeutic_approach.value

            response_types[resp_type] = response_types.get(resp_type, 0) + 1
            therapeutic_approaches[approach] = therapeutic_approaches.get(approach, 0) + 1

        print(f"   ✓ Generated {len(responses)} therapeutic responses → {responses_output}")
        print(f"   📊 Response types: {response_types}")
        print(f"   📊 Therapeutic approaches: {therapeutic_approaches}")

        return {
            "total_responses": len(responses),
            "response_types": response_types,
            "therapeutic_approaches": therapeutic_approaches,
            "responses": responses,
            "output_file": responses_output,
        }

    def _step5_validate_accuracy(self, conversations: List) -> Dict[str, Any]:
        """Step 5: Validate clinical accuracy."""

        print("🔍 Validating clinical accuracy...")
        validations = self.validator.validate_conversation_batch(conversations)

        validation_output = self.output_dir / "05_clinical_validation.json"
        self.validator.export_validation_results(validations, validation_output)

        # Analyze validation results
        approved_count = sum(1 for v in validations if v.approved_for_training)
        avg_score = (
            sum(v.overall_score for v in validations) / len(validations) if validations else 0
        )
        critical_issues_count = sum(len(v.critical_issues) for v in validations)

        print(f"   ✓ Validated {len(validations)} conversations → {validation_output}")
        print(
            f"   📊 Approved for training: {approved_count}/{len(validations)} ({approved_count/len(validations)*100:.1f}%)"
        )
        print(f"   📊 Average quality score: {avg_score:.2f}")
        print(f"   📊 Critical issues found: {critical_issues_count}")

        return {
            "total_validations": len(validations),
            "approved_count": approved_count,
            "approval_rate": approved_count / len(validations) if validations else 0,
            "average_score": avg_score,
            "critical_issues_count": critical_issues_count,
            "validations": validations,
            "output_file": validation_output,
        }

    def _step6_balance_categories(self, conversations: List, validations: List) -> Dict[str, Any]:
        """Step 6: Balance knowledge categories."""

        print("⚖️ Balancing knowledge categories...")
        balancing_result = self.balancer.balance_knowledge_categories(
            conversations=conversations,
            validations=validations,
            target_total=self.target_total,
            strategy="balanced",
        )

        balancing_output = self.output_dir / "06_category_balancing.json"
        self.balancer.export_balancing_report(balancing_result, balancing_output)

        # Analyze balancing results
        category_stats = {}
        for balance in balancing_result.category_balances:
            category_stats[balance.category.value] = {
                "current": balance.current_count,
                "target": balance.target_count,
                "percentage": f"{balance.current_percentage:.1%}",
                "quality": f"{balance.quality_score:.2f}",
                "deficit": balance.deficit,
            }

        print(
            f"   ✓ Balanced {balancing_result.total_items} items across categories → {balancing_output}"
        )
        print(f"   📊 Quality summary: {balancing_result.quality_summary}")
        print(f"   📊 Recommendations: {len(balancing_result.recommendations)}")

        return {
            "total_balanced_items": balancing_result.total_items,
            "category_stats": category_stats,
            "quality_summary": balancing_result.quality_summary,
            "recommendations_count": len(balancing_result.recommendations),
            "balancing_result": balancing_result,
            "output_file": balancing_output,
        }

    def _step7_generate_report(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Step 7: Generate comprehensive final report."""

        print("📋 Generating final pipeline report...")

        # Create comprehensive report
        final_report = {
            "pipeline_summary": {
                "total_time": results["pipeline_stats"]["total_time_formatted"],
                "steps_completed": results["pipeline_stats"]["steps_completed"],
                "success": results["pipeline_stats"]["success"],
            },
            "knowledge_parsing": {
                "dsm5_disorders": results["knowledge_parsing"]["dsm5_disorders"],
                "pdm2_patterns": results["knowledge_parsing"]["pdm2_patterns"],
                "personality_profiles": results["knowledge_parsing"]["personality_profiles"],
            },
            "content_generation": {
                "client_scenarios": results["scenario_generation"]["total_scenarios"],
                "therapeutic_conversations": results["conversation_conversion"][
                    "total_conversations"
                ],
                "therapeutic_responses": results["response_generation"]["total_responses"],
            },
            "quality_assurance": {
                "validations_performed": results["clinical_validation"]["total_validations"],
                "approval_rate": f"{results['clinical_validation']['approval_rate']:.1%}",
                "average_quality_score": f"{results['clinical_validation']['average_score']:.2f}",
                "critical_issues": results["clinical_validation"]["critical_issues_count"],
            },
            "final_dataset": {
                "balanced_items": results["category_balancing"]["total_balanced_items"],
                "target_achieved": results["category_balancing"]["total_balanced_items"]
                >= self.target_total * 0.8,
                "category_distribution": results["category_balancing"]["category_stats"],
                "recommendations": results["category_balancing"]["recommendations_count"],
            },
            "files_generated": [
                str(f.relative_to(self.output_dir))
                for step_results in results.values()
                if isinstance(step_results, dict) and "output_file" in step_results
                for f in [step_results["output_file"]]
            ]
            + [
                str(f.relative_to(self.output_dir))
                for f in results["knowledge_parsing"]["files_created"]
            ],
        }

        # Export final report
        report_output = self.output_dir / "07_FINAL_PIPELINE_REPORT.json"
        with open(report_output, "w", encoding="utf-8") as f:
            json.dump(final_report, f, indent=2, ensure_ascii=False)

        # Create summary text report
        summary_output = self.output_dir / "07_PIPELINE_SUMMARY.txt"
        self._create_text_summary(final_report, summary_output)

        print(f"   ✓ Generated final report → {report_output}")
        print(f"   ✓ Generated summary → {summary_output}")

        return {
            "report_file": report_output,
            "summary_file": summary_output,
            "final_report": final_report,
        }

    def _create_text_summary(self, report: Dict[str, Any], output_path: Path):
        """Create human-readable text summary."""

        summary_text = f"""
🧠 PSYCHOLOGY KNOWLEDGE INTEGRATION PIPELINE SUMMARY
{'=' * 60}

⏱️  PIPELINE EXECUTION
   • Total Time: {report['pipeline_summary']['total_time']}
   • Steps Completed: {report['pipeline_summary']['steps_completed']}/7
   • Status: {'✅ SUCCESS' if report['pipeline_summary']['success'] else '❌ FAILED'}

📚 KNOWLEDGE PARSING
   • DSM-5 Disorders: {report['knowledge_parsing']['dsm5_disorders']}
   • PDM-2 Patterns: {report['knowledge_parsing']['pdm2_patterns']}
   • Personality Profiles: {report['knowledge_parsing']['personality_profiles']}

🎭 CONTENT GENERATION
   • Client Scenarios: {report['content_generation']['client_scenarios']}
   • Therapeutic Conversations: {report['content_generation']['therapeutic_conversations']}
   • Therapeutic Responses: {report['content_generation']['therapeutic_responses']}

✅ QUALITY ASSURANCE
   • Validations Performed: {report['quality_assurance']['validations_performed']}
   • Approval Rate: {report['quality_assurance']['approval_rate']}
   • Average Quality Score: {report['quality_assurance']['average_quality_score']}
   • Critical Issues: {report['quality_assurance']['critical_issues']}

📊 FINAL DATASET
   • Balanced Items: {report['final_dataset']['balanced_items']}
   • Target Achieved: {'✅ YES' if report['final_dataset']['target_achieved'] else '❌ NO'}
   • Recommendations: {report['final_dataset']['recommendations']}

📁 FILES GENERATED
"""

        for i, filename in enumerate(report["files_generated"], 1):
            summary_text += f"   {i:2d}. {filename}\n"

        summary_text += f"\n{'=' * 60}\n"
        summary_text += "🎉 Psychology Knowledge Integration Pipeline Complete!\n"
        summary_text += f"{'=' * 60}\n"

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(summary_text)


def main():
    """Main entry point for the psychology pipeline demo."""

    parser = argparse.ArgumentParser(
        description="Psychology Knowledge Integration Pipeline Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/psychology_pipeline_demo.py
  python scripts/psychology_pipeline_demo.py --output-dir ./pipeline_output --target-total 100
        """,
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default="./psychology_pipeline_output",
        help="Output directory for pipeline results (default: ./psychology_pipeline_output)",
    )

    parser.add_argument(
        "--target-total",
        type=int,
        default=50,
        help="Target total number of balanced items (default: 50)",
    )

    args = parser.parse_args()

    try:
        # Run the complete pipeline
        demo = PsychologyPipelineDemo(output_dir=args.output_dir, target_total=args.target_total)

        results = demo.run_complete_pipeline()

        print(f"\n🎊 SUCCESS! Check results in: {args.output_dir}")
        print(f"📋 Final report: {results['final_report']['report_file']}")
        print(f"📄 Summary: {results['final_report']['summary_file']}")

        return 0

    except Exception as e:
        print(f"\n❌ ERROR: Pipeline failed with exception: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
