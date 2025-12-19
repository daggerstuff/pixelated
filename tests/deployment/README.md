# Deployment Pipeline Testing Suite

This comprehensive testing suite validates the deployment pipeline improvement implementation through both unit tests and integration tests.

## Overview

The testing suite is organized into two main categories:

### Unit Tests
- **Environment Manager**: Tests Node.js and pnpm installation and verification functions
- **Backup Manager**: Tests backup preservation, archiving, and rollback command generation
- **Container Manager**: Tests container building, health checks, and traffic switching
- **Registry Manager**: Tests GitLab registry integration and rollback support
- **Secure Environment Manager**: Tests environment file encryption, transfer, and secure deployment

### Integration Tests
- **End-to-End Deployment**: Tests complete deployment scenarios from start to finish
- **Failure Scenarios**: Tests various failure conditions and recovery mechanisms
- **Rollback Procedures**: Tests rollback and recovery mechanisms
- **Performance Timing**: Tests deployment performance requirements and timing validation
- **Secure Environment Deployment**: Tests end-to-end secure environment variable handling

## Quick Start

### Run All Tests
```bash
# Run both unit and integration tests
./tests/deployment/run_all_tests.sh

# Run with verbose output
./tests/deployment/run_all_tests.sh --verbose
```

### Run Specific Test Categories
```bash
# Run only unit tests
./tests/deployment/run_all_tests.sh --unit-only

# Run only integration tests
./tests/deployment/run_all_tests.sh --integration-only
```

### Run Individual Test Components
```bash
# Run unit tests for specific components
./tests/deployment/run_unit_tests.sh --component environment
./tests/deployment/run_unit_tests.sh --component backup
./tests/deployment/run_unit_tests.sh --component container

# Run integration tests for specific scenarios
./tests/deployment/integration/run_integration_tests.sh --scenario e2e
./tests/deployment/integration/run_integration_tests.sh --scenario failures
```

## Test Structure

```
tests/deployment/
├── README.md                           # This file
├── run_all_tests.sh                   # Comprehensive test runner
├── run_unit_tests.sh                  # Unit test runner
├── test_environment_manager.sh        # Environment Manager unit tests
├── test_backup_manager.sh             # Backup Manager unit tests
├── test_container_manager.sh          # Container Manager unit tests
├── test_registry_manager.sh           # Registry Manager unit tests
├── test_secure_environment_manager.sh # Secure Environment Manager unit tests
└── integration/
    ├── run_integration_tests.sh       # Integration test runner
    ├── test_end_to_end_deployment.sh  # End-to-end deployment tests
    ├── test_failure_scenarios.sh      # Failure scenario tests
    ├── test_rollback_procedures.sh    # Rollback procedure tests
    ├── test_performance_timing.sh     # Performance timing tests
    └── test_secure_environment_deployment.sh # Secure environment tests
```

## Test Features

### Mock Services
All tests use comprehensive mock services to simulate:
- SSH connections and remote command execution
- Docker container operations
- Registry push/pull operations
- File system operations
- Network conditions and failures

### Performance Validation
Tests validate performance requirements:
- Environment setup: < 5 seconds
- Code synchronization: < 30 seconds
- Container build: < 2 minutes
- Health checks: < 10 seconds
- Total deployment: < 5 minutes

### Security Testing
Tests validate security measures:
- Environment variable encryption/decryption
- Sensitive data masking in logs
- Secure file cleanup procedures
- Access control and permissions

### Failure Simulation
Tests simulate various failure scenarios:
- Network connectivity issues
- Build failures
- Health check failures
- Registry authentication problems
- Disk space limitations

## Test Results

Test results are saved to `/tmp/deployment-*-results/` directories with:
- Detailed test logs
- Performance metrics
- Summary reports
- Test status badges

### Understanding Test Output

#### Success Indicators
- `✅ PASSED`: Test completed successfully
- `[PASS]`: Individual test assertion passed
- `SUCCESS`: Operation completed successfully

