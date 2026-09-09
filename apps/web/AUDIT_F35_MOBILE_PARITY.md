# F3.5 Mobile Parity Hardening — Audit & Compliance

**Ticket**: PIX-4417
**Branch**: `fm/ehr-f35-mobile-parity`
**Date**: 2026-09-09

---

## 1. Feature Parity Audit

### Overview

The EHR Mobile Parity Hardening (F3.5) extends the desktop EHR portal to support
full mobile usage with offline capabilities. The following table maps desktop
features to their mobile equivalents.

| Feature               | Desktop Component     | Mobile Component             | Offline Support | Parity Status |
| --------------------- | --------------------- | ---------------------------- | --------------- | ------------- |
| **Layout**            | Desktop portal layout | `EHRMobileLayout`            | N/A             | ✅ Parity     |
| **Note Drafting**     | Desktop note editor   | `ModalityNoteEditor`         | Draft → Sync    | ✅ Parity     |
| **Scheduling**        | `SchedulingWidget`    | `MobileScheduleView`         | Queue → Sync    | ✅ Parity     |
| **Messaging**         | `MessagingWidget`     | `MessagingWidget` (offline)  | Queue → Sync    | ✅ Parity     |
| **Outcomes**          | Desktop outcomes form | Offline sync service         | Queue → Sync    | ✅ Parity     |
| **Sync Engine**       | N/A                   | `OfflineSyncService`         | Full offline    | ✅ New        |
| **PWA Install**       | N/A                   | `manifest.json` + `sw.js`    | N/A             | ✅ New        |
| **Bottom Navigation** | Top nav bar           | Fixed bottom nav (56px)      | N/A             | ✅ Parity     |
| **Touch Targets**     | Mouse/click           | ≥44px all interactive        | N/A             | ✅ New        |
| **Horizontal Scroll** | Responsive grid       | `overflow-x-hidden` enforced | N/A             | ✅ New        |

### Offline Sync Architecture

The `OfflineSyncService` (1040 lines) provides a unified offline-first sync
engine supporting four item types:

1. **Draft Notes** (`SyncItemType.note`): Auto-saved with 1.5s debounce,
   versioned, conflict resolution (client-wins / server-wins / manual)
2. **Appointment Actions** (`SyncItemType.appointment`): Create, cancel,
   reschedule queued with optimistic UI
3. **Messages** (`SyncItemType.message`): New threads and replies queued
4. **Outcomes** (`SyncItemType.outcome`): Clinical outcome submissions queued

### API Endpoints (Offline Sync Targets)

| Item Type  | Endpoint                                    | Method |
| ---------- | ------------------------------------------- | ------ |
| Notes      | `/api/ehr/v1/notes`                         | POST   |
| Scheduling | `/api/portal/v1/scheduling`                 | POST   |
| Scheduling | `/api/portal/v1/scheduling/{id}/cancel`     | POST   |
| Scheduling | `/api/portal/v1/scheduling/{id}/reschedule` | POST   |
| Messaging  | `/api/portal/v1/messaging`                  | POST   |
| Messaging  | `/api/portal/v1/messaging/{threadId}`       | POST   |
| Outcomes   | `/api/portal/v1/outcomes`                   | POST   |

### Storage & Security

- `EncryptedLocalStorageAdapter`: AES-GCM encryption via Web Crypto API
- `InMemoryStorageAdapter`: Testing fallback
- `SecureStorageAdapter` interface allows pluggable storage backends
- `clearSessionData()`: HIPAA-compliant session purge

### Service Worker

`sw.js` (173 lines) provides:

- Cache versioning via `__SW_VERSION__` placeholder
- **Static assets**: CacheFirst strategy
- **API routes**: StaleWhileRevalidate (non-PHI routes only)
- **Navigation**: NetworkFirst with cache fallback
- **PHI protection**: Never intercepts `/api/sessions/`, `/api/auth/`, `/api/ehr/`, `/api/portal/`, `/fhir/`

---

## 2. WCAG 2.1 AA Compliance — Mobile Components

### EHRMobileLayout (174 lines)

| WCAG Criterion          | Implementation                        | Status |
| ----------------------- | ------------------------------------- | ------ |
| **1.3.1 Info & Rel**    | Semantic `<nav>`, `<aside>`, `<main>` | ✅     |
| **1.4.3 Contrast**      | CSS vars `--np-text`, `--np-muted`    | ✅     |
| **1.4.10 Reflow**       | `overflow-x-hidden` on containers     | ✅     |
| **1.4.11 Non-text**     | Borders use `--np-line` color         | ✅     |
| **2.1.1 Keyboard**      | All interactive elements focusable    | ✅     |
| **2.4.1 Bypass**        | `aria-label` on `<nav>` and `<aside>` | ✅     |
| **2.4.7 Focus Visible** | Default focus rings preserved         | ✅     |
| **4.1.2 Name/Role/Val** | `aria-label` on all controls          | ✅     |

### ModalityNoteEditor (430 lines)

| WCAG Criterion        | Implementation                               | Status |
| --------------------- | -------------------------------------------- | ------ |
| **1.3.1 Info & Rel**  | `aria-expanded`, `aria-controls` on sections | ✅     |
| **1.4.3 Contrast**    | Status indicators use themed colors          | ✅     |
| **2.1.1 Keyboard**    | All inputs, selects, buttons focusable       | ✅     |
| **2.1.2 No Trap**     | Collapsible sections don't trap focus        | ✅     |
| **2.4.6 Headings**    | `aria-labelledby` on sections                | ✅     |
| **3.2.1 On Focus**    | No context change on focus                   | ✅     |
| **3.3.1 Error Ident** | `role="alert"` on conflict messages          | ✅     |
| **3.3.2 Labels**      | `aria-label` on save button                  | ✅     |
| **4.1.2 Name/Role**   | `aria-label` on all buttons                  | ✅     |
| **4.1.3 Status Msgs** | `role="alert"` for conflict notifications    | ✅     |

