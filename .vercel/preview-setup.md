# Vercel Preview Deployment Setup Guide

## Overview
This guide helps you set up automatic preview deployments for multiple branches (master, q, rovo, cursor) with different frontend themes.

## Quick Setup (5 minutes)

### 1. Connect Repository to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click "Add New Project"
4. Import your `pixelatedempathy/pixelated` repository
5. Vercel will auto-detect Astro

### 2. Configure Build Settings
Vercel should auto-detect, but verify:
- **Framework Preset:** Astro
- **Build Command:** `pnpm build`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`
- **Root Directory:** `./` (default)

### 3. Environment Variables
Set these in Vercel Dashboard → Project → Settings → Environment Variables:

**Required for all branches:**
```
NODE_ENV=production
PUBLIC_SITE_URL=https://pixelatedempathy.com
```

**Branch-specific (optional):**
- You can set different env vars per branch in Vercel dashboard
- Useful if different branches need different API endpoints or configs

### 4. Automatic Preview URLs
Once connected, every branch/PR automatically gets a preview URL:
- `master`: `pixelated-{hash}.vercel.app` (production)
- `q`: `pixelated-git-q-{hash}.vercel.app`
- `rovo`: `pixelated-git-rovo-{hash}.vercel.app`
- `cursor`: `pixelated-git-cursor-{hash}.vercel.app`
- PRs: `pixelated-git-{branch}-{hash}.vercel.app`

### 5. Custom Domains (Optional)
For cleaner URLs, set up custom domains:
1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add domains:
   - `preview-q.pixelatedempathy.com` → q branch
   - `preview-rovo.pixelatedempathy.com` → rovo branch
   - `preview-cursor.pixelatedempathy.com` → cursor branch
   - `preview.pixelatedempathy.com` → master branch

## Branch Configuration

### Enable Preview Deployments for Specific Branches
By default, Vercel deploys all branches. To limit to specific branches:

1. Go to Vercel Dashboard → Project → Settings → Git
2. Under "Production Branch", set to `master`
3. Under "Ignored Build Step", you can add:
   ```bash
   # Only build these branches
   if [[ "$VERCEL_GIT_COMMIT_REF" != "master" && "$VERCEL_GIT_COMMIT_REF" != "q" && "$VERCEL_GIT_COMMIT_REF" != "rovo" && "$VERCEL_GIT_COMMIT_REF" != "cursor" ]]; then
     exit 1
   fi
   ```

## Testing Different Themes

Each branch will automatically deploy with its theme:
- **master**: Default theme
- **q**: Q branch theme
- **rovo**: Rovo branch theme  
- **cursor**: Cursor branch theme

The themes are already in the code, so no additional configuration needed!

## Monitoring Deployments

1. **Vercel Dashboard**: See all deployments and their status
2. **GitHub Integration**: Preview URLs appear in PR comments automatically
3. **Deployment Status**: Check build logs if deployments fail

## Troubleshooting

### Build Fails
- Check Node.js version (needs 24+)
- Verify `pnpm install` completes successfully
- Check build logs in Vercel dashboard

### Preview Not Updating
- Ensure branch is pushed to GitHub
- Check Vercel is connected to correct GitHub repo
- Verify branch name matches exactly

### Environment Variables Not Working
- Ensure variables are set for correct environment (Production, Preview, Development)
- Check variable names match exactly (case-sensitive)
- Restart deployment after adding new variables

## Alternative: Netlify Setup

If you prefer Netlify, create `netlify.toml`:

```toml
[build]
  command = "pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"

[[plugins]]
  package = "@astrojs/netlify"

[context.branch-deploy]
  command = "pnpm build"

[context.deploy-preview]
  command = "pnpm build"
```

## Cost Estimate

**Vercel Hobby (Free):**
- ✅ Unlimited preview deployments
- ✅ 100GB bandwidth/month
- ✅ 100 serverless function executions/day
- ✅ Perfect for branch previews

**Vercel Pro ($20/mo):**
- ✅ Unlimited everything
- ✅ 1TB bandwidth/month
- ✅ Team collaboration
- ✅ Only needed if you exceed free tier

For branch previews, the free tier is more than sufficient!

## Next Steps

1. ✅ Connect repo to Vercel
2. ✅ Verify first deployment succeeds
3. ✅ Test preview URLs for each branch
4. ✅ Set up custom domains (optional)
5. ✅ Share preview links with team

## Support

- Vercel Docs: https://vercel.com/docs
- Astro + Vercel: https://docs.astro.build/en/guides/deploy/vercel/
- Vercel Discord: https://vercel.com/discord

