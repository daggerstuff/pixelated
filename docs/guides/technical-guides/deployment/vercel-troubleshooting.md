# Vercel Troubleshooting Guide

## Quick Status Check

Your current Vercel project status:
- **Project**: `pixelated` (ID: `prj_1ndi1nLeqAnCpeZwVk8XYZzDB4eb`)
- **Framework**: Astro
- **Node Version**: 24.x
- **Latest Deployment**: READY ✅
- **Team**: Black Mage

## Common Issues & Solutions

### 1. Build Failures

#### Issue: Build timeout or OOM errors
**Symptoms:**
- Builds fail with "Build exceeded maximum build time"
- Memory errors during build process

**Solutions:**
```bash
# Check build logs
vercel logs <deployment-url>

# Increase Node.js memory limit in vercel.json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=8192"
    }
  }
}
```

#### Issue: TypeScript compilation errors
**Symptoms:**
- `tsc --noEmit` fails
- Type errors blocking deployment

**Solutions:**
1. Fix type errors locally first:
```bash
pnpm typecheck
```

2. Ensure `tsc` is called via pnpm in CI:
```bash
# ✅ CORRECT
pnpm exec tsc --noEmit

# ❌ WRONG (won't find tsc in PATH)
tsc --noEmit
```

#### Issue: Missing dependencies
**Symptoms:**
- `Cannot find module` errors
- Build fails with dependency errors

**Solutions:**
1. Verify all dependencies are in `package.json`:
```bash
pnpm install --frozen-lockfile
```

2. Check Vercel build command:
```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

### 2. Configuration Issues

#### Issue: vercel.json conflicts with Astro auto-detection
**Current Configuration:**
Your `vercel.json` uses custom handler routing:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "deploy/vercel/vercel-handler.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/deploy/vercel/vercel-handler.js"
    }
  ]
}
```

**Potential Issues:**
1. **Missing dist directory**: Ensure build creates `dist/` before deployment
2. **Handler path incorrect**: Verify `dist/server/entry.mjs` exists after build
3. **Astro adapter mismatch**: Ensure Node adapter is configured in `astro.config.mjs`

**Verification Steps:**
```bash
# 1. Build locally and verify output
pnpm build
ls -la dist/server/entry.mjs

# 2. Test the handler import
node -e "import('./deploy/vercel/vercel-handler.js')"

# 3. Check Astro config
grep -A 5 "adapter:" astro.config.mjs
```

**Solution if handler fails:**
Remove custom `vercel.json` and let Astro auto-detect:
```bash
mv vercel.json vercel.json.backup
# Astro will auto-configure for Vercel SSR
```

### 3. Environment Variable Problems

#### Issue: Missing or incorrect environment variables
**Symptoms:**
- Runtime errors about undefined variables
- API calls failing
- Authentication not working

**Required Variables (from your config):**
```bash
# Application
NODE_ENV=production
PUBLIC_SITE_URL=https://pixelatedempathy.com

# Database
POSTGRES_URL=...
MONGODB_URI=...

# Authentication
AUTH_SECRET=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=...

# APIs
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

**Solutions:**
1. **Set in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add variables for Production, Preview, and Development
   - Redeploy after adding variables

2. **Verify variables are accessible:**
```typescript
// In your code, check if variables exist
if (!process.env.REQUIRED_VAR) {
  throw new Error('REQUIRED_VAR is not set')
}
```

3. **Check variable names:**
   - Use `PUBLIC_` prefix for client-side variables
   - Server-only variables don't need prefix
   - Verify case sensitivity matches code

### 4. Deployment Timeout Issues

#### Issue: Function execution timeout
**Symptoms:**
- 504 Gateway Timeout errors
- Functions timing out after 10s (Hobby) or 60s (Pro)

**Solutions:**
1. **Optimize serverless functions:**
   - Reduce database query times
   - Add caching for expensive operations
   - Use edge functions for static content

2. **Check function timeout settings:**
```json
{
  "functions": {
    "deploy/vercel/vercel-handler.js": {
      "maxDuration": 60
    }
  }
}
```

3. **Optimize build process:**
   - Split large chunks
   - Use dynamic imports
   - Enable ISR for static pages

### 5. Framework-Specific Problems

#### Issue: Astro SSR not working correctly
**Current Setup Analysis:**
Your `astro.config.mjs` uses Node adapter by default (line 122), which is correct for Vercel.

**Verification:**
```bash
# Check adapter configuration
node -e "
  const config = await import('./astro.config.mjs');
  console.log(JSON.stringify(config.default.adapter, null, 2));
