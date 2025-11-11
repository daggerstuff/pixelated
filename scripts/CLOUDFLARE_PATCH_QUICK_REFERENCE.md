# Cloudflare Patch - Quick Reference

## Usage

### Quick Apply (Recommended)
```bash
./scripts/apply-cloudflare-patch-quick.sh
```

### From Tar Archive
```bash
./scripts/apply-cloudflare-patch.sh ../cloudflare-pages-patch-v3-complete.tar.gz
```

## What It Does

1. ✅ Adds Cloudflare adapter: `pnpm astro add cloudflare -y`
2. ✅ Creates `functions/_middleware.js` with MessageChannel polyfill
3. ✅ Updates `astro.config.mjs` to use advanced mode
4. ✅ Adds MessageChannel polyfill to `src/middleware.ts`
5. ✅ Adds prerender exports to static pages
6. ✅ Creates `CLOUDFLARE_DEPLOYMENT.md` documentation
7. ✅ Commits all changes

## Fixed Issues

- ✅ **No more false warnings**: Adapter detection is now accurate
- ✅ **Proper configuration**: Correctly sets `mode: 'advanced'` and `functionPerRoute: false`
- ✅ **Reliable updates**: Uses Node.js for file manipulation with sed fallback

## Applying to Different Branches

```bash
git checkout <branch-name>
./scripts/apply-cloudflare-patch-quick.sh
git push origin <branch-name>
```

## Files Created/Modified

- `functions/_middleware.js` (created)
- `astro.config.mjs` (updated)
- `src/middleware.ts` (updated if exists)
- `src/pages/*.astro` (updated - prerender exports)
- `CLOUDFLARE_DEPLOYMENT.md` (created)

## Next Steps After Applying

1. Review changes: `git diff HEAD~1`
2. Test build: `pnpm build`
3. Push to remote: `git push`

