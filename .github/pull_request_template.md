## Summary

<!-- Brief description of what this PR does and why -->

## Changes

<!-- List the key changes in this PR -->

-

## Migration Review (if `db/` changes)

<!-- If this PR includes database migrations, check the following: -->

- [ ] Migration file follows `NNN_description.sql` naming convention
- [ ] Rollback file included (`NNN_description.rollback.sql`) if schema is modified
- [ ] Migration tested locally with `./scripts/devops/validate-migrations.sh`
- [ ] No destructive operations without explicit `IF EXISTS` / `IF NOT EXISTS` guards
- [ ] Indexes added for new columns used in queries
- [ ] Migration is idempotent (safe to run multiple times)

**If this PR does not modify `db/`, delete this section.**

## Testing

<!-- How did you verify these changes? -->

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm vitest run -c config/vitest.config.ts` passes
- [ ] Manual testing performed (describe below)

## Security & Privacy

<!-- For safety-critical or PHI-related changes -->

- [ ] No PHI or secrets committed
- [ ] No type suppressions added (`@ts-ignore`, `as any`, etc.)
- [ ] HIPAA compliance verified if clinical workflow affected

## Checklist

- [ ] Branch is up to date with target branch
- [ ] Commit messages follow conventional commits
- [ ] Self-review completed
