1. **Target Component:** `src/components/research/ResearchDashboard.tsx`
2. **Issue:** The navigation tabs in the Research Dashboard lack ARIA attributes, making it less accessible for screen reader users. The `<nav>` element should have `aria-label='Dashboard navigation'`, the tabs should have `role='tab'`, `aria-selected={dashboardView === tab.id}`, `aria-controls={`tabpanel-${tab.id}`}`.  Currently, buttons just act as tab switches.
3. **Change to Make:** Modify the `button` mapping loop in `ResearchDashboard.tsx` around line 200 to include:
   - `role='tab'`
   - `aria-selected={dashboardView === tab.id}`
   - `aria-controls={`panel-${tab.id}`}`
   Add `role='tablist'` and `aria-label='Dashboard views'` to the `<nav>` element.
   Add `role='tabpanel'` and `id={`panel-${dashboardView}`}` to the `<main>` element.
4. **Verification:** Run `pnpm lint` and `pnpm test`.
5. **Log Learning:** Create `.Jules/palette.md` and log the learning about ARIA tabs.
