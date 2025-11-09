# Branch Preview Deployment Setup

## Recommendation: Vercel ⭐

**Best choice for your use case:**
- ✅ Automatic preview deployments for every branch
- ✅ Zero configuration (Vercel auto-detects Astro)
- ✅ Free tier (more than enough for previews)
- ✅ 5-minute setup
- ✅ Perfect for viewing different themes (q, rovo, cursor, master)

## Quick Start

### Option 1: Vercel (Recommended)
1. Go to https://vercel.com
2. Connect your GitHub repository
3. Vercel auto-detects Astro - no configuration needed!
4. Every branch automatically gets a preview URL

**Preview URLs will be:**
- Master: `pixelated-{hash}.vercel.app`
- Q branch: `pixelated-git-q-{hash}.vercel.app`
- Rovo branch: `pixelated-git-rovo-{hash}.vercel.app`
- Cursor branch: `pixelated-git-cursor-{hash}.vercel.app`

### Option 2: Netlify (Alternative)
1. Go to https://netlify.com
2. Connect GitHub repository
3. Configure `netlify.toml` (see below)
4. Automatic preview deployments

## Configuration Files

### Vercel (vercel.json)
Already created! Vercel will use this configuration.

### Netlify (netlify.toml)
```toml
[build]
  command = "pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"
  PNPM_VERSION = "10.20.0"

[[plugins]]
  package = "@astrojs/netlify"
```

## Cost Comparison

| Platform | Free Tier | Setup Time | Auto Previews |
|----------|-----------|------------|---------------|
| **Vercel** | ✅ Unlimited previews | 5 min | ✅ Yes |
| **Netlify** | ✅ Good free tier | 10 min | ✅ Yes |
| Cloudflare | ✅ Free but complex | 30-60 min | ❌ Manual |
| Railway | ❌ $5/mo + usage | 30 min | ❌ Manual |
| Render | ⚠️ Limited free | 20 min | ✅ Yes |

## Next Steps

1. Choose Vercel (recommended) or Netlify
2. Connect repository
3. Verify first deployment
4. Test preview URLs for each branch
5. Share preview links with team

## Custom Domains (Optional)

You can set up custom domains for each branch:
- `preview-q.pixelatedempathy.com` → q branch
- `preview-rovo.pixelatedempathy.com` → rovo branch
- `preview-cursor.pixelatedempathy.com` → cursor branch

Set these up in the platform's dashboard after initial setup.
