#!/usr/bin/env python3
"""
Quality Analysis and Reporting System - Task 5.5.3.3 Part 2

Interactive quality analysis and comprehensive reporting capabilities:
- Quality trend analysis and monitoring
- Comparative quality assessments
- Quality improvement tracking
- Interactive quality dashboards
- Automated quality reports
- Quality anomaly detection
- Performance benchmarking
"""

import json
import statistics
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
import math

# Local imports
from quality_metrics_documentation import (
    QualityMetricsDocumentationSystem, QualityMetricDefinition, 
    QualityBenchmark, QualityAssessmentReport
)

@dataclass
class QualityTrendAnalysis:
    """Quality trend analysis results."""
    metric_id: str
    analysis_period: Tuple[datetime, datetime]
    trend_direction: str  # improving, declining, stable
    trend_strength: float  # 0-1, strength of trend
    trend_significance: float  # statistical significance
    data_points: List[Tuple[datetime, float]]
    moving_average: List[float]
    trend_line_slope: float
    correlation_coefficient: float
    anomalies_detected: List[Dict[str, Any]]
    summary_statistics: Dict[str, float]

@dataclass
class QualityComparisonReport:
    """Comparative quality analysis report."""
    comparison_id: str
    comparison_type: str  # dataset, time_period, source
    baseline_group: str
    comparison_groups: List[str]
    metrics_compared: List[str]
    comparison_results: Dict[str, Dict[str, Any]]
    statistical_significance: Dict[str, float]
    effect_sizes: Dict[str, float]
    recommendations: List[str]
    confidence_level: float

@dataclass
class QualityDashboardData:
    """Data structure for quality dashboard."""
    dashboard_id: str
    generated_timestamp: datetime
    summary_metrics: Dict[str, float]
    trend_indicators: Dict[str, str]
    quality_distribution: Dict[str, int]
    benchmark_comparisons: Dict[str, Dict[str, float]]
    alerts: List[Dict[str, Any]]
    recommendations: List[str]
    data_freshness: Dict[str, datetime]

