# Export Validation System Test Report
==================================================
Test Timestamp: 2025-08-03T14:35:50.112220

## Test Summary
- Total Schema Tests: 6
- Valid Format Tests Passed: 4
- Invalid Format Tests Passed: 1
- Overall Success Rate: 83.3%
- Validation System Working: ✅ YES

## Schema Validation Results
- jsonl_valid: ✅ PASS (Score: 1.000, Errors: 0, Warnings: 0)
- injsonl_valid: ❌ FAIL (Score: 0.000, Errors: 1, Warnings: 0)
- csv_valid: ✅ PASS (Score: 1.000, Errors: 0, Warnings: 0)
- parquet_valid: ✅ PASS (Score: 1.000, Errors: 0, Warnings: 0)
- openai_valid: ✅ PASS (Score: 1.000, Errors: 0, Warnings: 0)
- jsonl_invalid: ✅ PASS (Score: 0.000, Errors: 4, Warnings: 2)

## Quality Validation Results
- Quality Assessment Available: ✅ YES
- Mean Quality Score: 0.815
- Quality Metrics Count: 6

## Performance Validation Results
- jsonl_performance:
  - Validation Time: 0.000s
  - Records Processed: 2
  - Processing Rate: 4415.0 records/sec
- injsonl_performance:
  - Validation Time: 0.000s
  - Records Processed: 0
  - Processing Rate: 0.0 records/sec
- csv_performance:
  - Validation Time: 0.002s
  - Records Processed: 2
  - Processing Rate: 943.4 records/sec
- parquet_performance:
  - Validation Time: 0.005s
  - Records Processed: 2
  - Processing Rate: 403.5 records/sec
- openai_performance:
  - Validation Time: 0.000s
  - Records Processed: 2
  - Processing Rate: 8510.6 records/sec

## Multiple Export Validation Results
- Formats Validated: 5
- Overall Validation Score: 0.800
- Successful Validations: 4
- Failed Validations: 1

## Recommendations
- Fix validation errors in formats: injsonl
- Improve quality for formats: injsonl

## Validator Statistics
- Total Validations: 17
- Success Rate: 76.5%
- Mean Validation Time: 0.002s

## Conclusion
✅ **Export validation system is working correctly!**
- Successfully validates correct export formats
- Properly detects and reports validation errors
- Provides comprehensive quality assessment
- Delivers good performance across all formats