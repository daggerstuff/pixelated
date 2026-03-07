# CodeQL Security Analysis Configuration

This directory contains the CodeQL security analysis configuration for the Pixelated Empathy project, with a focus on HIPAA compliance, FHIR/EHR security, and general code security.

## Overview

CodeQL performs static analysis on the codebase to identify security vulnerabilities, code quality issues, and compliance violations. This setup is specifically configured for healthcare applications handling Protected Health Information (PHI).

## Configuration Files

### `codeql-config.yml`
Main configuration file that defines:
- Query filters for security-focused analysis
- Paths to analyze (src, ai, scripts)
- Paths to ignore (node_modules, tests, generated code)
- Custom query integration
- Query pack selection

### `custom-queries/`
Custom CodeQL queries for healthcare-specific security checks:

#### `fhir-security.ql`
Detects FHIR-specific security issues:
- Unvalidated FHIR resource access
- Insecure FHIR operations
- Missing FHIR version checks
- Insecure FHIR search operations

#### `ehr-security.ql`
Detects EHR integration security issues:
- Unencrypted EHR data transfer
- Weak authentication methods
- Missing audit logging (HIPAA requirement)
- General EHR security pattern violations

#### `qlpack.yml`
Defines the custom query pack for healthcare compliance checks.

## Query Suites Used

1. **security-and-quality**: Standard security and quality checks
2. **security-extended**: Extended security analysis with additional vulnerability patterns
3. **hipaa-compliance** (custom): Healthcare-specific compliance checks

## Alerts and Severity Levels

### Critical (Security Severity: 9.0+)
- Unencrypted EHR data transfer
- Critical authentication bypasses
- Data exposure vulnerabilities

### High (Security Severity: 8.0-8.9)
- Unvalidated FHIR resource access
- Insecure authentication methods
- SQL injection vulnerabilities

### Medium (Security Severity: 6.0-7.9)
- Insecure FHIR operations
- Missing audit logging
- Insecure search operations

### Low (Security Severity: <6.0)
- Missing version checks
- Code quality issues
- Non-critical best practice violations

## Workflow Integration

The CodeQL analysis runs:
- On every push to `master` and `develop` branches
- On every pull request targeting `master` or `develop`
- Weekly on Monday at 2:00 AM UTC (scheduled scan)

## Languages Analyzed

- **JavaScript/TypeScript**: Frontend and full-stack code
- **Python**: AI/ML services and backend code

## Customizing Analysis

### Adding New Custom Queries

1. Create a new `.ql` file in `custom-queries/`
2. Follow the CodeQL query structure with proper metadata
3. Add the query to `codeql-config.yml`
4. Update `qlpack.yml` if creating a new suite

Example query metadata:
```ql
/**
 * @name Query Name
 * @description Query description
 * @kind problem
 * @problem.severity error
 * @security-severity 8.0
 * @precision high
 * @id js/your-query-id
 * @tags security
 *       hipaa
 */
```

### Excluding Paths

To exclude additional paths from analysis, add them to `paths-ignore` in `codeql-config.yml`:

```yaml
paths-ignore:
  - '**/your-excluded-path'
```

### Adjusting Query Filters

Modify `query-filters` in `codeql-config.yml` to include/exclude specific query types:

```yaml
query-filters:
  - include:
      kind: [problem, path-problem]
  - exclude:
      tags contain: experimental
```

## Performance Considerations

The workflow is configured with:
- **Timeout**: 360 minutes for complete analysis
- **RAM**: 16GB allocated for complex projects
- **Autobuild**: Uses GitHub's optimized build process
- **Caching**: pnpm store cached for faster dependency installation

## HIPAA Compliance

The custom queries focus on HIPAA compliance requirements:

1. **Access Control** (§164.312(a)(1))
   - Validates authentication mechanisms
   - Checks for authorization before data access

2. **Audit Controls** (§164.312(b))
   - Ensures audit logging for PHI access
   - Validates comprehensive audit trails

3. **Integrity** (§164.312(c)(1))
   - Validates data integrity checks
   - Ensures version compatibility

4. **Transmission Security** (§164.312(e)(1))
   - Checks for encryption in data transmission
   - Validates secure communication protocols

## Troubleshooting

### Analysis Taking Too Long
- Check if timeout needs to be increased
- Review which paths are being analyzed
- Consider excluding large generated files

### False Positives
- Review the query logic in custom queries
- Add specific exclusions to `query-filters`
- Update precision metadata in query definitions

### Missing Alerts
- Ensure paths are included in `paths` configuration
- Check that relevant query packs are enabled
- Verify custom queries are properly referenced

## Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Customizing Code Scanning](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/customizing-code-scanning)
- [CodeQL Query Help](https://codeql.github.com/codeql-query-help/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [FHIR Security](http://hl7.org/fhir/security.html)

## Maintenance

- Review and update custom queries quarterly
- Update CodeQL action versions when available
- Review alert trends and adjust severity levels as needed
- Ensure compliance with latest HIPAA guidance

## Support

For issues with CodeQL analysis:
1. Check workflow logs in GitHub Actions
2. Review CodeQL analysis results in Security tab
3. Consult the troubleshooting section above
4. Refer to official CodeQL documentation
