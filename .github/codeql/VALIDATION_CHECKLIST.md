# CodeQL Setup Validation Checklist

Use this checklist to verify the CodeQL setup is complete and working correctly.

## ✅ Pre-Deployment Verification

### Configuration Files
- [x] `.github/workflows/codeql.yml` - Main workflow file exists
- [x] `.github/codeql/codeql-config.yml` - Configuration file exists
- [x] `.github/codeql/custom-queries/qlpack.yml` - Query pack defined
- [x] `.github/codeql/custom-queries/fhir-security.ql` - FHIR queries exist
- [x] `.github/codeql/custom-queries/ehr-security.ql` - EHR queries exist
- [x] `.github/codeql/README.md` - Comprehensive documentation
- [x] `.github/codeql/QUICK_REFERENCE.md` - Developer guide
- [x] `.github/codeql/SETUP_SUMMARY.md` - Setup summary

### Workflow Configuration
- [x] Permissions properly set (contents: read, security-events: write)
- [x] Triggers configured (push, pull_request, schedule)
- [x] Matrix strategy for multiple languages (JavaScript, Python)
- [x] Autobuild enabled for both languages
- [x] SARIF artifact upload configured
- [x] CodeQL database upload on failure
- [x] Proper timeout set (360 minutes)
- [x] RAM allocation configured (16GB)

### CodeQL Config
- [x] Paths to analyze defined (src, ai, scripts)
- [x] Exclusions configured (node_modules, tests, build artifacts)
- [x] Query filters set (security-focused)
- [x] Custom queries referenced
- [x] Query packs enabled (security-extended, security-and-quality)

### Custom Queries
- [x] FHIR security queries implemented
- [x] EHR security queries implemented
- [x] Proper metadata in queries (severity, tags, etc.)
- [x] Query pack properly structured

## 🧪 Testing Plan

### Manual Verification
```bash
# 1. Check workflow file syntax
cat .github/workflows/codeql.yml

# 2. Verify config file
cat .github/codeql/codeql-config.yml

# 3. List all CodeQL files
find .github/codeql -type f

# 4. Check custom queries
ls -la .github/codeql/custom-queries/
```

### Workflow Test
1. [ ] Create a test branch
2. [ ] Make a small code change
3. [ ] Push to GitHub
4. [ ] Verify workflow triggers in Actions tab
5. [ ] Wait for completion (5-20 minutes)
6. [ ] Check Security tab for results

### Expected Workflow Steps
```
1. ✅ Checkout repository
2. ✅ Initialize CodeQL (JavaScript or Python)
3. ✅ Setup environment (Node.js/pnpm or Python/uv)
4. ✅ Install dependencies
5. ✅ Autobuild
6. ✅ Perform CodeQL Analysis
7. ✅ Upload SARIF results
```

## 🔍 Post-Deployment Verification

### GitHub Security Tab
- [ ] Navigate to repository → Security → Code scanning
- [ ] Verify alerts are appearing
- [ ] Check that custom queries are running
- [ ] Confirm SARIF upload is working
- [ ] Review any existing vulnerabilities

### Workflow Runs
- [ ] Check Actions tab for successful runs
- [ ] Verify both JavaScript and Python analysis complete
- [ ] Confirm artifacts are uploaded
- [ ] Check execution time is reasonable (<30 min)

### Alert Quality
- [ ] Review alert precision (low false positives)
- [ ] Verify custom queries are triggering appropriately
- [ ] Check that HIPAA-specific checks are working
- [ ] Confirm severity levels are accurate

## 🎯 Functionality Tests

### Test Case 1: SQL Injection Detection
```javascript
// Create a test file with SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = ${userId}`;
// Expected: CodeQL should flag this as high severity
```

### Test Case 2: FHIR Validation
```javascript
// Create a test file missing FHIR validation
const patient = await getResource('Patient', id);
// Expected: Custom query should flag unvalidated access
```

### Test Case 3: Encryption Check
```javascript
// Create a test file with unencrypted transmission
fetch('http://api.example.com', { body: sensitiveData });
// Expected: Custom query should flag unencrypted transmission
```

### Test Case 4: Audit Logging
```javascript
// Create a test file missing audit log
await updatePatientRecord(id, data);
// Expected: Custom query should flag missing audit
```

## 📊 Success Criteria

### Workflow Execution
- ✅ Workflow completes successfully within 30 minutes
- ✅ Both language analyses run without errors
- ✅ SARIF files uploaded as artifacts
- ✅ Results visible in Security tab

### Alert Quality
- ✅ High/Critical alerts are actionable
- ✅ Custom HIPAA queries trigger appropriately
- ✅ False positive rate < 20%
- ✅ All severity levels represented

### Documentation
- ✅ Team can understand and use the system
- ✅ Examples are clear and helpful
- ✅ Troubleshooting guide is comprehensive
- ✅ HIPAA mapping is accurate

## 🚨 Common Issues and Resolutions

### Issue: Workflow fails during initialization
**Check:**
- CodeQL action version is up to date
- Config file path is correct
- Languages are supported

### Issue: No alerts appearing
**Check:**
- Paths in config include your source code
- Queries are properly enabled
- Custom queries have correct syntax

### Issue: Too many false positives
**Check:**
- Query filters are appropriate
- Custom queries have correct precision
- Exclusions cover test files

### Issue: Analysis takes too long
**Check:**
- Paths-ignore covers build artifacts
- Dependencies are cached properly
- RAM allocation is sufficient

## 📝 Sign-Off

### Development Team
- [ ] Workflow runs successfully on test branch
- [ ] Custom queries trigger as expected
- [ ] Documentation is clear and complete
- [ ] Team trained on using CodeQL alerts

### Security Team
- [ ] Custom queries cover HIPAA requirements
- [ ] Alert severity levels are appropriate
- [ ] No critical vulnerabilities in baseline
- [ ] Audit logging checks are comprehensive

### DevOps Team
- [ ] Workflow integrated with CI/CD pipeline
- [ ] Artifacts uploaded and retained properly
- [ ] Performance is acceptable
- [ ] Monitoring and alerts configured

## 🎓 Next Steps After Validation

1. **Baseline Security Audit**
   - Review all existing alerts
   - Categorize and prioritize fixes
   - Create remediation plan

2. **Team Training**
   - Share quick reference guide
   - Demonstrate alert review process
   - Practice fixing common issues

3. **Process Integration**
   - Add CodeQL review to PR checklist
   - Set up alert notifications
   - Define SLAs for alert resolution

4. **Continuous Improvement**
   - Monitor alert trends
   - Update custom queries quarterly
   - Gather team feedback
   - Adjust configurations as needed

## 📅 Ongoing Maintenance Schedule

- **Daily**: Review new high/critical alerts
- **Weekly**: Review scheduled scan results
- **Monthly**: Analyze alert trends and patterns
- **Quarterly**: Update custom queries and configuration
- **Annually**: Full security audit and compliance review

---

**Validation Status**: [ ] Complete | [ ] In Progress | [ ] Not Started

**Validated By**: _________________ **Date**: _________________

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