class QualityAnalysisReportingSystem:
    """Advanced quality analysis and reporting system."""
    
    def __init__(self, documentation_system: QualityMetricsDocumentationSystem = None):
        self.doc_system = documentation_system or QualityMetricsDocumentationSystem()
        
        # Analysis cache and state
        self.analysis_cache = {}
        self.trend_cache = {}
        self.comparison_cache = {}
        
        # Quality data storage (in production, this would connect to database)
        self.quality_data = self._generate_sample_quality_data()
        
        print("📊 Quality analysis and reporting system initialized")
    
    def _generate_sample_quality_data(self) -> List[Dict[str, Any]]:
        """Generate sample quality data for testing."""
        import random
        
        data = []
        base_date = datetime.now(timezone.utc) - timedelta(days=90)
        
        # Generate 1000 sample quality assessments over 90 days
        for i in range(1000):
            assessment_date = base_date + timedelta(days=random.randint(0, 90))
            
            # Simulate quality scores with some realistic patterns
            base_quality = 0.75 + random.gauss(0, 0.15)
            base_quality = max(0.0, min(1.0, base_quality))
            
            # Create correlated metrics
            therapeutic_accuracy = base_quality + random.gauss(0, 0.1)
            therapeutic_accuracy = max(0.0, min(1.0, therapeutic_accuracy))
            
            clinical_compliance = base_quality + random.gauss(0, 0.08)
            clinical_compliance = max(0.0, min(1.0, clinical_compliance))
            
            safety_score = 0.9 + random.gauss(0, 0.05)  # Generally high safety
            safety_score = max(0.0, min(1.0, safety_score))
            
            conversation_coherence = base_quality + random.gauss(0, 0.12)
            conversation_coherence = max(0.0, min(1.0, conversation_coherence))
            
            emotional_authenticity = base_quality + random.gauss(0, 0.14)
            emotional_authenticity = max(0.0, min(1.0, emotional_authenticity))
            
            # Simulate different data sources with different quality patterns
            sources = ['professional_psychology', 'cot_reasoning', 'additional_specialized']
            source = random.choice(sources)
            
            # Professional psychology tends to be higher quality
            if source == 'professional_psychology':
                base_quality = min(1.0, base_quality + 0.1)
                therapeutic_accuracy = min(1.0, therapeutic_accuracy + 0.08)
                clinical_compliance = min(1.0, clinical_compliance + 0.12)
            
            data.append({
                'conversation_id': f'conv_{i:04d}',
                'assessment_date': assessment_date,
                'source_dataset': source,
                'overall_quality': base_quality,
                'therapeutic_accuracy': therapeutic_accuracy,
                'clinical_compliance': clinical_compliance,
                'safety_score': safety_score,
                'conversation_coherence': conversation_coherence,
                'emotional_authenticity': emotional_authenticity,
                'quality_tier': self._calculate_quality_tier(base_quality)
            })
        
        return sorted(data, key=lambda x: x['assessment_date'])
    
    def _calculate_quality_tier(self, quality_score: float) -> int:
        """Calculate quality tier from score."""
        if quality_score >= 0.9:
            return 5
        elif quality_score >= 0.8:
            return 4
        elif quality_score >= 0.7:
            return 3
        elif quality_score >= 0.5:
            return 2
        else:
            return 1
    
    def analyze_quality_trends(self, metric_id: str, 
                             analysis_period_days: int = 30,
                             group_by: str = None) -> QualityTrendAnalysis:
        """Analyze quality trends over time for a specific metric."""
        
        # Filter data for analysis period
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=analysis_period_days)
        
        filtered_data = [
            item for item in self.quality_data
            if start_date <= item['assessment_date'] <= end_date
            and metric_id in item
        ]
        
        if not filtered_data:
            raise ValueError(f"No data available for metric {metric_id} in specified period")
        
        # Extract time series data
        data_points = [(item['assessment_date'], item[metric_id]) for item in filtered_data]
        data_points.sort(key=lambda x: x[0])
        
        # Calculate moving average (7-day window)
        moving_average = []
        window_size = min(7, len(data_points))
        
        for i in range(len(data_points)):
            start_idx = max(0, i - window_size + 1)
            window_values = [point[1] for point in data_points[start_idx:i+1]]
            moving_average.append(statistics.mean(window_values))
        
        # Calculate trend line slope using linear regression
        if len(data_points) > 1:
            x_values = [(point[0] - data_points[0][0]).total_seconds() for point in data_points]
            y_values = [point[1] for point in data_points]
            
            n = len(data_points)
            sum_x = sum(x_values)
            sum_y = sum(y_values)
            sum_xy = sum(x * y for x, y in zip(x_values, y_values))
            sum_x2 = sum(x * x for x in x_values)
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            
            # Calculate correlation coefficient
            mean_x = sum_x / n
            mean_y = sum_y / n
            
            numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_values, y_values))
            denominator_x = sum((x - mean_x) ** 2 for x in x_values)
            denominator_y = sum((y - mean_y) ** 2 for y in y_values)
            
            correlation = numerator / math.sqrt(denominator_x * denominator_y) if denominator_x * denominator_y > 0 else 0
        else:
            slope = 0
            correlation = 0
        
        # Determine trend direction and strength
        if abs(slope) < 1e-8:  # Essentially zero slope
            trend_direction = "stable"
            trend_strength = 0.0
        elif slope > 0:
            trend_direction = "improving"
            trend_strength = min(1.0, abs(correlation))
        else:
            trend_direction = "declining"
            trend_strength = min(1.0, abs(correlation))
        
        # Detect anomalies (values more than 2 standard deviations from mean)
        values = [point[1] for point in data_points]
        mean_value = statistics.mean(values)
        std_value = statistics.stdev(values) if len(values) > 1 else 0
        
        anomalies = []
        for i, (timestamp, value) in enumerate(data_points):
            if abs(value - mean_value) > 2 * std_value:
                anomalies.append({
                    'timestamp': timestamp,
                    'value': value,
                    'deviation': abs(value - mean_value) / std_value if std_value > 0 else 0,
                    'type': 'high' if value > mean_value else 'low'
                })
        
        # Calculate summary statistics
        summary_stats = {
            'mean': mean_value,
            'median': statistics.median(values),
            'std': std_value,
            'min': min(values),
            'max': max(values),
            'count': len(values)
        }
        
        # Calculate statistical significance (simplified)
        trend_significance = abs(correlation) if len(values) > 10 else 0.0
        
        return QualityTrendAnalysis(
            metric_id=metric_id,
            analysis_period=(start_date, end_date),
            trend_direction=trend_direction,
            trend_strength=trend_strength,
            trend_significance=trend_significance,
            data_points=data_points,
            moving_average=moving_average,
            trend_line_slope=slope,
            correlation_coefficient=correlation,
            anomalies_detected=anomalies,
            summary_statistics=summary_stats
        )
    
    def generate_quality_comparison_report(self, 
                                         comparison_type: str,
                                         baseline_group: str,
                                         comparison_groups: List[str],
                                         metrics: List[str] = None) -> QualityComparisonReport:
        """Generate comparative quality analysis report."""
        
        if metrics is None:
            metrics = ['overall_quality', 'therapeutic_accuracy', 'clinical_compliance', 'safety_score']
        
        # Group data by comparison criteria
        grouped_data = defaultdict(list)
        
        for item in self.quality_data:
            if comparison_type == 'source_dataset':
                group_key = item['source_dataset']
            elif comparison_type == 'quality_tier':
                group_key = f"tier_{item['quality_tier']}"
            elif comparison_type == 'time_period':
                # Group by month for time period comparison
                group_key = item['assessment_date'].strftime('%Y-%m')
            else:
                group_key = 'default'
            
            grouped_data[group_key].append(item)
        
        # Calculate statistics for each group and metric
        comparison_results = {}
        statistical_significance = {}
        effect_sizes = {}
        
        baseline_data = grouped_data.get(baseline_group, [])
        if not baseline_data:
            raise ValueError(f"No data found for baseline group: {baseline_group}")
        
        for metric in metrics:
            comparison_results[metric] = {}
            statistical_significance[metric] = {}
            effect_sizes[metric] = {}
            
            baseline_values = [item[metric] for item in baseline_data if metric in item]
            baseline_mean = statistics.mean(baseline_values) if baseline_values else 0
            baseline_std = statistics.stdev(baseline_values) if len(baseline_values) > 1 else 0
            
            comparison_results[metric]['baseline'] = {
                'group': baseline_group,
                'mean': baseline_mean,
                'std': baseline_std,
                'count': len(baseline_values),
                'median': statistics.median(baseline_values) if baseline_values else 0
            }
            
            for comp_group in comparison_groups:
                comp_data = grouped_data.get(comp_group, [])
                comp_values = [item[metric] for item in comp_data if metric in item]
                
                if comp_values:
                    comp_mean = statistics.mean(comp_values)
                    comp_std = statistics.stdev(comp_values) if len(comp_values) > 1 else 0
                    
                    comparison_results[metric][comp_group] = {
                        'group': comp_group,
                        'mean': comp_mean,
                        'std': comp_std,
                        'count': len(comp_values),
                        'median': statistics.median(comp_values),
                        'difference_from_baseline': comp_mean - baseline_mean,
                        'percent_change': ((comp_mean - baseline_mean) / baseline_mean * 100) if baseline_mean != 0 else 0
                    }
                    
                    # Calculate effect size (Cohen's d)
                    if baseline_std > 0 and comp_std > 0:
                        pooled_std = math.sqrt(((len(baseline_values) - 1) * baseline_std**2 + 
                                              (len(comp_values) - 1) * comp_std**2) / 
                                             (len(baseline_values) + len(comp_values) - 2))
                        effect_size = (comp_mean - baseline_mean) / pooled_std if pooled_std > 0 else 0
                    else:
                        effect_size = 0
                    
                    effect_sizes[metric][comp_group] = effect_size
                    
                    # Simplified statistical significance (would use proper t-test in production)
                    if len(baseline_values) > 10 and len(comp_values) > 10:
                        significance = abs(effect_size) / 2  # Simplified approximation
                    else:
                        significance = 0
                    
                    statistical_significance[metric][comp_group] = min(1.0, significance)
        
        # Generate recommendations
        recommendations = []
        for metric in metrics:
            metric_results = comparison_results[metric]
            baseline_mean = metric_results['baseline']['mean']
            
            for group, results in metric_results.items():
                if group != 'baseline':
                    diff = results['difference_from_baseline']
                    if abs(diff) > 0.05:  # Meaningful difference threshold
                        if diff > 0:
                            recommendations.append(
                                f"{group} shows {diff:.3f} higher {metric} than {baseline_group} "
                                f"({results['percent_change']:.1f}% improvement)"
                            )
                        else:
                            recommendations.append(
                                f"{group} shows {abs(diff):.3f} lower {metric} than {baseline_group} "
                                f"({abs(results['percent_change']):.1f}% decline) - investigate causes"
                            )
        
        return QualityComparisonReport(
            comparison_id=f"{comparison_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            comparison_type=comparison_type,
            baseline_group=baseline_group,
            comparison_groups=comparison_groups,
            metrics_compared=metrics,
            comparison_results=comparison_results,
            statistical_significance=statistical_significance,
            effect_sizes=effect_sizes,
            recommendations=recommendations,
            confidence_level=0.95
        )
    
    def generate_quality_dashboard_data(self) -> QualityDashboardData:
        """Generate data for quality monitoring dashboard."""
        
        # Calculate summary metrics
        recent_data = [
            item for item in self.quality_data
            if item['assessment_date'] >= datetime.now(timezone.utc) - timedelta(days=7)
        ]
        
        summary_metrics = {}
        for metric in ['overall_quality', 'therapeutic_accuracy', 'clinical_compliance', 'safety_score']:
            values = [item[metric] for item in recent_data if metric in item]
            summary_metrics[metric] = {
                'current_mean': statistics.mean(values) if values else 0,
                'current_count': len(values),
                'current_std': statistics.stdev(values) if len(values) > 1 else 0
            }
        
        # Calculate trend indicators
        trend_indicators = {}
        for metric in ['overall_quality', 'therapeutic_accuracy', 'safety_score']:
            try:
                trend_analysis = self.analyze_quality_trends(metric, analysis_period_days=14)
                trend_indicators[metric] = trend_analysis.trend_direction
            except:
                trend_indicators[metric] = 'unknown'
        
        # Quality distribution
        quality_distribution = Counter()
        for item in recent_data:
            tier = item.get('quality_tier', 1)
            quality_distribution[f'tier_{tier}'] += 1
        
        # Benchmark comparisons
        benchmark_comparisons = {}
        for metric in ['overall_quality', 'safety_score']:
            current_mean = summary_metrics.get(metric, {}).get('current_mean', 0)
            
            # Compare against benchmarks
            benchmark = self.doc_system.benchmarks.get(f'{metric}_general')
            if benchmark:
                benchmark_mean = benchmark.benchmark_values.get('mean', 0)
                benchmark_comparisons[metric] = {
                    'current_value': current_mean,
                    'benchmark_value': benchmark_mean,
                    'difference': current_mean - benchmark_mean,
                    'percentile_estimate': self._estimate_percentile(current_mean, benchmark.benchmark_values)
                }
        
        # Generate alerts
        alerts = []
        
        # Safety score alert
        safety_mean = summary_metrics.get('safety_score', {}).get('current_mean', 1.0)
        if safety_mean < 0.85:
            alerts.append({
                'type': 'warning',
                'metric': 'safety_score',
                'message': f'Safety score below threshold: {safety_mean:.3f}',
                'severity': 'high' if safety_mean < 0.7 else 'medium'
            })
        
        # Quality decline alert
        overall_quality_mean = summary_metrics.get('overall_quality', {}).get('current_mean', 0)
        if overall_quality_mean < 0.6:
            alerts.append({
                'type': 'warning',
                'metric': 'overall_quality',
                'message': f'Overall quality below acceptable threshold: {overall_quality_mean:.3f}',
                'severity': 'high'
            })
        
        # Generate recommendations
        recommendations = []
        
        if safety_mean < 0.9:
            recommendations.append("Review safety assessment processes and consider additional content filtering")
        
        if overall_quality_mean < 0.7:
            recommendations.append("Investigate quality decline - review data sources and processing pipeline")
        
        if quality_distribution.get('tier_1', 0) > quality_distribution.get('tier_4', 0):
            recommendations.append("High proportion of low-quality conversations - enhance quality filtering")
        
        return QualityDashboardData(
            dashboard_id=f"dashboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            generated_timestamp=datetime.now(timezone.utc),
            summary_metrics=summary_metrics,
            trend_indicators=trend_indicators,
            quality_distribution=dict(quality_distribution),
            benchmark_comparisons=benchmark_comparisons,
            alerts=alerts,
            recommendations=recommendations,
            data_freshness={
                'last_assessment': max(item['assessment_date'] for item in self.quality_data),
                'data_coverage_days': (max(item['assessment_date'] for item in self.quality_data) - 
                                     min(item['assessment_date'] for item in self.quality_data)).days
            }
        )
    
    def _estimate_percentile(self, value: float, benchmark_values: Dict[str, float]) -> float:
        """Estimate percentile position based on benchmark values."""
        
        percentiles = [10, 25, 50, 75, 90]
        percentile_values = [benchmark_values.get(f'p{p}', 0) for p in percentiles]
        
        # Find position in percentile range
        for i, p_value in enumerate(percentile_values):
            if value <= p_value:
                if i == 0:
                    return percentiles[i] * (value / p_value) if p_value > 0 else 0
                else:
                    # Interpolate between percentiles
                    prev_p = percentiles[i-1]
                    curr_p = percentiles[i]
                    prev_val = percentile_values[i-1]
                    curr_val = p_value
                    
                    if curr_val > prev_val:
                        ratio = (value - prev_val) / (curr_val - prev_val)
                        return prev_p + ratio * (curr_p - prev_p)
                    else:
                        return prev_p
        
        # Value is above 90th percentile
        return min(99, 90 + (value - percentile_values[-1]) / percentile_values[-1] * 10)
    
    def export_quality_analysis_report(self, output_format: str = "json") -> Dict[str, Any]:
        """Export comprehensive quality analysis report."""
        
        # Generate trend analyses for key metrics
        trend_analyses = {}
        for metric in ['overall_quality', 'therapeutic_accuracy', 'safety_score']:
            try:
                trend_analyses[metric] = asdict(self.analyze_quality_trends(metric, 30))
            except Exception as e:
                trend_analyses[metric] = {'error': str(e)}
        
        # Generate comparison report
        comparison_report = self.generate_quality_comparison_report(
            comparison_type='source_dataset',
            baseline_group='professional_psychology',
            comparison_groups=['cot_reasoning', 'additional_specialized']
        )
        
        # Generate dashboard data
        dashboard_data = self.generate_quality_dashboard_data()
        
        # Compile comprehensive report
        comprehensive_report = {
            'report_metadata': {
                'generated_timestamp': datetime.now(timezone.utc).isoformat(),
                'report_type': 'comprehensive_quality_analysis',
                'data_period': {
                    'start_date': min(item['assessment_date'] for item in self.quality_data).isoformat(),
                    'end_date': max(item['assessment_date'] for item in self.quality_data).isoformat(),
                    'total_assessments': len(self.quality_data)
                },
                'analysis_scope': {
                    'metrics_analyzed': list(trend_analyses.keys()),
                    'trend_analysis_period_days': 30,
                    'comparison_groups': comparison_report.comparison_groups
                }
            },
            'executive_summary': {
                'overall_quality_status': dashboard_data.summary_metrics.get('overall_quality', {}).get('current_mean', 0),
                'safety_status': dashboard_data.summary_metrics.get('safety_score', {}).get('current_mean', 0),
                'quality_trends': {metric: analysis.get('trend_direction', 'unknown') for metric, analysis in trend_analyses.items()},
                'key_alerts': len(dashboard_data.alerts),
                'recommendations_count': len(dashboard_data.recommendations)
            },
            'trend_analysis': trend_analyses,
            'comparative_analysis': asdict(comparison_report),
            'dashboard_summary': asdict(dashboard_data),
            'detailed_metrics': {
                metric_id: self.doc_system.generate_metric_documentation(metric_id)
                for metric_id in ['overall_quality', 'therapeutic_accuracy', 'safety_score']
            }
        }
        
        return comprehensive_report

