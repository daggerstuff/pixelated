# Vite 8 Rolldown Bug - Reminder

**Date created:** 2026-03-21

**Issue:** The rolldown bundler in Vite 8 has a bug where `BindingViteResolvePluginConfig.external` crashes during build when processing SSR external modules in `astro.config.mjs`.

**Error:**

```
Value is non of these types 'True', 'Array<T>', on BindingViteResolvePluginConfig.external
Location: .../normalize-string-or-regex-D7wlw16t.mjs:14:23
```

**Temporary fix applied:** Downgraded to Vite 7.3.1 (uses esbuild+Rollup instead of rolldown)

**When to recheck:** ~2026-04-21 (1 month)

**Links to monitor:**

- https://github.com/vitejs/vite/issues/21866
- https://github.com/rolldown/rolldown/releases

**What to do:**

1. Check if a new rolldown release includes the fix
2. Try upgrading Vite to 8.x again
3. Test the build passes
4. If fixed, remove the vite override in package.json
