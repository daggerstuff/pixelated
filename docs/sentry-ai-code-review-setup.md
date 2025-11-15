## Sentry AI Code Review Setup Checklist

This document provides a step-by-step checklist to ensure Sentry AI Code Review is fully configured and working.

## ✅ Prerequisites Already Configured

Based on our current setup, the following are already in place:

1. **GitHub Integration** ✅
   - GitHub integration is installed
   - Pull Requests: Read & Write permissions granted
   - Repository linked to Sentry project

2. **Code Mappings** ✅
   - Stack Trace Root: `src/`
   - Source Code Root: `src/`
   - Repository properly linked

3. **Source Maps** ✅
   - Configured in `astro.config.mjs`
   - Configured in `vite.config.js`
   - Uploaded during CI/CD builds

4. **Release Tracking** ✅
   - `SENTRY_RELEASE` set to `github.sha` in CI/CD
   - Releases associated with commits

## 🔧 Required Setup Steps

### Step 1: Install Seer by Sentry GitHub App

**This is required for AI Code Review to work.**

1. Visit: https://github.com/apps/seer-by-sentry
2. Click **"Configure"**
3. Select your organization (if applicable)
4. Choose which repositories to grant access:
   - **All repositories** (recommended for full coverage)
   - Or **Only select repositories** (if you prefer to limit access)
5. Click **"Install"**
6. Grant the necessary permissions when prompted

**Required Permissions:**
- Contents: Read (to analyze code)
- Metadata: Read (to access repository information)
- Pull Requests: Read & Write (to comment on PRs)
- Issues: Read (to reference historical issues)

### Step 2: Enable AI Features in Sentry

1. Log in to your Sentry dashboard
2. Navigate to: **Settings > Organization Settings > AI Features**
3. Enable **"PR Review and Test Generation"**
4. If this option is not visible, ensure your organization has access to AI features
   - AI features may require a Business or Enterprise plan
   - Contact Sentry support if needed

### Step 3: Verify Repository Connection

1. In Sentry dashboard: **Settings > Integrations > GitHub**
2. Click **"Configure"** next to your GitHub integration
3. Verify your repository appears in the list
4. Ensure it shows as **"Connected"** or **"Active"**

### Step 4: Verify Code Mappings

1. In Sentry dashboard: **Settings > Integrations > GitHub > Configurations**
2. Click **"Configure"** next to your GitHub instance
3. Go to the **Code Mappings** tab
4. Verify at least one code mapping exists with:
   - **Project**: `pixel-astro`
   - **Repo**: `your-org/pixelated` (your actual org/repo)
   - **Stack Trace Root**: `src/`
   - **Source Code Root**: `src/`
5. Status should show as **"Active"**

## 🧪 Testing AI Code Review

### Test 1: Create a Test Pull Request

1. Create a new branch
2. Make a small change to a file (e.g., modify a TypeScript/JavaScript file)
3. Push the branch and create a pull request
4. Wait 1-2 minutes after opening the PR
5. Check for Sentry comments on the PR

**Expected Behavior:**
- Sentry should automatically comment on the PR
- Comments should identify potential issues based on historical Sentry errors
- Up to 5 issues per file should be shown

### Test 2: Verify Seer App Installation

1. Go to your repository on GitHub
2. Navigate to: **Settings > Integrations > GitHub Apps**
3. Verify **"Seer by Sentry"** appears in the list
4. Click on it to verify it's configured correctly

### Test 3: Check Sentry Dashboard

1. In Sentry dashboard: **Settings > Integrations > GitHub > Configure**
2. Look for **"AI Code Review"** or **"Pull Request Comments"** section
3. Verify it's enabled/activated

## 📋 Configuration Checklist

Use this checklist to verify everything is set up:

- [ ] Seer by Sentry GitHub App installed
- [ ] GitHub App granted access to repository
- [ ] AI Features enabled in Sentry organization settings
- [ ] Repository connected in Sentry dashboard
- [ ] Code mappings configured and active
- [ ] Source maps uploaded (verified in a recent release)
- [ ] Test PR created and Sentry commented on it
- [ ] Comments appear within 1-2 minutes of opening PR

## 🔍 Troubleshooting

### AI Code Review Not Commenting on PRs

**Check these in order:**

1. **Seer App Installation**
   ```
   Repository Settings > Integrations > GitHub Apps
   ```
   - Verify "Seer by Sentry" is installed
   - Check that it has access to the repository
   - Ensure permissions are granted

2. **AI Features Enabled**
   ```
   Sentry Dashboard > Settings > Organization Settings > AI Features
   ```
   - Verify "PR Review and Test Generation" is enabled
   - If missing, check plan eligibility

3. **Code Mappings**
   ```
   Sentry Dashboard > Settings > Integrations > GitHub > Code Mappings
   ```
   - Verify mappings exist and are active
   - Check that Stack Trace Root and Source Code Root match your structure

4. **File Type Support**
   - AI Code Review supports: Python, JavaScript/TypeScript, PHP, Ruby
   - Verify PR contains changes to supported file types
   - For JavaScript/TypeScript, source maps must be configured (✅ already done)

5. **Historical Issues**
   - AI Code Review needs historical Sentry issues to analyze
   - If your project is new, there may be fewer suggestions
   - The feature works better with existing error history

### Comments Not Appearing

1. **Wait longer** - Analysis can take 1-2 minutes for larger PRs
2. **Check GitHub App permissions** - May need to re-authorize
3. **Verify repository connection** - Check Sentry dashboard
4. **Check PR file types** - Ensure modified files are supported languages

### Seer App Not Showing Up

1. **Install manually**: https://github.com/apps/seer-by-sentry
2. **Check organization settings** - May need org admin to install
3. **Verify GitHub App marketplace access** - Ensure not blocked by org policies

## 📚 Additional Resources

- [Sentry AI Code Review Documentation](https://docs.sentry.io/product/ai-in-sentry/ai-code-review/)
- [Install Seer by Sentry GitHub App](https://github.com/apps/seer-by-sentry)
- [Sentry GitHub Integration Guide](https://docs.sentry.io/organization/integrations/source-code-mgmt/github/)
- [AI Code Review Workshop](https://sentry.io/resources/ai-code-review-workshop/)

## 🎯 Next Steps After Setup

Once AI Code Review is working:

1. **Monitor PR comments** - Review Sentry's suggestions
2. **Integrate into workflow** - Consider making Sentry comments a required check
3. **Share with team** - Ensure all developers know about the feature
4. **Provide feedback** - Help improve Sentry's AI by engaging with suggestions

## 📝 Notes

- AI Code Review is separate from the regular GitHub integration
- The Seer GitHub App is specifically for AI features
- Both the regular GitHub integration AND Seer app can be installed
- Source maps are critical for JavaScript/TypeScript analysis (already configured)
- The feature works best with existing error history in Sentry

