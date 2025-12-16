# Documentation Organization Plan

## Current Structure Analysis
The docs folder contains 42+ files scattered in the root with some existing subdirectories. We need to organize these into a clear, navigable structure.

## Proposed Structure

### 1. Core documentation (move to root level)
- README.md - Main documentation index
- API_GUIDE.md - Quick start guide
- CONTRIBUTING.md - Contribution guidelines

### 2. `/api/` directory (expand existing)
- Keep existing structure
- Add missing API documentation files referenced in README
- Ensure all API guides are properly linked

### 3. `/guides/` directory (new)
```
guides/
├── user-guides/
│   ├── therapist-dashboard.md (from user-guides/therapist-dashboard-guide.md)
│   ├── journal-research.md (from user-guides/journal-research-guide.md)
│   └── README.md
├── technical-guides/
│   ├── authentication-setup.md
│   ├── deployment/
│   │   ├── vercel-troubleshooting.md
│   │   ├── nemo-deployment-troubleshooting.md
│   │   ├── nemo-data-designer-deployment.md
│   │   ├── nemo-data-designer-remote-deployment.md
│   │   ├── terraform-gitlab-integration.md
│   │   └── README.md
│   ├── infrastructure/
│   │   ├── gke-cluster-status-commands.md
│   │   ├── gke-shutdown-guide.md
│   │   ├── vpa-optimization-report.md
│   │   ├── vpa-memory-optimization-applied.md
│   │   ├── vpa-installation-summary.md
│   │   ├── cluster-optimization-report.md
│   │   └── README.md
│   └── README.md
└── development-guides/
    ├── sentry/
    │   ├── setup.md (from sentry-code-mappings.md, sentry-metrics-implementation.md)
    │   ├── troubleshooting.md
    │   └── README.md
    ├── nemo/
    │   ├── setup.md (from nemo-data-designer-setup.md)
    │   ├── authentication.md (from nemo-jobs-authentication-*.md)
    │   └── README.md
    └── README.md
```

### 4. `/operations/` directory (new)
```
operations/
├── ops/
│   ├── labeling.md
│   ├── training.md
│   ├── validation.md
│   ├── ingestion.md
│   ├── serving.md
│   └── README.md
├── security/
│   ├── credential-files-security.md
│   ├── threat-intelligence-system.md (from threat-intelligence-system-documentation.md)
│   └── README.md
├── support/
│   ├── incident-response-procedures.md
│   ├── support-ticket-system.md
│   ├── rollback-procedures.md
│   └── README.md
└── README.md
```

### 5. `/features/` directory (new)
```
features/
├── analytics/
│   ├── charts-production.md
│   ├── bias-detection-methodology.md
│   └── README.md
├── designs/
│   ├── design-system.md
│   ├── design-system-improvements.md
│   ├── unified-dark-theme-documentation.md
│   ├── unified-dark-theme-guide.md
│   ├── unified-dark-theme-summary.md
│   └── README.md
└── README.md
```

### 6. `/development/` directory (new)
```
development/
├── journal-research/
│   ├── pipeline.md (from journal-research-pipeline.md)
│   ├── e2e-test-guide.md (from journal-research-e2e-test-guide.md)
│   ├── integration-test-results.md (from journal-research-integration-test-results.md)
│   ├── components.md (from components/journal-research-components.md)
│   └── README.md
├── optimization/
│   ├── performance-optimization.md
│   ├── priority-2-optimization-results.md
│   ├── optimization-implementation-log.md
│   ├── preprocessing-pipeline.md
│   └── README.md
└── README.md
```

### 7. `/reference/` directory (new)
```
reference/
├── ci-cd/ (keep existing)
│   └── ENTERPRISE_PIPELINE_SYSTEM.md
├── architectures/
│   ├── property.md
│   ├── plan.md
│   ├── tasks.md
│   ├── typescript-errors-fix-plan.md
│   └── README.md
└── README.md
```

## Migration Steps

### Step 1: Create directory structure
```bash
mkdir -p docs/guides/{user-guides,technical-guides/{deployment,infrastructure},development-guides/{sentry,nemo}}
mkdir -p docs/operations/{ops,security,support}
mkdir -p docs/features/{analytics,designs}
mkdir -p docs/development/{journal-research,optimization}
mkdir -p docs/reference/{architectures}
```

### Step 2: Move files according to the plan
[Detailed file moves will be tracked in separate task]

### Step 3: Create README files
Each directory will get a README.md file explaining its contents.

### Step 4: Update main docs/README.md
Create main index that links to all sections.

### Step 5: Check and update any broken links
Use grep to find references to moved files and update them.

## Expected Outcome
- Clear hierarchical structure
- Easy navigation for users
- Logical grouping of related documentation
- Consistent naming conventions
- Reduced clutter in docs root