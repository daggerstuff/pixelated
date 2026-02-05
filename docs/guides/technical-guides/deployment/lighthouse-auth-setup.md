# 🔐 Setting Up LH_AUTH_COOKIE for Lighthouse Performance Testing

## Overview

The `LH_AUTH_COOKIE` secret is used to authenticate Lighthouse CI when testing protected pages (like `/dashboard`) in your production environment. This ensures performance testing can access authenticated routes.

## 🎯 What You Need

Based on your Pixelated Empathy configuration, you're using **Auth0** for authentication with the following setup:

- **Authentication Method**: Auth0 OAuth (email/password + Google social login)
- **Access Token Cookie**: `auth-token`
- **Refresh Token Cookie**: `refresh-token`
- **Cookie Settings**: `HttpOnly`, `Secure`, `SameSite=lax`
- **Token Expiration**: 7 days (access), 30 days (refresh)

## 📋 Step-by-Step Guide

### Step 1: Log into Your Production Site

1. Open your production site in a browser: `https://pixelatedempathy.com`
2. Navigate to `/login`
3. Log in using one of these methods:
   - **Email/Password**: Use a dedicated test account
   - **Google OAuth**: Use a dedicated monitoring Google account
4. Navigate to `/dashboard` to ensure authentication works

### Step 2: Extract the Authentication Cookies

#### Option A: Using Chrome DevTools

1. Press `F12` to open Chrome DevTools
2. Go to the **Application** tab
3. In the left sidebar, expand **Cookies**
4. Click on `https://pixelatedempathy.com`
5. Look for these cookies:
   - `auth-token`
   - `refresh-token`
6. Copy the **Value** column for both cookies

#### Option B: Using Firefox DevTools

1. Press `F12` to open Firefox DevTools
2. Go to the **Storage** tab
3. Expand **Cookies** in the left sidebar
4. Click on `https://pixelatedempathy.com`
5. Find `auth-token` and `refresh-token`
6. Copy the values

### Step 3: Format the Cookie String

Combine the cookies into a single string in this format:

```auth
auth-token=<ACCESS_TOKEN_VALUE>; refresh-token=<REFRESH_TOKEN_VALUE>
```

**Example:**

```auth
auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; refresh-token=v1.MRjTvIk8RqnN...
```

### Step 4: Add the Secret to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `LH_AUTH_COOKIE`
5. Value: Paste your formatted cookie string
6. Click **Add secret**

## 🔒 Security Considerations

### ✅ Best Practices

1. **Use a Dedicated Test Account**: Create a specific user account for monitoring/testing
2. **Minimal Permissions**: Give this account only the permissions needed to access the pages being tested
3. **Regular Rotation**: Rotate the authentication token periodically (recommended: monthly)
4. **Monitor Usage**: Check GitHub Actions logs to ensure the secret isn't being exposed

### ⚠️ Important Notes

- **Token Expiration**: Your access tokens expire based on `sessionDuration` (currently 7 days)
- **Refresh Strategy**: You'll need to update the secret when tokens expire
- **Environment Isolation**: Use different secrets for staging vs production

## 🔄 Token Refresh Automation (Optional)

For long-term maintenance, consider automating token refresh:

### Option 1: Create a Long-Lived Service Account Token

If Auth0 supports it, create a machine-to-machine (M2M) token with extended expiration.

### Option 2: Use GitHub Actions to Refresh Tokens

Create a scheduled workflow that:

1. Authenticates with your API
2. Retrieves fresh tokens
3. Updates the GitHub secret programmatically

```yaml
# .github/workflows/refresh-auth-token.yml
name: Refresh Lighthouse Auth Token

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Login and get fresh token
        run: |
          # Your authentication logic here
          # Use GitHub CLI to update the secret
          gh secret set LH_AUTH_COOKIE --body "$NEW_COOKIE_VALUE"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 🧪 Testing the Configuration

After setting the secret, test it:

1. Trigger the monitoring workflow manually:

   ```bash
   gh workflow run monitoring.yml
   ```

2. Check the workflow logs for:
   - ✅ "Set LHCI extraHeaders for authenticated pages"
   - ✅ Successful Lighthouse runs on `/dashboard?perf=1`

3. If you see authentication errors:
   - Verify the cookie format is correct
   - Check that tokens haven't expired
   - Ensure the test account has proper permissions

## 📊 What Gets Tested

With `LH_AUTH_COOKIE` configured, Lighthouse will test:

- **Public pages**: Homepage, login page, etc.
- **Protected pages**: `/dashboard?perf=1` (and any other authenticated routes)

Performance metrics collected:

- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)

## 🆘 Troubleshooting

### Issue: "403 Forbidden" on protected pages

**Solution**:

- Verify cookie values are correct
- Check that the test account is active
- Ensure cookies haven't expired

### Issue: "Lighthouse skipped authenticated URLs"

**Solution**:

- Verify `LH_AUTH_COOKIE` secret is set in GitHub
- Check workflow logs for "No LH_AUTH_COOKIE secret set"

### Issue: Tokens expire too quickly

**Solution**:

- Increase `sessionDuration` in `src/config/auth.config.ts`
- Or implement automated token refresh

## 📚 Related Documentation

- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Lighthouse CI Authentication](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#extra-headers)
- [Auth0 Documentation](https://auth0.com/docs)

---

**Last Updated**: 2026-02-05
**Maintained By**: Pixelated Empathy DevOps Team