### MobileScheduleView (529 lines)

| WCAG Criterion        | Implementation                           | Status |
| --------------------- | ---------------------------------------- | ------ |
| **1.3.1 Info & Rel**  | Semantic list structure for appointments | ✅     |
| **2.1.1 Keyboard**    | All buttons, filters focusable           | ✅     |
| **2.4.6 Headings**    | `aria-labelledby` on booking dialog      | ✅     |
| **3.2.1 On Focus**    | Filter chips use `aria-pressed`          | ✅     |
| **3.3.1 Error Ident** | Conflict states surfaced via status text | ✅     |
| **4.1.2 Name/Role**   | `aria-label` on all action buttons       | ✅     |
| **4.1.2 Dialog**      | `role="dialog"`, `aria-modal="true"`     | ✅     |

### MessagingWidget (686 lines)

| WCAG Criterion       | Implementation                    | Status |
| -------------------- | --------------------------------- | ------ |
| **1.3.1 Info & Rel** | Semantic message list structure   | ✅     |
| **2.1.1 Keyboard**   | All inputs, send button focusable | ✅     |
| **3.2.1 On Focus**   | No context change on focus        | ✅     |
| **4.1.2 Name/Role**  | `aria-label` on send control      | ✅     |

### Touch Target Compliance

All interactive elements meet the WCAG 2.5.5 (Level AAA) / 2.5.8 (Level AA)
target size minimum of 44×44 CSS pixels:

- Bottom navigation bar: 56px height
- Save/sync buttons: `min-h-[44px]`
- Filter chips: `min-h-[44px]`
- Booking dialog buttons: `min-h-[44px]`

---

## 3. Lighthouse Performance Targets

### Mobile Performance Budgets

| Metric  | Target  | Verification Method                  |
| ------- | ------- | ------------------------------------ |
| **LCP** | < 2.5s  | Lighthouse mobile audit (P75)        |
| **INP** | < 200ms | Lighthouse mobile audit + field data |
| **CLS** | < 0.1   | Lighthouse mobile audit              |
| **FCP** | < 1.8s  | Lighthouse mobile audit              |
| **TBT** | < 200ms | Lighthouse mobile audit              |
| **SI**  | < 3.4s  | Lighthouse mobile audit              |

### Verification Approach

1. **CI Integration**: Lighthouse CI can run against preview builds
2. **Manual Audit**: Run `npx lighthouse http://localhost:4321/portal --emulated-form-factor=mobile` against preview server
3. **Budget Enforcement**: Lighthouse budget JSON at `.lighthouserc.json` (future work)

### Key Optimizations Already In Place

- Service worker caching (CacheFirst for static, SWR for API)
- Mobile-first CSS with `overflow-x-hidden` (prevents CLS from horizontal scroll)
- Fixed bottom navigation (no layout shift during navigation)
- Offline sync status banner only renders when needed (no unnecessary DOM weight)
- Draft notes auto-save with debounce (reduces API calls)
- Optimistic UI updates for scheduling (immediate feedback, no loading state CLS)

### PWA Installability Checklist

| Requirement              | Status | Implementation                  |
| ------------------------ | ------ | ------------------------------- |
| Web App Manifest         | ✅     | `apps/web/public/manifest.json` |
| Service Worker           | ✅     | `apps/web/public/sw.js`         |
| HTTPS (or localhost)     | ✅     | Production deployment via HTTPS |
| Icons (192px + 512px)    | ✅     | Referenced in manifest          |
| `display: standalone`    | ✅     | Set in manifest                 |
| `start_url`              | ✅     | Set to `/`                      |
| `theme_color`            | ✅     | `#1e293b`                       |
| `background_color`       | ✅     | `#0f172a`                       |
| `short_name` (≤12 chars) | ✅     | `Pixelated`                     |
| Offline fallback page    | ✅     | SW NetworkFirst with cache      |

---

## 4. Test Coverage

### Unit Tests (Vitest)

`offline-sync.service.test.ts` (447 lines, 17 tests):

- ✅ Draft note queueing and version increment
- ✅ Draft note list filtering and deletion
- ✅ Conflict resolution (client-wins, server-wins, manual)
- ✅ Scheduling actions (create, cancel, reschedule)
- ✅ Messaging queue (new thread, reply)
- ✅ Outcome submissions
- ✅ syncAll() aggregation
- ✅ HIPAA session purge
- ✅ Storage persistence and restore

### E2E Tests (Playwright)

`tests/e2e/ehr/mobile-parity.spec.ts` (16 tests across 2 viewports):

- ✅ PWA manifest served and valid
- ✅ Service worker accessible
- ✅ Mobile EHR layout renders with bottom navigation
- ✅ Offline sync status banner shows when offline
- ✅ Touch targets ≥44px
- ✅ Note editor renders on mobile viewport
- ✅ Mobile schedule view renders appointment list
- ✅ Messaging widget renders with offline queue support
- ✅ Offline note drafting creates queued draft
- ✅ Offline scheduling queues appointment action
- ✅ Offline messaging queues message
- ✅ No horizontal overflow on mobile viewport
- ✅ Sync status banner displays pending count

### Type Safety

- ✅ No `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error` introduced
- ✅ No `as any` or `as unknown` type assertions in cherry-picked files
- ✅ oxlint type-aware lint passed on all cherry-picked files
