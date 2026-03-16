# AGENTS.md: src/components/

## PURPOSE

UI components organized by domain (admin/, ai/, chat/, dashboard/, ui/). Use domain folders, not type folders.

## STRUCTURE

```
src/components/
├── admin/          # Admin dashboard
├── ai/             # AI chat interfaces
├── analytics/      # Data viz
├── auth/           # Login, signup
├── chat/           # Core chat UI
├── crisis/         # Crisis intervention
├── dashboard/      # User dashboards
├── journal-research/ # Research pipeline UI
├── layout/         # Page layouts
├── monitoring/     # Metrics displays
├── professional/   # Clinical tools
├── security/       # Security UI
├── session/        # Session management
├── therapy/        # Therapeutic tools
├── ui/             # shadcn/ui base (81 files)
├── widgets/        # Reusable widgets
├── *.tsx/.astro    # Top-level page components
└── __tests__/      # Component tests
```

## CONVENTIONS

- **React**: PascalCase (`BiasDetectionEngine.tsx`)
- **Astro**: kebab-case (`chat.astro`)
- **Tests**: `*.test.tsx` alongside or `__tests__/`
- **Domain grouping**: Use domain folders (ai/, chat/), not type-based
- **Reusable UI**: put in `ui/` as shadcn components
- **Styling**: Tailwind first; `cn()` for conditionals; WCAG AA accessible
- **Props**: Explicit interfaces; default export
- **State**: Local `useState`, global Zustand, server React Query
- **Responsive**: Mobile-first (`md:`, `lg:`)
- **Dark mode**: `dark:` variants with HSL tokens

## WHERE TO FIND

| Domain | Folder | Key Components |
|--------|--------|----------------|
| AI Chat | `ai/`, `chat/` | `AIChatReact.tsx`, `PixelatedEmpathyAgentChat.tsx` |
| Admin | `admin/` | Dashboard, analytics |
| Clinical | `professional/`, `therapy/` | Therapist tools |
| Shared UI | `ui/`, `widgets/` | Buttons, cards, dialogs |
| Monitoring | `monitoring/` | Metrics, health |

## CODE MAP

| Component | Location | Purpose |
|-----------|----------|---------|
| Main chat UI | `ai/AIChatReact.tsx` | Conversational interface |
| Agent chat | `PixelatedEmpathyAgentChat.tsx` | Full AI agent experience |
| Training | `training/TrainingSession.tsx` | Therapy simulator |

## TESTING & QUALITY

- Unit: Vitest + RTL (`*.test.tsx`)
- Accessibility: `jest-axe` for WCAG violations
- E2E: Playwright in `tests/browser/`
- Target: 80%+ coverage

## SECURITY & PERFORMANCE

- **HIPAA**: Never log PII; redact patient data
- **FHE**: Show encryption status for secured AI
- **Crisis**: Include safety interventions in chat flows
- **Perf**: `React.memo()`, lazy load, virtualize lists; keep <200 lines

## ANTI-PATTERNS

❌ Business logic in components → `src/lib/services/`
❌ Direct API calls → use `@/lib` clients
❌ Hard-coded strings → i18n for user-facing text
❌ Inline styles → Tailwind only
❌ Empty divs for spacing → use spacing utilities

---

_Generated: 2025-03-15 | Domain: Frontend UI Components_
