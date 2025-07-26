# Known Issues & Workarounds

## ✅ RESOLVED: Astro 5.x Type Inheritance Bug

**Status**: **FIXED** - BaseAPIContext workaround successfully applied ✅

**Issue**: `Property 'request' does not exist on type 'AuthAPIContext'`

**Solution Applied**:
1. ✅ Created `BaseAPIContext` with explicit `request: Request` in `/src/lib/auth/apiRouteTypes.ts`  
2. ✅ Updated `AuthAPIContext` to extend `BaseAPIContext` (bypassing Astro's broken `APIContext`)
3. ✅ Verified all API routes compile without TypeScript errors

**Verification Commands**:
```bash
# Quick diagnostic
./scripts/diagnose-astro-types.sh

# Test specific file  
pnpm exec tsc --noEmit --skipLibCheck src/pages/api/emotions/session-analysis.ts
```

**Files Successfully Fixed**:
- ✅ `/src/lib/auth/apiRouteTypes.ts` - Core type definitions  
- ✅ `/src/pages/api/emotions/session-analysis.ts` - Example working API route
- ✅ All API routes using `protectRoute()` wrapper now have proper `request` access

**Root Cause**: Astro 5.x `APIContext<Props, APIParams>` extends `AstroSharedContext<Props, Params>` with mismatched generics breaking TypeScript inheritance chain.

**Full Documentation**: See `/docs/ASTRO_TYPE_INHERITANCE_BUG.md` for complete technical analysis

**Affected Astro Versions**: 5.10.1+ (monitor for upstream fixes in future releases)

---

*For other known issues, see individual documentation files in `/docs/`*
