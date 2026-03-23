#!/bin/bash
set -e

git push origin feature/analytics-injection-layouts -f


# 2. Admin
git checkout staging
git branch -D feature/analytics-injection-admin || true
git checkout -b feature/analytics-injection-admin
git checkout stash@{0} -- src/pages/admin/ src/components/admin/ || true
git commit -m "feat(admin): inject Rybbit Analytics into admin pages"
git push origin feature/analytics-injection-admin -f

# 3. Content
git checkout staging
git branch -D feature/analytics-injection-content || true
git checkout -b feature/analytics-injection-content
git checkout stash@{0} -- src/pages/analytics/ src/pages/blog/ src/pages/components/ src/pages/dashboard/ || true
git commit -m "feat(content): inject Rybbit Analytics into content pages"
git push origin feature/analytics-injection-content -f

# 4. Demos/Docs
git checkout staging
git branch -D feature/analytics-injection-demos-docs || true
git checkout -b feature/analytics-injection-demos-docs
git checkout stash@{0} -- src/pages/demo/ src/pages/dev/ src/pages/docs/ src/pages/journal-research/ || true
git commit -m "feat(docs): inject Rybbit Analytics into demo and documentation pages"
git push origin feature/analytics-injection-demos-docs -f

# 5. Misc
git checkout staging
git branch -D feature/analytics-injection-misc || true
git checkout -b feature/analytics-injection-misc
git checkout stash@{0} -- src/pages/ || true
git checkout feature/analytics-injection-layouts -- src/pages/therapy-chat-plan.astro || true
git reset src/pages/admin/ src/pages/analytics/ src/pages/blog/ src/pages/components/ src/pages/dashboard/ src/pages/demo/ src/pages/dev/ src/pages/docs/ src/pages/journal-research/ || true
git checkout -- src/pages/admin/ src/pages/analytics/ src/pages/blog/ src/pages/components/ src/pages/dashboard/ src/pages/demo/ src/pages/dev/ src/pages/docs/ src/pages/journal-research/ || true
git commit -m "feat(misc): inject Rybbit Analytics into remaining pages" || echo "nothing to commit"
git push origin feature/analytics-injection-misc -f || true

git checkout staging