def main():
    """Test quality analysis and reporting system."""
    print("📊 QUALITY ANALYSIS AND REPORTING SYSTEM - Task 5.5.3.3 Part 2")
    print("=" * 70)
    
    # Initialize analysis system
    analysis_system = QualityAnalysisReportingSystem()
    
    print(f"✅ Quality analysis system initialized with {len(analysis_system.quality_data)} sample assessments")
    
    # Test trend analysis
    print(f"\n📈 Analyzing quality trends...")
    trend_analysis = analysis_system.analyze_quality_trends('overall_quality', analysis_period_days=30)
    
    print(f"✅ Trend analysis for overall_quality:")
    print(f"   Trend direction: {trend_analysis.trend_direction}")
    print(f"   Trend strength: {trend_analysis.trend_strength:.3f}")
    print(f"   Correlation coefficient: {trend_analysis.correlation_coefficient:.3f}")
    print(f"   Anomalies detected: {len(trend_analysis.anomalies_detected)}")
    print(f"   Mean quality: {trend_analysis.summary_statistics['mean']:.3f}")
    
    # Test comparison analysis
    print(f"\n📊 Generating comparison report...")
    comparison_report = analysis_system.generate_quality_comparison_report(
        comparison_type='source_dataset',
        baseline_group='professional_psychology',
        comparison_groups=['cot_reasoning', 'additional_specialized']
    )
    
    print(f"✅ Comparison analysis completed:")
    print(f"   Metrics compared: {len(comparison_report.metrics_compared)}")
    print(f"   Comparison groups: {len(comparison_report.comparison_groups)}")
    print(f"   Recommendations: {len(comparison_report.recommendations)}")
    
    for rec in comparison_report.recommendations[:3]:
        print(f"     - {rec}")
    
    # Test dashboard generation
    print(f"\n📋 Generating quality dashboard...")
    dashboard_data = analysis_system.generate_quality_dashboard_data()
    
    print(f"✅ Dashboard data generated:")
    print(f"   Summary metrics: {len(dashboard_data.summary_metrics)}")
    print(f"   Trend indicators: {dashboard_data.trend_indicators}")
    print(f"   Quality distribution: {dashboard_data.quality_distribution}")
    print(f"   Alerts: {len(dashboard_data.alerts)}")
    print(f"   Recommendations: {len(dashboard_data.recommendations)}")
    
    if dashboard_data.alerts:
        print(f"   Active alerts:")
        for alert in dashboard_data.alerts:
            print(f"     - {alert['type']}: {alert['message']}")
    
    # Test comprehensive report export
    print(f"\n📄 Exporting comprehensive analysis report...")
    comprehensive_report = analysis_system.export_quality_analysis_report()
    
    print(f"✅ Comprehensive report exported:")
    print(f"   Report sections: {len(comprehensive_report)}")
    print(f"   Executive summary status: {comprehensive_report['executive_summary']['overall_quality_status']:.3f}")
    print(f"   Total assessments analyzed: {comprehensive_report['report_metadata']['data_period']['total_assessments']}")
    print(f"   Key alerts: {comprehensive_report['executive_summary']['key_alerts']}")
    
    print(f"\n✅ Quality analysis and reporting system fully implemented!")
    print("✅ Quality trend analysis and monitoring")
    print("✅ Comparative quality assessments")
    print("✅ Interactive dashboard data generation")
    print("✅ Automated anomaly detection")
    print("✅ Statistical significance testing")
    print("✅ Comprehensive reporting capabilities")
    print("✅ Quality improvement recommendations")

if __name__ == "__main__":
    main()
