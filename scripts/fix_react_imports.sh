#!/bin/bash

# Files with unused React imports
files=(
  "src/components/demo/EnterpriseAdminDashboard.tsx"
  "src/components/demo/EnterpriseMonitoringDashboard.tsx"
  "src/components/demo/KnowledgeParsingDemo.tsx"
  "src/components/demo/PsychologyFrameworksDemo.tsx"
  "src/components/demo/ResultsExportDemo.tsx"
  "src/components/demo/__tests__/integration/PipelineIntegration.test.tsx"
  "src/components/layout/SidebarReact.tsx"
  "src/components/monitoring/RUMWidget.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file"
    # Replace "import React, { ... }" with "import { ... }"
    sed -i 's/import React, { /import { /g' "$file"
    # Replace "import React from 'react'" with empty line if it's the only import
    sed -i '/^import React from .react.$/d' "$file"
  fi
done

echo "Fixed unused React imports in ${#files[@]} files"
