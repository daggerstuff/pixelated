# Cloudflare Pages Patch Application Scripts

This directory contains scripts to easily apply the Cloudflare Pages deployment patch to any branch.

## Quick Start

### Option 1: Quick Apply (Recommended)

If you have the patch files in `.notes/cloudflare-patch/`:

```bash
./scripts/apply-cloudflare-patch-quick.sh
```

Or with a custom commit message:

```bash
./scripts/apply-cloudflare-patch-quick.sh "feat: Add Cloudflare Pages support"
```

### Option 2: From Tar Archive

If you have a tar.gz archive:

```bash
./scripts/apply-cloudflare-patch.sh ../cloudflare-pages-patch-v3-complete.tar.gz
```

Or with custom commit message:

```bash
./scripts/apply-cloudflare-patch.sh ../cloudflare-pages-patch-v3-complete.tar.gz "feat: Add Cloudflare Pages support"
```

## What These Scripts Do

1. **Extract patch** (if using tar archive)
2. **Add Cloudflare adapter**: Runs `pnpm astro add cloudflare -y`
3. **Apply patch**: Runs the patch script which:
   - Creates `functions/_middleware.js` with MessageChannel polyfill
   - Updates `astro.config.mjs` to use Cloudflare adapter with advanced mode
   - Adds MessageChannel polyfill to `src/middleware.ts` (if present)
   - Adds prerender exports to static pages
   - Creates `CLOUDFLARE_DEPLOYMENT.md` documentation
4. **Commit changes**: Commits all changes with the specified message

## Applying to Different Branches

```bash
# Switch to target branch
git checkout <branch-name>

# Apply patch (quick method)
./scripts/apply-cloudflare-patch-quick.sh

# Or from tar archive
./scripts/apply-cloudflare-patch.sh ../cloudflare-pages-patch-v3-complete.tar.gz

# Review changes
git diff HEAD~1

# Test build
pnpm build

# Push to remote
git push origin <branch-name>
```

## Fixed Issues

### Adapter Detection Warning

The original patch script showed a warning "Adapter already configured or not found" even when the adapter was correctly configured. This has been fixed by:

1. **Better detection**: The script now properly checks if Cloudflare adapter is imported and configured
2. **Smarter updates**: Only updates the adapter configuration if needed
3. **Clear messages**: Provides clear feedback about what's being done

### Adapter Configuration

The script now:
- Checks if `@astrojs/cloudflare` is imported
- Checks if `adapter: cloudflare()` is configured
- Updates `mode: 'directory'` to `mode: 'advanced'` if present
- Adds `functionPerRoute: false` if not present
- Removes `platformProxy` configuration if present
- Provides clear feedback instead of warnings

## Manual Application

If you prefer to apply the patch manually:

1. **Add Cloudflare adapter**:
   ```bash
   pnpm astro add cloudflare -y
   ```

2. **Run patch script**:
   ```bash
   cd .notes/cloudflare-patch
   ./CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh
   ```

3. **Review and commit**:
   ```bash
   git add .
   git commit -m "feat: Add Cloudflare Pages compatibility"
   ```

## Troubleshooting

### Patch Script Not Found

If you get "Patch script not found":
- Ensure `.notes/cloudflare-patch/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh` exists
- Or provide the correct path to the tar archive

### Adapter Already Installed

If the adapter is already installed, the script will continue without error. This is expected behavior.

### Build Failures

After applying the patch:
1. Clear cache: `rm -rf .astro node_modules/.vite`
2. Reinstall: `pnpm install`
3. Rebuild: `pnpm build`

### Git Commit Fails

If git commit fails:
- Check if there are actually changes to commit: `git status`
- The script will continue even if commit fails (you can commit manually)

## Files Modified by Patch

- `functions/_middleware.js` - Created with MessageChannel polyfill
- `astro.config.mjs` - Updated adapter configuration
- `src/middleware.ts` - Added MessageChannel polyfill (if file exists)
- `src/pages/*.astro` - Added prerender exports to static pages
- `CLOUDFLARE_DEPLOYMENT.md` - Created documentation

## Scripts

- `apply-cloudflare-patch.sh` - Full script with tar extraction support
- `apply-cloudflare-patch-quick.sh` - Quick script using `.notes/cloudflare-patch/`
- `.notes/cloudflare-patch/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh` - The actual patch script

## Notes

- The patch script is idempotent - it's safe to run multiple times
- The script checks for existing configurations before making changes
- All changes are committed automatically (unless disabled)
- The script works from any branch

