# 🚀 Quick Start: Get Your LH_AUTH_COOKIE

## Authentication Method

**Pixelated Empathy uses Auth0** for authentication with OAuth (Google) and email/password support. Since Auth0 uses an OAuth flow (not a simple REST API), you'll need to extract cookies from your browser after logging in.

## 📋 Step-by-Step Instructions

### 1. **Log into Production**

1. Open your production site: **https://pixelatedempathy.com**
2. Click "Sign In" or navigate to `/login`
3. Log in using one of these methods:
   - **Email/Password**: Use a test account
   - **Google OAuth**: Use a dedicated monitoring Google account

### 2. **Extract Cookies from Browser**

#### Using Chrome DevTools

1. After logging in, press **F12** to open DevTools
2. Click the **Application** tab (top menu)
3. In the left sidebar, expand **Cookies**
4. Click on `https://pixelatedempathy.com`
5. Look for these cookies:
   - `auth-token` (your access token)
   - `refresh-token` (optional, for longer sessions)

#### Using Firefox DevTools

1. After logging in, press **F12** to open DevTools
2. Click the **Storage** tab
3. Expand **Cookies** in the left sidebar
4. Click on `https://pixelatedempathy.com`
5. Find `auth-token` and `refresh-token`

### 3. **Copy Cookie Values**

For each cookie, copy the **Value** column (the long string of characters).

### 4. **Format the Cookie String**

Combine the cookies into a single string:

```text
auth-token=<YOUR_AUTH_TOKEN_VALUE>; refresh-token=<YOUR_REFRESH_TOKEN_VALUE>
```

**Example:**
```text
auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c; refresh-token=v1.MRjTvIk8RqnN...
```

### 5. **Add to GitHub Secrets**

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. **Name**: `LH_AUTH_COOKIE`
5. **Value**: Paste your formatted cookie string
6. Click **"Add secret"**

## ✅ Verification

After adding the secret, test it:

```bash
# Trigger the monitoring workflow manually
gh workflow run monitoring.yml
```

Check the workflow logs for:
- ✅ "Set LHCI extraHeaders for authenticated pages"
- ✅ Successful Lighthouse runs on `/dashboard?perf=1`

## 🔄 When to Update

Update the `LH_AUTH_COOKIE` secret when:

- **Tokens expire** (typically 7 days for `auth-token`, 30 days for `refresh-token`)
- **Password changes** (if using email/password auth)
- **Monitoring tests fail** with 401/403 errors

## 🔐 Security Best Practices

✅ **Use a dedicated test account**: Create a "monitoring@pixelatedempathy.com" user  
✅ **Minimal permissions**: Give this account only "user" role (not admin)  
✅ **Set a calendar reminder**: Update tokens monthly  
✅ **Monitor usage**: Check GitHub Actions logs regularly

## 🆘 Troubleshooting

### Issue: Can't find `auth-token` cookie

**Solution**: 
- Make sure you're logged in successfully
- Check that you're looking at the correct domain
- Try logging out and back in

### Issue: Lighthouse tests fail with 403

**Solution**:
- Verify the cookie string format is correct
- Check that tokens haven't expired
- Ensure the test account has access to `/dashboard`

### Issue: Cookies expire too quickly

**Solution**:
- Use the `refresh-token` in addition to `auth-token`
- Consider increasing session duration in `src/config/auth.config.ts`

## 📚 What Gets Tested

With `LH_AUTH_COOKIE` configured, Lighthouse will test:

- ✅ **Public pages**: Homepage, login, etc.
- ✅ **Protected pages**: `/dashboard?perf=1`
- ✅ **Performance metrics**: FCP, LCP, TTI, CLS, TBT

---

**Need more details?** See the comprehensive guide:  
[docs/guides/technical-guides/deployment/lighthouse-auth-setup.md](./lighthouse-auth-setup.md)

