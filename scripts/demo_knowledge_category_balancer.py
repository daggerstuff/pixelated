#!/usr/bin/env python3
"""
Demonstration script for knowledge category balancer.

This script shows the capabilities of the knowledge category balancer including:
- Analyzing dataset balance across psychology knowledge categories
- Generating balanced scenario datasets
- Rebalancing existing datasets
- Comparing different balance strategies
- Optimizing dataset composition for training
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.knowledge_category_balancer import (
    KnowledgeCategoryBalancer,
    BalanceStrategy,
    BalanceMetric
)
from ai.dataset_pipeline.client_scenario_generator import (
    ClientScenarioGenerator,
    ScenarioType,
    SeverityLevel,
    DemographicCategory
)
from ai.dataset_pipeline.dsm5_parser import DSMCategory


def main():
    """Demonstrate knowledge category balancer capabilities."""
    print("⚖️ Knowledge Category Balancer Demo")
    print("=" * 60)
    
    # Initialize components
    balancer = KnowledgeCategoryBalancer()
    scenario_generator = ClientScenarioGenerator()
    
    # Show available balance strategies
    print("\n📊 Available Balance Strategies:")
    for strategy in BalanceStrategy:
        print(f"  • {strategy.value.replace('_', ' ').title()}")
    
    print("\n📈 Available Balance Metrics:")
    for metric in BalanceMetric:
        print(f"  • {metric.value.replace('_', ' ').title()}")
    
    # Generate test datasets with different characteristics
    print("\n🎯 Generating Test Datasets:")
    
    # Dataset 1: Small imbalanced dataset (mostly anxiety)
    print("\n  Dataset 1: Imbalanced (Anxiety-Heavy)")
    imbalanced_scenarios = []
    for _ in range(15):
        scenario = scenario_generator.generate_client_scenario(
            severity_level=SeverityLevel.MODERATE,
            scenario_type=ScenarioType.INITIAL_ASSESSMENT
        )
        imbalanced_scenarios.append(scenario)
    
    print(f"    Generated {len(imbalanced_scenarios)} scenarios")
    
    # Dataset 2: Balanced dataset using equal distribution
    print("\n  Dataset 2: Balanced (Equal Distribution)")
    balanced_scenarios = balancer.generate_balanced_scenarios(
        target_count=20,
        strategy=BalanceStrategy.EQUAL_DISTRIBUTION
    )
    
    print(f"    Generated {len(balanced_scenarios)} balanced scenarios")
    
    # Dataset 3: Clinical prevalence-based dataset
    print("\n  Dataset 3: Clinical Prevalence-Based")
    prevalence_scenarios = balancer.generate_balanced_scenarios(
        target_count=25,
        strategy=BalanceStrategy.CLINICAL_PREVALENCE
    )
    
    print(f"    Generated {len(prevalence_scenarios)} prevalence-based scenarios")
    
    # Analyze balance across different strategies
    print("\n🔍 Balance Analysis Comparison:")
    
    datasets = [
        ("Imbalanced", imbalanced_scenarios),
        ("Equal Distribution", balanced_scenarios),
        ("Clinical Prevalence", prevalence_scenarios)
    ]
    
    for dataset_name, scenarios in datasets:
        print(f"\n  {dataset_name} Dataset Analysis:")
        
        # Analyze with equal distribution strategy
        report = balancer.analyze_dataset_balance(
            scenarios,
            strategy=BalanceStrategy.EQUAL_DISTRIBUTION
        )
        
        print(f"    Total Scenarios: {report.total_items}")
        print(f"    Balance Score: {report.balance_score:.2f}")
        print(f"    Clinically Acceptable: {'✅ Yes' if report.balance_score >= 0.7 else '❌ No'}")
        
        # Show top distributions
        if report.distributions:
            print(f"    Top Category Distributions:")
            for category, distribution in list(report.distributions.items())[:3]:
                print(f"      • {category.replace('_', ' ').title()}: {distribution.total_count} items")
                if distribution.subcategories:
                    top_subcategories = sorted(
                        distribution.subcategories.items(), 
                        key=lambda x: x[1], 
                        reverse=True
                    )[:2]
                    for subcat, count in top_subcategories:
                        print(f"        - {subcat.replace('_', ' ').title()}: {count}")
        
        # Show recommendations
        if report.recommendations:
            print(f"    Top Recommendations:")
            for rec in report.recommendations[:2]:
                print(f"      • {rec}")
    
    # Strategy comparison
    print("\n📊 Strategy Comparison:")
    strategy_reports = balancer.compare_balance_strategies(balanced_scenarios)
    
    print(f"  Comparing {len(strategy_reports)} balance strategies:")
    for strategy, report in strategy_reports.items():
        print(f"    • {strategy.value.replace('_', ' ').title()}: Score {report.balance_score:.2f}")
    
    # Find best strategy
    best_strategy = max(strategy_reports.items(), key=lambda x: x[1].balance_score)
    print(f"  🏆 Best Strategy: {best_strategy[0].value.replace('_', ' ').title()} "
          f"(Score: {best_strategy[1].balance_score:.2f})")
    
    # Rebalancing demonstration
    print("\n🔄 Dataset Rebalancing:")
    print("  Rebalancing the imbalanced dataset...")
    
    rebalanced_scenarios, rebalance_report = balancer.rebalance_existing_dataset(
        imbalanced_scenarios,
        target_strategy=BalanceStrategy.EQUAL_DISTRIBUTION,
        max_additions=10
    )
    
    original_report = balancer.analyze_dataset_balance(
        imbalanced_scenarios,
        strategy=BalanceStrategy.EQUAL_DISTRIBUTION
    )
    
    print(f"    Original Dataset:")
    print(f"      • Scenarios: {len(imbalanced_scenarios)}")
    print(f"      • Balance Score: {original_report.balance_score:.2f}")
    
    print(f"    Rebalanced Dataset:")
    print(f"      • Scenarios: {len(rebalanced_scenarios)} (+{len(rebalanced_scenarios) - len(imbalanced_scenarios)})")
    print(f"      • Balance Score: {rebalance_report.balance_score:.2f}")
    print(f"      • Improvement: {rebalance_report.balance_score - original_report.balance_score:+.2f}")
    
    # Optimization demonstration
    print("\n🎯 Dataset Optimization:")
    print("  Optimizing dataset composition for maximum balance...")
    
    optimized_scenarios = balancer.optimize_dataset_composition(
        target_size=30,
        strategy=BalanceStrategy.THERAPEUTIC_PRIORITY,
        quality_threshold=0.8
    )
    
    optimization_report = balancer.analyze_dataset_balance(
        optimized_scenarios,
        strategy=BalanceStrategy.THERAPEUTIC_PRIORITY
    )
    
    print(f"    Optimized Dataset:")
    print(f"      • Scenarios: {len(optimized_scenarios)}")
    print(f"      • Balance Score: {optimization_report.balance_score:.2f}")
    print(f"      • Quality Threshold Met: {'✅ Yes' if optimization_report.balance_score >= 0.8 else '❌ No'}")
    
    # Balance requirements validation
    print("\n✅ Balance Requirements Validation:")
    
    # Define minimum requirements
    requirements = {
        "severity_levels": {
            SeverityLevel.MODERATE.value: 0.25,  # At least 25%
            SeverityLevel.SEVERE.value: 0.15     # At least 15%
        },
        "scenario_types": {
            ScenarioType.INITIAL_ASSESSMENT.value: 0.20,  # At least 20%
            ScenarioType.THERAPEUTIC_SESSION.value: 0.30   # At least 30%
        }
    }
    
    is_valid, violations = balancer.validate_balance_requirements(
        optimized_scenarios, requirements
    )
    
    print(f"    Requirements Validation: {'✅ Passed' if is_valid else '❌ Failed'}")
    if violations:
        print(f"    Violations Found:")
        for violation in violations[:3]:
            print(f"      • {violation}")
    else:
        print(f"    All requirements met!")
    
    # Statistics and reporting
    print("\n📈 Comprehensive Statistics:")
    
    all_reports = [original_report, rebalance_report, optimization_report]
    stats = balancer.get_balance_statistics(all_reports)
    
    print(f"    Analysis Summary:")
    print(f"      • Total Reports: {stats['total_reports']}")
    print(f"      • Average Balance Score: {stats['average_balance_score']:.2f}")
    print(f"      • Score Range: {min(r.balance_score for r in all_reports):.2f} - {max(r.balance_score for r in all_reports):.2f}")
    
    if stats['common_recommendations']:
        print(f"    Most Common Recommendations:")
        for rec, count in list(stats['common_recommendations'].items())[:2]:
            print(f"      • {rec} ({count} times)")
    
    # Export demonstration
    print("\n💾 Export Capabilities:")
    
    # Export balance report
    output_path = Path("demo_balance_report.json")
    success = balancer.export_balance_report(optimization_report, output_path)
    
    if success:
        print(f"    ✅ Balance report exported to {output_path}")
        print(f"    📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
        
        # Show JSON structure preview
        import json
        with open(output_path, 'r') as f:
            data = json.load(f)
        
        print(f"    📋 Report Structure:")
        balance_report = data['balance_report']
        print(f"      • Dataset ID: {balance_report['dataset_id']}")
        print(f"      • Balance Score: {balance_report['balance_score']:.2f}")
        print(f"      • Strategy: {balance_report['strategy_used'].replace('_', ' ').title()}")
        print(f"      • Distributions: {len(balance_report['distributions'])} categories")
        print(f"      • Recommendations: {len(balance_report['recommendations'])} items")
    else:
        print("    ❌ Export failed")
    
    # Show balancing features
    print("\n⚖️ Balancing Features:")
    print("  • Multi-strategy balance analysis (Equal, Prevalence, Therapeutic)")
    print("  • Comprehensive category coverage (DSM-5, PDM-2, Big Five)")
    print("  • Intelligent rebalancing with targeted scenario generation")
    print("  • Quality threshold optimization with iterative improvement")
    print("  • Requirements validation with detailed violation reporting")
    print("  • Statistical analysis across multiple balance metrics")
    print("  • Export capabilities for integration with training pipelines")
    print("  • Real-world clinical prevalence consideration")
    print("  • Therapeutic priority weighting for training effectiveness")
    print("  • Automated recommendation generation for dataset improvement")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Knowledge Category Balancer ensures that therapeutic training")
    print("datasets have balanced representation across all psychology knowledge")
    print("categories, preventing bias and ensuring comprehensive coverage of")
    print("clinical presentations. This is essential for training robust and")
    print("unbiased therapeutic AI systems that can handle diverse client needs.")


if __name__ == "__main__":
    main()