#### Failure Indicators
- `❌ FAILED`: Test failed
- `[FAIL]`: Individual test assertion failed
- `FAIL`: Operation failed

#### Information
- `[INFO]`: General information
- `[WARNING]`: Non-critical issues
- `[DEBUG]`: Detailed debugging information

## Requirements Validation

The test suite validates all requirements from the deployment pipeline improvement specification:

### Requirement 1: Node.js Environment Modernization
- ✓ Node.js 24.8.0 installation and verification
- ✓ pnpm 10.26.0 installation and verification
- ✓ Version validation and error handling

### Requirement 2: Safe Pipeline-Style Deployment
- ✓ Health check validation before traffic switching
- ✓ Container lifecycle management
- ✓ Failure handling and rollback procedures

### Requirement 3: Backup Management and Retention
- ✓ Backup preservation until deployment verification
- ✓ Timestamped backup archiving
- ✓ Retention policy (up to 3 backups)
- ✓ Rollback command generation

### Requirement 4: Container Registry Integration
- ✓ Container tagging with timestamp and commit hash
- ✓ GitLab registry push and verification
- ✓ Registry-based rollback commands

### Requirement 5: Git Repository Synchronization
- ✓ .git directory inclusion in rsync
- ✓ Git status and remote configuration verification
- ✓ Git-based update instructions

### Requirement 6: Comprehensive Health Check System
- ✓ Application readiness waiting (60-second timeout)
- ✓ Root endpoint testing (200 status validation)
- ✓ Critical API endpoint testing
- ✓ Static asset serving verification
- ✓ Health check summary reporting

### Requirement 7: Rollback and Recovery Mechanisms
- ✓ Container-based rollback commands
- ✓ Filesystem rollback procedures
- ✓ Registry-based rollback options
- ✓ Rollback priority and reliability assessment

### Requirement 8: Secure Environment Variable Management
- ✓ Environment file encryption (OpenSSL/GPG)
- ✓ Secure transfer and decryption
- ✓ Automatic cleanup of temporary files
- ✓ Sensitive variable masking in logs
- ✓ Environment variable rollback support

### Requirement 9: Enhanced Logging and Monitoring
- ✓ Structured logging with timestamps
- ✓ Detailed error logging and context
- ✓ Deployment summary with timing information
- ✓ Health check result logging with response times
- ✓ Deployment log file generation

## Troubleshooting

### Common Issues

#### Test Script Not Found
```bash
# Make sure you're running from the correct directory
cd /path/to/pixelated
./tests/deployment/run_all_tests.sh
```

#### Permission Denied
```bash
# Make test scripts executable
chmod +x tests/deployment/*.sh
chmod +x tests/deployment/integration/*.sh
```

#### Mock Command Failures
Tests use mock commands that simulate real operations. If you see unexpected failures:
1. Check that mock commands are being created properly
2. Verify PATH is set correctly in test environment
3. Review test logs for specific error messages

### Getting Help

1. **Review Test Logs**: Check detailed logs in `/tmp/deployment-*-results/`
2. **Run Individual Tests**: Isolate issues by running specific test components
3. **Enable Verbose Mode**: Use `--verbose` flag for detailed output
4. **Check Requirements**: Ensure all system dependencies are installed

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive test names with clear pass/fail criteria
2. **Include Mock Services**: Provide realistic mocks for external dependencies
3. **Add Performance Validation**: Include timing checks where appropriate
4. **Document Test Purpose**: Add clear comments explaining what each test validates
5. **Update This README**: Document new test scenarios and requirements

## Continuous Integration

These tests are designed to be run in CI/CD pipelines:

```yaml
# Example CI configuration
test_deployment_pipeline:
  script:
    - ./tests/deployment/run_all_tests.sh
  artifacts:
    reports:
      junit: /tmp/deployment-comprehensive-results/test-results.xml
    paths:
      - /tmp/deployment-comprehensive-results/
  only:
    - merge_requests
    - main
```

The test suite provides comprehensive validation of the deployment pipeline improvement, ensuring reliability, security, and performance requirements are met before production deployment.
