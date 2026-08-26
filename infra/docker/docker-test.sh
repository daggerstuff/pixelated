#!/bin/bash
docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.59.1-noble /bin/bash -c "
  apt-get update && apt-get install -y build-essential &&
  npm install -g pnpm &&
  chmod +x scripts/devops/pnpm-install-with-fallback.sh &&
  scripts/devops/pnpm-install-with-fallback.sh &&
  pnpm exec playwright test
"
sudo chown -R $USER:$USER node_modules playwright-report test-results
