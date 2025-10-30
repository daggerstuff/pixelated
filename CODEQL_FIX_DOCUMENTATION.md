# CodeQL Configuration Fix

## Problem Summary

The CodeQL analysis was failing with the error:
```
CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled
```

## Root Cause

The conflict occurred because:
1. **GitHub's default CodeQL setup** was enabled in repository settings
2. **Multiple workflows** were using advanced CodeQL configurations with custom settings
3. GitHub doesn't allow both default and advanced configurations to run simultaneously

## Solution Applied

### 1. Updated Workflow Configurations

**File: `.github/workflows/bias-detection-ci.yml`**
- Added `config-file: .github/codeql/codeql-config.yml` to the CodeQL init step
- Added `category: "bias-detection"` to the analyze step for better organization

**File: `.github/workflows/ci.yml`**
- Added `config-file: .github/codeql/codeql-config.yml` to the CodeQL init step
- Added `category: "main-ci"` to the analyze step for better organization

### 2. Enhanced CodeQL Configuration

The existing `.github/codeql/codeql-config.yml` already contains:
- Custom path configurations focusing on the `src` directory
- Proper exclusions for test files, node_modules, and build artifacts
- Security-focused analysis settings

## Required Repository Settings Change

**IMPORTANT**: To complete the fix, you need to switch from Default to Advanced CodeQL setup:

1. Go to your repository settings on GitHub
2. Navigate to "Code security & analysis"
3. Find "CodeQL analysis" section
4. **Switch from "Default" to "Advanced" setup**
5. This will disable GitHub's automatic CodeQL and allow your workflow configurations to take over
6. Save the changes

**Note**: Do NOT completely disable CodeQL - just switch to Advanced mode so your custom workflow configurations are used.

## Verification Steps

After applying these changes:

1. **Trigger a new workflow run** by pushing to master/development branches
2. **Check the Actions tab** to verify CodeQL analysis completes successfully
3. **Review the Security tab** to ensure results are properly uploaded
4. **Monitor for any new syntax errors** in the CodeQL analysis output

## Benefits of This Approach

- **Consistent Configuration**: All workflows use the same advanced CodeQL settings
- **Custom Security Rules**: Leverages the custom queries in `.github/codeql/custom-queries/`
- **Better Organization**: Different categories help distinguish between workflow results
- **Performance**: Focused analysis on relevant code paths (src directory)

## Fallback Option

If you prefer to use GitHub's default CodeQL setup instead:

1. Remove the `config-file` parameter from both workflow files
2. Remove the `category` parameter from the analyze steps
3. Keep the default CodeQL setup enabled in repository settings
4. Delete or modify the `.github/codeql/codeql-config.yml` file

## Monitoring

Watch for these indicators of success:
- ✅ CodeQL analysis completes without errors
- ✅ SARIF files are uploaded successfully
- ✅ Security findings appear in the Security tab
- ✅ No "default setup conflict" errors in workflow logs

## Support

If issues persist after these changes:
1. Check the GitHub Actions logs for detailed error messages
2. Verify the repository settings change was applied correctly
3. Consider temporarily disabling CodeQL in workflows and re-enabling gradually