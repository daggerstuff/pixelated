# Task Checklist for fixing Azure pipeline failure
- [ ] Identify the duplicated mapping key in `pnpm-lock.yaml`
- [ ] Edit `pnpm-lock.yaml` to remove the duplicate entry for `jsonwebtoken@9.0.3`
- [ ] Verify that `pnpm install --frozen-lockfile` succeeds locally
- [ ] Commit the fixed lockfile and push changes
- [ ] Run Azure pipeline to confirm the failure is resolved
