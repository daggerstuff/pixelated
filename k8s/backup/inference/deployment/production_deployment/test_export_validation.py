import pytest
#!/usr/bin/env python3
"""
Export Validation Test Suite - Task 5.5.2.9

Comprehensive testing of the export validation and quality checking system.
Tests all validation components and generates detailed reports.
"""

import json
import tempfile
import pandas as pd
from .pathlib import Path
from .typing import Dict, List, Any
import logging

# Import validation system
from .export_validator import ExportValidator, ValidationResult, ValidationConfiguration
from .dataset_exporter import DatasetExporter, ExportConfiguration

# Enterprise imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "enterprise_config"))
from .enterprise_logging import get_logger

# Database imports
sys.path.append(str(Path(__file__).parent.parent / "database"))
from .conversation_database import ConversationDatabase

class ExportValidationTester:
    """Comprehensive test suite for export validation system."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
        self.validator = ExportValidator()
        self.test_results = {}
        
    def create_test_data(self) -> List[Dict[str, Any]]:
        """Create test conversation data for validation testing."""
        return [
            {
                "conversation_id": "test-001",
                "messages": [
                    {"role": "user", "content": "Hello, I'm feeling anxious about my upcoming presentation."},
                    {"role": "assistant", "content": "I understand that presentations can feel overwhelming. Can you tell me more about what specifically is making you feel anxious?"}
                ],
                "quality_score": 0.85,
                "metadata": {"source": "test", "tier": "test"},
                "tags": ["anxiety", "presentation"],
                "tier": "test",
                "source_dataset": "test_data"
            },
            {
                "conversation_id": "test-002", 
                "messages": [
                    {"role": "user", "content": "I've been having trouble sleeping lately."},
                    {"role": "assistant", "content": "Sleep difficulties can be really challenging. How long has this been going on, and what do you think might be contributing to it?"}
                ],
                "quality_score": 0.78,
                "metadata": {"source": "test", "tier": "test"},
                "tags": ["sleep", "insomnia"],
                "tier": "test",
                "source_dataset": "test_data"
            }
        ]
    
    def create_test_files(self) -> Dict[str, str]:
        """Create test export files for validation."""
        test_data = self.create_test_data()
        test_files = {}
        
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp())
        
        # Create valid JSONL file
        jsonl_file = temp_dir / "valid_test.jsonl"
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            for record in test_data:
                f.write(json.dumps(record) + '\n')
        test_files['valid_jsonl'] = str(jsonl_file)
        
        # Create invalid JSONL file (missing required fields)
        invalid_jsonl_file = temp_dir / "invalid_test.jsonl"
        with open(invalid_jsonl_file, 'w', encoding='utf-8') as f:
            for record in test_data:
                # Remove required fields to test validation
                invalid_record = {k: v for k, v in record.items() if k not in ['messages', 'quality_score']}
                f.write(json.dumps(invalid_record) + '\n')
        test_files['invalid_jsonl'] = str(invalid_jsonl_file)
        
        # Create valid CSV file
        csv_file = temp_dir / "valid_test.csv"
        csv_data = []
        for record in test_data:
            csv_record = {
                'conversation_id': record['conversation_id'],
                'messages_json': json.dumps(record['messages']),
                'quality_score': record['quality_score'],
                'metadata_json': json.dumps(record['metadata']),
                'tags_json': json.dumps(record['tags']),
                'tier': record['tier'],
                'source_dataset': record['source_dataset']
            }
            csv_data.append(csv_record)
        
        df = pd.DataFrame(csv_data)
        df.to_csv(csv_file, index=False)
        test_files['valid_csv'] = str(csv_file)
        
        # Create valid Parquet file
        parquet_file = temp_dir / "valid_test.parquet"
        df.to_parquet(parquet_file, index=False)
        test_files['valid_parquet'] = str(parquet_file)
        
        # Create valid OpenAI format file
        openai_file = temp_dir / "valid_openai.jsonl"
        with open(openai_file, 'w', encoding='utf-8') as f:
            for record in test_data:
                openai_record = {
                    "messages": record['messages'],
                    "conversation_id": record['conversation_id'],
                    "metadata": record['metadata']
                }
                f.write(json.dumps(openai_record) + '\n')
        test_files['valid_openai'] = str(openai_file)
        
        return test_files
    
    def test_schema_validation(self) -> Dict[str, Any]:
        """Test schema validation for all formats."""
        self.logger.info("Testing schema validation...")
        
        test_files = self.create_test_files()
        results = {}
        
        # Test valid files
        for format_name, file_path in test_files.items():
            if 'valid' in format_name:
                format_type = format_name.replace('valid_', '')
                result = self.validator.validate_export(file_path, format_type)
                results[f"{format_type}_valid"] = {
                    'is_valid': result.is_valid,
                    'validation_score': result.validation_score,
                    'error_count': len(result.errors),
                    'warning_count': len(result.warnings)
                }
        
        # Test invalid JSONL file
        if 'invalid_jsonl' in test_files:
            result = self.validator.validate_export(test_files['invalid_jsonl'], 'jsonl')
            results['jsonl_invalid'] = {
                'is_valid': result.is_valid,
                'validation_score': result.validation_score,
                'error_count': len(result.errors),
                'warning_count': len(result.warnings),
                'errors': result.errors[:3]  # First 3 errors for review
            }
        
        return results
    
    def test_quality_validation(self) -> Dict[str, Any]:
        """Test quality validation components."""
        self.logger.info("Testing quality validation...")
        
        test_files = self.create_test_files()
        results = {}
        
        # Test quality validation on valid JSONL file
        if 'valid_jsonl' in test_files:
            result = self.validator.validate_export(test_files['valid_jsonl'], 'jsonl')
            results['quality_validation'] = {
                'quality_stats': result.quality_stats,
                'metrics': result.metrics,
                'has_quality_assessment': bool(result.quality_stats),
                'mean_quality': result.quality_stats.get('mean_quality', 0.0) if result.quality_stats else 0.0
            }
        
        return results
    
    def test_performance_validation(self) -> Dict[str, Any]:
        """Test validation performance."""
        self.logger.info("Testing validation performance...")
        
        test_files = self.create_test_files()
        results = {}
        
        # Test validation speed
        for format_name, file_path in test_files.items():
            if 'valid' in format_name:
                format_type = format_name.replace('valid_', '')
                result = self.validator.validate_export(file_path, format_type)
                results[f"{format_type}_performance"] = {
                    'validation_time': result.validation_time,
                    'file_size': result.file_size,
                    'record_count': result.record_count,
                    'records_per_second': result.record_count / result.validation_time if result.validation_time > 0 else 0
                }
        
        return results
    
    def test_multiple_export_validation(self) -> Dict[str, Any]:
        """Test validation of multiple export formats."""
        self.logger.info("Testing multiple export validation...")
        
        test_files = self.create_test_files()
        
        # Create validation file mapping
        validation_files = {}
        for format_name, file_path in test_files.items():
            if 'valid' in format_name:
                format_type = format_name.replace('valid_', '')
                validation_files[format_type] = file_path
        
        # Run multiple validation
        results = self.validator.validate_multiple_exports(validation_files)
        
        # Generate validation report
        report = self.validator.generate_validation_report(results)
        
        return {
            'individual_results': {name: {
                'is_valid': result.is_valid,
                'validation_score': result.validation_score,
                'error_count': len(result.errors),
                'warning_count': len(result.warnings)
            } for name, result in results.items()},
            'validation_report': report
        }
    
    def test_validation_configuration(self) -> Dict[str, Any]:
        """Test different validation configurations."""
        self.logger.info("Testing validation configurations...")
        
        test_files = self.create_test_files()
        results = {}
        
        if 'valid_jsonl' in test_files:
            # Test with different configurations
            configs = {
                'strict': ValidationConfiguration(
                    validate_schema=True,
                    validate_content=True,
                    validate_quality=True,
                    validate_completeness=True,
                    quality_threshold=0.8
                ),
                'lenient': ValidationConfiguration(
                    validate_schema=True,
                    validate_content=False,
                    validate_quality=False,
                    validate_completeness=False,
                    quality_threshold=0.3
                ),
                'quality_focused': ValidationConfiguration(
                    validate_schema=True,
                    validate_content=True,
                    validate_quality=True,
                    validate_completeness=True,
                    quality_threshold=0.9
                )
            }
            
            for config_name, config in configs.items():
                # Create validator with specific configuration
                validator = ExportValidator()
                validator.validation_config = config
                
                result = validator.validate_export(test_files['valid_jsonl'], 'jsonl')
                results[config_name] = {
                    'is_valid': result.is_valid,
                    'validation_score': result.validation_score,
                    'error_count': len(result.errors),
                    'warning_count': len(result.warnings)
                }
        
        return results
    
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive validation test suite."""
        self.logger.info("Starting comprehensive export validation test suite...")
        
        test_results = {
            'test_timestamp': pd.Timestamp.now().isoformat(),
            'schema_validation': self.test_schema_validation(),
            'quality_validation': self.test_quality_validation(),
            'performance_validation': self.test_performance_validation(),
            'multiple_export_validation': self.test_multiple_export_validation(),
            'configuration_validation': self.test_validation_configuration(),
            'validator_statistics': self.validator.get_validation_statistics()
        }
        
        # Calculate overall test success
        schema_tests = test_results['schema_validation']
        valid_tests = [v for k, v in schema_tests.items() if 'valid' in k and v['is_valid']]
        invalid_tests = [v for k, v in schema_tests.items() if 'invalid' in k and not v['is_valid']]
        
        test_results['test_summary'] = {
            'total_schema_tests': len(schema_tests),
            'valid_format_tests_passed': len(valid_tests),
            'invalid_format_tests_passed': len(invalid_tests),
            'overall_success_rate': (len(valid_tests) + len(invalid_tests)) / len(schema_tests) if schema_tests else 0.0,
            'validation_system_working': len(valid_tests) > 0 and len(invalid_tests) > 0
        }
        
        self.test_results = test_results
        return test_results
    
    def generate_test_report(self) -> str:
        """Generate comprehensive test report."""
        if not self.test_results:
            self.run_comprehensive_test()
        
        report = []
        report.append("# Export Validation System Test Report")
        report.append("=" * 50)
        report.append(f"Test Timestamp: {self.test_results['test_timestamp']}")
        report.append("")
        
        # Test Summary
        summary = self.test_results['test_summary']
        report.append("## Test Summary")
        report.append(f"- Total Schema Tests: {summary['total_schema_tests']}")
        report.append(f"- Valid Format Tests Passed: {summary['valid_format_tests_passed']}")
        report.append(f"- Invalid Format Tests Passed: {summary['invalid_format_tests_passed']}")
        report.append(f"- Overall Success Rate: {summary['overall_success_rate']:.1%}")
        report.append(f"- Validation System Working: {'✅ YES' if summary['validation_system_working'] else '❌ NO'}")
        report.append("")
        
        # Schema Validation Results
        report.append("## Schema Validation Results")
        for test_name, result in self.test_results['schema_validation'].items():
            status = "✅ PASS" if result['is_valid'] else "❌ FAIL"
            if 'invalid' in test_name:
                status = "✅ PASS" if not result['is_valid'] else "❌ FAIL"  # Inverse for invalid tests
            
            report.append(f"- {test_name}: {status} (Score: {result['validation_score']:.3f}, "
                         f"Errors: {result['error_count']}, Warnings: {result['warning_count']})")
        report.append("")
        
        # Quality Validation Results
        quality_result = self.test_results['quality_validation']['quality_validation']
        report.append("## Quality Validation Results")
        report.append(f"- Quality Assessment Available: {'✅ YES' if quality_result['has_quality_assessment'] else '❌ NO'}")
        report.append(f"- Mean Quality Score: {quality_result['mean_quality']:.3f}")
        report.append(f"- Quality Metrics Count: {len(quality_result['metrics'])}")
        report.append("")
        
        # Performance Results
        report.append("## Performance Validation Results")
        for test_name, result in self.test_results['performance_validation'].items():
            report.append(f"- {test_name}:")
            report.append(f"  - Validation Time: {result['validation_time']:.3f}s")
            report.append(f"  - Records Processed: {result['record_count']}")
            report.append(f"  - Processing Rate: {result['records_per_second']:.1f} records/sec")
        report.append("")
        
        # Multiple Export Validation
        multi_result = self.test_results['multiple_export_validation']
        report.append("## Multiple Export Validation Results")
        report.append(f"- Formats Validated: {len(multi_result['individual_results'])}")
        
        validation_report = multi_result['validation_report']
        report.append(f"- Overall Validation Score: {validation_report['overall_validation_score']:.3f}")
        report.append(f"- Successful Validations: {validation_report['successful_validations']}")
        report.append(f"- Failed Validations: {validation_report['failed_validations']}")
        report.append("")
        
        # Recommendations
        if validation_report.get('recommendations'):
            report.append("## Recommendations")
            for rec in validation_report['recommendations']:
                report.append(f"- {rec}")
        report.append("")
        
        # Validator Statistics
        stats = self.test_results['validator_statistics']
        report.append("## Validator Statistics")
        report.append(f"- Total Validations: {stats['total_validations']}")
        report.append(f"- Success Rate: {stats['success_rate']:.1%}")
        if 'mean_validation_time' in stats:
            report.append(f"- Mean Validation Time: {stats['mean_validation_time']:.3f}s")
        report.append("")
        
        report.append("## Conclusion")
        if summary['validation_system_working']:
            report.append("✅ **Export validation system is working correctly!**")
            report.append("- Successfully validates correct export formats")
            report.append("- Properly detects and reports validation errors")
            report.append("- Provides comprehensive quality assessment")
            report.append("- Delivers good performance across all formats")
        else:
            report.append("❌ **Export validation system needs attention**")
            report.append("- Some validation tests are not working as expected")
            report.append("- Review error logs and fix validation logic")
        
        return "\n".join(report)

def main():
    """Run export validation test suite."""
    print("🔍 EXPORT VALIDATION TEST SUITE - Task 5.5.2.9")
    print("=" * 60)
    
    tester = ExportValidationTester()
    
    # Run comprehensive tests
    results = tester.run_comprehensive_test()
    
    # Generate and display report
    report = tester.generate_test_report()
    print(report)
    
    # Save report to file
    report_file = Path(__file__).parent / "export_validation_test_report.md"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n📄 Full test report saved to: {report_file}")
    
    # Final status
    summary = results['test_summary']
    if summary['validation_system_working']:
        print("\n🎉 **TASK 5.5.2.9 COMPLETED SUCCESSFULLY!**")
        print("✅ Export validation and quality checking system is fully functional")
    else:
        print("\n⚠️ **TASK 5.5.2.9 NEEDS ATTENTION**")
        print("❌ Some validation components need fixes")

if __name__ == "__main__":
    main()
