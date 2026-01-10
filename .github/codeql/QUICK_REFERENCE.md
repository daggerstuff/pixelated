# CodeQL Quick Reference Guide

## What is CodeQL?

CodeQL is GitHub's semantic code analysis engine that treats code as data, allowing you to query it like a database to find security vulnerabilities and code quality issues.

## Quick Links

- **View Results**: Navigate to repository → Security tab → Code scanning alerts
- **Workflow Runs**: Actions tab → CodeQL workflow
- **Configuration**: `.github/codeql/` directory

## When Does CodeQL Run?

✅ **Automatic Triggers:**
- Push to `master` or `develop` branches
- Pull requests targeting `master` or `develop`
- Every Monday at 2:00 AM UTC (scheduled)

⏱️ **Expected Duration:** 5-20 minutes depending on code size

## Understanding Alert Severity

| Severity | What It Means | Action Required |
|----------|---------------|-----------------|
| **Critical** (9.0+) | Active security vulnerability, immediate risk | Fix immediately before merge |
| **High** (8.0-8.9) | Serious security issue | Fix before release |
| **Medium** (6.0-7.9) | Potential security concern | Address in current sprint |
| **Low** (<6.0) | Code quality or minor issue | Address when convenient |

## Healthcare-Specific Checks

Our custom queries detect:

### FHIR Security (`fhir-security.ql`)
- ❌ Unvalidated FHIR resource access
- ❌ Missing FHIR version checks
- ❌ Insecure FHIR search operations
- ❌ FHIR operations without security context

### EHR Security (`ehr-security.ql`)
- ❌ Unencrypted PHI/EHR data transfer
- ❌ Weak authentication for EHR access
- ❌ Missing audit logs (HIPAA violation)
- ❌ Exposed credentials in EHR integrations

## Common Issues and Fixes

### Issue: "Unvalidated FHIR resource access"

**Bad:**
```javascript
const patient = await getResource('Patient', patientId);
```

**Good:**
```javascript
const patient = await getResource('Patient', patientId);
await validateResource(patient);
```

### Issue: "Unencrypted EHR data transfer"

**Bad:**
```javascript
fetch('http://ehr-api.example.com/patient', {
  body: JSON.stringify(patientData)
});
```

**Good:**
```javascript
const encryptedData = await encrypt(patientData);
fetch('https://ehr-api.example.com/patient', {
  body: JSON.stringify(encryptedData),
  headers: { 'Content-Type': 'application/encrypted+json' }
});
```

### Issue: "Missing audit logging"

**Bad:**
```javascript
async function updatePatientRecord(patientId, data) {
  return await db.patients.update(patientId, data);
}
```

**Good:**
```javascript
async function updatePatientRecord(patientId, data) {
  const result = await db.patients.update(patientId, data);
  await auditLog.record({
    action: 'UPDATE_PATIENT',
    patientId,
    userId: currentUser.id,
    timestamp: new Date()
  });
  return result;
}
```

## Reviewing Alerts

### In Pull Requests
1. Go to "Files changed" tab
2. Look for CodeQL annotations on specific lines
3. Click annotation to see full details
4. Fix the issue or dismiss with justification

### In Security Tab
1. Navigate to Security → Code scanning
2. Filter by severity, branch, or language
3. Click alert for detailed explanation
4. View affected code and suggested fixes

## Dismissing False Positives

Only dismiss alerts if:
- ✅ You've verified it's a false positive
- ✅ You've documented why it's safe
- ✅ Security team has reviewed (for high/critical)

**How to dismiss:**
1. Open the alert
2. Click "Dismiss alert"
3. Select reason (false positive, used in tests, won't fix)
4. Add detailed comment explaining decision

## Performance Tips

If CodeQL is slow:
1. Check which files are being analyzed (config paths)
2. Ensure test files are excluded
3. Verify node_modules is in paths-ignore
4. Review build process for unnecessary steps

## Troubleshooting

### "CodeQL failed to build the project"
- Check Actions logs for build errors
- Verify dependencies are properly installed
- Ensure build scripts work locally

### "No results found"
- Verify paths in config include your code
- Check that queries are properly enabled
- Ensure language is correctly detected

### "Too many alerts"
- Review query filters in config
- Adjust severity thresholds
- Focus on security-extended queries first

## Advanced Usage

### Running CodeQL Locally
```bash
# Install CodeQL CLI
gh extension install github/gh-codeql

# Create database
codeql database create ./codeql-db --language=javascript

# Run queries
codeql database analyze ./codeql-db \
  --format=sarif-latest \
  --output=results.sarif
```

### Testing Custom Queries
```bash
# Validate query syntax
codeql query format .github/codeql/custom-queries/your-query.ql

# Run query against database
codeql query run .github/codeql/custom-queries/your-query.ql \
  --database=./codeql-db
```

## HIPAA Compliance Mapping

| HIPAA Requirement | CodeQL Check | Query |
|-------------------|--------------|-------|
| §164.312(a)(1) Access Control | Authentication validation | ehr-security.ql |
| §164.312(b) Audit Controls | Audit logging | ehr-security.ql |
| §164.312(c)(1) Integrity | Version checks, validation | fhir-security.ql |
| §164.312(e)(1) Transmission Security | Encryption checks | ehr-security.ql |

## Best Practices

✅ **DO:**
- Review all high/critical alerts before merging
- Add security context to healthcare operations
- Implement audit logging for PHI access
- Encrypt all data in transit and at rest
- Validate all external inputs
- Use parameterized queries for databases

❌ **DON'T:**
- Dismiss alerts without investigation
- Hardcode credentials or API keys
- Skip encryption for healthcare data
- Ignore audit logging requirements
- Trust external data without validation

## Getting Help

1. **Documentation**: See `.github/codeql/README.md`
2. **Team**: Ask in #security Slack channel
3. **GitHub**: Check [CodeQL docs](https://codeql.github.com/docs/)
4. **Issues**: Create ticket with `security` label

## Updates and Maintenance

- **Weekly**: Review new alerts from scheduled scans
- **Monthly**: Review dismissed alerts for validity
- **Quarterly**: Update custom queries for new patterns
- **Annually**: Full security audit and query review

---

**Remember**: CodeQL is a tool to help you write secure code. It's not a replacement for security review, but it catches many common issues automatically. Always consider the healthcare context and HIPAA requirements when addressing alerts.
