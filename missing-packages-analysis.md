# Missing Package Analysis

*Generated: 2025-09-07*

## 🔍 **Scan Results Summary**
- **Files scanned**: 847
- **Unique imports found**: 147  
- **Total missing**: 72
- **Real packages to add**: ~15-20

## ❌ **Real Missing Packages** (Need to Install)

### **Dependencies (Production)**
1. `aws-sdk` - AWS SDK for cloud services
2. `node-fetch` - Fetch polyfill for Node.js  
3. `pdfkit` - PDF generation
4. `pg` - PostgreSQL client
5. `recharts` - React charting library
6. `ultrahtml` - HTML parsing/manipulation

### **DevDependencies (Development)**
1. `@playwright/test` - Playwright testing framework
2. `@testing-library/dom` - DOM testing utilities
3. `@testing-library/jest-dom` - Jest DOM matchers
4. `@testing-library/react` - React testing utilities  
5. `@testing-library/user-event` - User event simulation
6. `@fontsource/inter` - Inter font package
7. `@vercel/kv` - Vercel KV database client
8. `k6` - Performance testing tool
9. `playwright` - Browser automation (might be redundant with @playwright/test)

## ✅ **False Positives** (Already Available/Not Needed)

### **Node.js Built-ins** (Don't install)
- `child_process`, `crypto`, `events`, `fs`, `http`, `path`, `url`, `zlib`
- `node:*` imports (Node.js 16+ syntax)

### **Astro Virtual Imports** (Don't install) 
- `astro:assets`, `astro:content`, `astro:middleware`, `astro:transitions`

### **Path Aliases** (Configured in tsconfig.json)
- `@/components`, `@/lib`, `@/utils`, etc.
- These are local path mappings, not npm packages

### **Invalid/Typos** (Don't install)
- `$1`, `~`, `src`, `https:` - These are parsing artifacts

## 🎯 **Installation Strategy**

Install the real missing packages in batches to avoid conflicts:

### **Batch 1: Core Dependencies**
```bash
pnpm add aws-sdk node-fetch pdfkit pg recharts ultrahtml
```

### **Batch 2: Testing Framework**  
```bash
pnpm add -D @playwright/test @testing-library/dom @testing-library/jest-dom @testing-library/react @testing-library/user-event
```

### **Batch 3: Additional Tools**
```bash
pnpm add -D @fontsource/inter @vercel/kv
```

## ⚠️ **To Verify**
- `k6` - Check if actually used for performance testing
- `playwright` vs `@playwright/test` - May be redundant
- `next` - Might be a false positive from comments/examples
