## Sentry Code Mappings & Stack Trace Linking Configuration

This document explains how to configure Sentry code mappings and stack trace linking for proper error tracking with source code references.

## Overview

Code mappings enable Sentry to link stack traces to your actual source code in GitHub, allowing you to:
- See the exact source code where errors occurred
- Navigate directly from Sentry errors to GitHub files
- View the exact commit version when the error occurred (if commit tracking is enabled)

## Prerequisites

1. **GitHub Integration**: Ensure the GitHub integration is installed in your Sentry organization
   - Navigate to `Settings > Integrations > GitHub`
   - Follow the [Sentry GitHub Integration Guide](https://docs.sentry.io/organization/integrations/source-code-mgmt/github/)
   - Grant necessary permissions (Contents: Read, Metadata: Read, Pull Requests: Read & Write)

2. **Source Maps**: Ensure source maps are being uploaded with releases
   - ✅ Configured in `astro.config.mjs` (Astro Sentry integration)
   - ✅ Configured in `vite.config.js` (Sentry Vite plugin)
   - ✅ Configured in `.github/workflows/sentry-build.yml` (CI/CD release creation)

3. **Release Tracking**: Releases must be set during builds
   - ✅ Configured to use `SENTRY_RELEASE` environment variable (defaults to `github.sha` in CI/CD)

## Configuring Code Mappings in Sentry Dashboard

1. **Navigate to Code Mappings**:
   - Go to `Settings > Integrations > GitHub > Configurations`
   - Click "Configure" next to your GitHub instance
   - Click the **Code Mappings** tab

2. **Add a New Code Mapping**:
   - Click **Add Mapping**
   - Fill out the following fields:

### Configuration Values

Based on our project structure:

| Field | Value | Description |
|-------|-------|-------------|
| **Project** | `pixel-astro` | The Sentry project name |
| **Repo** | `your-org/pixelated` | Your GitHub repository (org/repo format) |
| **Branch** | `master` (or your default branch) | Default branch for code linking |
| **Stack Trace Root** | `src/` | The root path in stack traces (where Sentry sees files) |
| **Source Code Root** | `src/` | The root path in your GitHub repository |

### Determining Stack Trace Root and Source Code Root

#### Example: Client-side JavaScript Errors

If a stack trace shows:
```
Error: Something went wrong
  at MyComponent (src/components/MyComponent.tsx:42:15)
  at App (src/pages/index.tsx:10:5)
```

Then:
- **Stack Trace Root**: `src/`
- **Source Code Root**: `src/`

The paths match directly, so both values are `src/`.

#### Example: Server-side Errors (Node.js)

If a stack trace shows:
```
Error: Database connection failed
  at connectDatabase (src/lib/db/index.ts:25:10)
  at handler (src/pages/api/health.ts:8:3)
```

Then:
- **Stack Trace Root**: `src/`
- **Source Code Root**: `src/`

Again, the paths match directly.

#### Example: Nested Directory Structure

If your stack trace shows paths like:
```
Error: Processing failed
  at processData (/app/src/lib/processing.ts:15:5)
```

But in your GitHub repo the file is at:
```
https://github.com/your-org/pixelated/blob/master/src/lib/processing.ts
```

Then:
- **Stack Trace Root**: `/app/src/` (the prefix Sentry sees)
- **Source Code Root**: `src/` (where it actually is in the repo)

### Best Practices

1. **Always provide a non-empty Stack Trace Root** when possible for better accuracy
2. **Test with a real error** - Create a test error and verify the code mapping works
3. **Update mappings when structure changes** - If you reorganize your code, update the mappings

## Verifying Configuration

### 1. Check Release Creation

In Sentry dashboard:
- Go to `Releases`
- Verify releases are being created with commit SHAs (e.g., `abc123def456...`)
- Check that source maps are uploaded (should show file counts)

### 2. Test Stack Trace Linking

1. Trigger a test error in your application
2. Navigate to the error in Sentry
3. Click on a file in the stack trace
4. You should be redirected to the exact file in GitHub
5. If commit tracking is enabled, you'll see the exact commit version

### 3. Check Code Mappings Status

In `Settings > Integrations > GitHub > Configurations > Code Mappings`:
- Status should show as "Active" for each mapping
- If there are issues, Sentry will show error messages

## Commit Tracking

To enable commit tracking for releases:

1. **Set up GitHub Integration** (already covered in Prerequisites)
2. **Associate Commits with Releases**:
   - Our CI/CD workflow (`.github/workflows/sentry-build.yml`) sets `SENTRY_RELEASE` to `github.sha`
   - When creating releases, commits are automatically associated if the GitHub integration is configured

3. **Verify Commit Association**:
   - Go to a release in Sentry
   - Check the "Commits" tab
   - You should see the commits included in that release

## Troubleshooting

### Stack traces don't link to source code

1. **Check source maps are uploaded**:
   - Go to `Releases > [your-release]`
   - Check "Source Maps" section - should show uploaded files

2. **Verify code mappings**:
   - Ensure Stack Trace Root matches what Sentry sees
   - Ensure Source Code Root matches your GitHub repo structure

3. **Check file paths**:
   - Look at a stack trace in Sentry
   - Compare the file path shown with your actual GitHub repo structure
   - Adjust code mappings accordingly

### Source maps not being uploaded

1. **Check environment variables**:
   ```bash
   SENTRY_AUTH_TOKEN  # Required for uploads
   SENTRY_ORG         # Default: 'pixelated-empathy-dq'
   SENTRY_PROJECT     # Default: 'pixel-astro'
   SENTRY_RELEASE     # Set to commit SHA in CI/CD
   ```

2. **Check build logs**:
   - Look for Sentry upload messages during build
   - Verify `sentry-cli` is running in CI/CD workflow

3. **Check Astro/Vite configs**:
   - Verify `SENTRY_AUTH_TOKEN` is set during build
   - Check `astro.config.mjs` and `vite.config.js` for correct configuration

### Code mappings not working

1. **Verify GitHub integration permissions**:
   - Contents: Read (required)
   - Metadata: Read (required)

2. **Check repository access**:
   - Ensure Sentry GitHub app has access to your repository
   - Verify the repository name matches exactly (org/repo format)

3. **Test with a simple mapping**:
   - Start with `src/` for both Stack Trace Root and Source Code Root
   - Verify it works, then refine if needed

## Related Configuration Files

- `sentry.client.config.js` - Client-side Sentry configuration
- `sentry.server.config.js` - Server-side Sentry configuration
- `astro.config.mjs` - Astro Sentry integration with source map uploads
- `vite.config.js` - Vite Sentry plugin configuration
- `.github/workflows/sentry-build.yml` - CI/CD release creation

## AI Code Review Setup

Sentry's AI Code Review analyzes pull requests and predicts potential errors before code is merged.

### Prerequisites

1. **GitHub Integration** (already configured):
   - ✅ GitHub integration installed
   - ✅ Pull Requests: Read & Write permissions granted

2. **Code Mappings** (already configured):
   - ✅ Stack Trace Root and Source Code Root configured
   - ✅ Repository linked to Sentry project

3. **Seer by Sentry GitHub App** (required):
   - Install the [Seer by Sentry GitHub App](https://github.com/apps/seer-by-sentry)
   - Click "Configure" and install for your repository
   - Grant necessary permissions (automatically requested)

4. **Enable AI Features**:
   - In Sentry dashboard: `Settings > Organization Settings > AI Features`
   - Enable "PR Review and Test Generation"
   - Ensure your organization has access to AI features

### How It Works

Once configured, Sentry AI Code Review will:
- **Automatically analyze pull requests** when opened or updated
- **Predict potential errors** based on code changes and historical Sentry issues
- **Suggest fixes** for code that matches patterns from previous issues
- **Comment on pull requests** with up to 5 issues per file

### Features

1. **Issue Detection**:
   - Analyzes files and functions modified in PRs
   - Finds recent unhandled, unresolved issues associated with changed code
   - Shows issues first seen within the past 90 days, last seen within the past 14 days

2. **Language Support**:
   - Currently supports: Python, JavaScript/TypeScript, PHP, and Ruby
   - For JavaScript/TypeScript: Requires source maps to be set up (✅ already configured)

3. **Integration**:
   - Automatically enabled once GitHub integration and Seer app are installed
   - Comments appear on pull requests without additional configuration
   - Can be disabled via `Settings > Integrations > GitHub > Configure`

### Verification

To verify AI Code Review is working:

1. **Check Seer App Installation**:
   - Go to your repository settings on GitHub
   - Navigate to `Settings > Integrations > GitHub Apps`
   - Verify "Seer by Sentry" is installed and configured

2. **Test with a Pull Request**:
   - Create a test pull request
   - Wait a few moments after opening
   - Check for Sentry comments on the PR
   - Comments should identify potential issues based on historical errors

3. **Check Sentry Dashboard**:
   - Go to `Settings > Integrations > GitHub > Configure`
   - Verify AI Code Review features are enabled
   - Check that repository is linked correctly

### Troubleshooting

**AI Code Review not commenting on PRs**:
1. Verify Seer by Sentry GitHub App is installed
2. Check that AI features are enabled in Sentry organization settings
3. Ensure code mappings are configured correctly
4. Verify source maps are uploaded (for JavaScript/TypeScript)
5. Check that files modified in PR match supported languages

**Comments not appearing**:
1. Wait a few moments - analysis takes time
2. Check GitHub app permissions are granted
3. Verify repository is connected in Sentry dashboard
4. Ensure PR contains changes to supported file types

## Additional Resources

- [Sentry Stack Trace Linking Documentation](https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#stack-trace-linking)
- [Sentry GitHub Integration Guide](https://docs.sentry.io/organization/integrations/source-code-mgmt/github/)
- [Sentry AI Code Review Documentation](https://docs.sentry.io/product/ai-in-sentry/ai-code-review/)
- [Sentry Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Install Seer by Sentry GitHub App](https://github.com/apps/seer-by-sentry)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Sentry dashboard error messages
3. Check build logs for upload failures
4. Verify environment variables are set correctly