"
```

**Common Issues:**
1. **Adapter not installed:**
```bash
pnpm add @astrojs/node
```

2. **Output mode incorrect:**
   - Ensure `output: 'server'` or `output: 'hybrid'` in Astro config
   - Static output won't use SSR

3. **Handler file path mismatch:**
  - Verify `deploy/vercel/vercel-handler.js` imports from correct path
   - Check `dist/server/entry.mjs` exists after build

### 6. Runtime Errors

#### Issue: 500 Internal Server Error
**Debugging Steps:**
1. **Check deployment logs:**
```bash
vercel logs <deployment-url> --follow
```

2. **View function logs in Vercel Dashboard:**
   - Go to Deployment → Functions tab
   - Click on function to see logs

3. **Enable debug logging:**
```json
{
  "build": {
    "env": {
      "NODE_ENV": "production",
      "DEBUG": "*"
    }
  }
}
```

#### Issue: CORS errors
**Solutions:**
1. **Configure CORS in Astro middleware:**
```typescript
// src/middleware.ts
export function onRequest({ request, setHeaders }) {
  setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  });
}
```

2. **Check Vercel headers configuration:**
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

## Systematic Troubleshooting Process

### Step 1: Check Deployment Status
```bash
# List recent deployments
vercel list

# Get specific deployment details
vercel inspect <deployment-url>

# View build logs
vercel logs <deployment-url>
```

### Step 2: Verify Local Build
```bash
# Clean build
rm -rf dist .astro
pnpm install
pnpm build

# Verify output structure
ls -la dist/
ls -la dist/server/
```

### Step 3: Test Locally
```bash
# Run production build locally
pnpm build
node dist/server/entry.mjs
```

### Step 4: Check Configuration
```bash
# Verify vercel.json syntax
node -e "console.log(JSON.parse(require('fs').readFileSync('vercel.json')))"

# Check Astro config
node -e "import('./astro.config.mjs').then(c => console.log(c.default))"
```

### Step 5: Review Build Logs
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on failed deployment
3. Review Build Logs tab for errors
4. Check Function Logs tab for runtime errors

## Quick Fixes Checklist

- [ ] Clear Vercel cache: `rm -rf .vercel` then redeploy
- [ ] Verify Node version matches (`node: 24.x`)
- [ ] Check all environment variables are set
- [ ] Ensure `pnpm-lock.yaml` is committed
- [ ] Verify build command: `pnpm build`
- [ ] Check `dist/server/entry.mjs` exists after build
- [ ] Verify handler import path is correct
- [ ] Review deployment logs for specific errors
- [ ] Test build locally before deploying
- [ ] Check Vercel build settings match package.json scripts

## Preventive Measures

### 1. Pre-deployment Checks
Create a script to verify before deployment:
```bash
#!/bin/bash
# scripts/pre-deploy-check.sh

set -e

echo "🔍 Running pre-deployment checks..."

# Check build
pnpm build || { echo "❌ Build failed"; exit 1; }

# Check handler exists
test -f dist/server/entry.mjs || { echo "❌ Handler not found"; exit 1; }

# Type check
pnpm typecheck || { echo "❌ Type errors"; exit 1; }

echo "✅ All checks passed!"
```

### 2. Environment Variable Template
Keep `.env.example` updated with all required variables:
```bash
# Copy .env.example and fill in values
cp .env.example .env.local
# Add to Vercel Dashboard
```

### 3. Monitoring Setup
- Enable Vercel Analytics
- Set up error tracking (Sentry)
- Configure performance budgets
- Set up deployment notifications

## Getting Help

### Vercel Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Astro on Vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/)
- [Vercel Status Page](https://www.vercel-status.com/)

### Debug Commands
```bash
# Full deployment info
vercel inspect --debug

# Build locally with Vercel
vercel build

# Test deployment locally
vercel dev
```

### Next Steps
If issues persist:
1. Check Vercel status page for outages
2. Review recent changes in git history
3. Compare working vs failing deployments
4. Contact Vercel support with deployment URL and logs

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Module not found` | Missing dependency | Run `pnpm install` |
| `Cannot find dist/server/entry.mjs` | Build failed or wrong path | Check Astro output configuration |
| `504 Gateway Timeout` | Function timeout | Optimize code or increase timeout |
| `Environment variable not found` | Missing env var | Set in Vercel Dashboard |
| `Build exceeded maximum build time` | Slow build | Optimize build or use Vercel Pro |
| `Invalid vercel.json` | JSON syntax error | Validate JSON syntax |

