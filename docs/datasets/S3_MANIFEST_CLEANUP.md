# S3 Manifest Cleanup Plan

## Overview
This document outlines the cleanup of deprecated manifests in favor of the new unified Release 0 manifest.

## New Unified Manifest
- **Location**: `docs/datasets/RELEASE_0_UNIFIED_MANIFEST.json` (local repo)
- **S3 Upload Target**: `s3://pixel-data/releases/v2026-01-07/RELEASE_0_UNIFIED_MANIFEST.json`
- **Status**: ✅ Created
- **Format**: Comprehensive Release 0 inventory with all dataset families

## Deprecated S3 Manifests (To Be Deleted)

### 1. FINAL_TRAINING_DATA_MANIFEST.json
```bash
# Location
s3://pixel-data/datasets/consolidated/FINAL_TRAINING_DATA_MANIFEST.json

# Size: 4.28 KB
# Last Modified: 2025-12-10T05:00:27+00:00
# Status: DEPRECATED - Partial coverage, replaced by unified manifest

# Delete command:
AWS_ACCESS_KEY_ID=32550a7ff349465d98c0295f3d5917d8 \
AWS_SECRET_ACCESS_KEY=4feed7cc00c04742b352ce3b93eb6431 \
aws s3 rm \
  --endpoint-url https://s3.us-east-va.io.cloud.ovh.us \
  --region us-east-1 \
  s3://pixel-data/datasets/consolidated/FINAL_TRAINING_DATA_MANIFEST.json
```

### 2. MANIFEST.json
```bash
# Location
s3://pixel-data/datasets/consolidated/MANIFEST.json

# Size: 2.94 KB
# Last Modified: 2025-12-10T05:00:27+00:00
# Status: DEPRECATED - Generic manifest, replaced by unified manifest

# Delete command:
AWS_ACCESS_KEY_ID=32550a7ff349465d98c0295f3d5917d8 \
AWS_SECRET_ACCESS_KEY=4feed7cc00c04742b352ce3b93eb6431 \
aws s3 rm \
  --endpoint-url https://s3.us-east-va.io.cloud.ovh.us \
  --region us-east-1 \
  s3://pixel-data/datasets/consolidated/MANIFEST.json
```

### 3. MASTER_STAGE_MANIFEST.json
```bash
# Location
s3://pixel-data/datasets/consolidated/final/MASTER_STAGE_MANIFEST.json

# Size: 0.25 KB
# Last Modified: 2025-12-10T05:00:35+00:00
# Status: DEPRECATED - Stage-only manifest, replaced by unified manifest

# Delete command:
AWS_ACCESS_KEY_ID=32550a7ff349465d98c0295f3d5917d8 \
AWS_SECRET_ACCESS_KEY=4feed7cc00c04742b352ce3b93eb6431 \
aws s3 rm \
  --endpoint-url https://s3.us-east-va.io.cloud.ovh.us \
  --region us-east-1 \
  s3://pixel-data/datasets/consolidated/final/MASTER_STAGE_MANIFEST.json
```

## Deleted Local Manifests (Already Removed)

1. ✅ `ai/training_ready/data/s3_manifest.json` - Deleted
2. ✅ `ai/training_ready/data/final_dataset/manifest.json` - Deleted  
3. ✅ `ai/training_ready/docs/manifest.json` - Deleted

## Retained Manifests (Not Deprecated)

The following manifests serve different purposes and are **NOT deleted**:

- `public/manifest.json` - Web app manifest
- `ai/training_ready/data/contract_definitions/manifest_schema.json` - Schema definition
- `ai/lightning/production/deployment_package/package_manifest.json` - Deployment package
- `ai/data/training_policy_manifest.json` - Training policy config
- `.vercel/output/static/manifest.json` - Vercel build artifact
- `dist/client/manifest.json` - Build artifact

## Upload New Unified Manifest to S3

```bash
# Upload unified manifest to Release 0 location
AWS_ACCESS_KEY_ID=32550a7ff349465d98c0295f3d5917d8 \
AWS_SECRET_ACCESS_KEY=4feed7cc00c04742b352ce3b93eb6431 \
aws s3 cp \
  --endpoint-url https://s3.us-east-va.io.cloud.ovh.us \
  --region us-east-1 \
  docs/datasets/RELEASE_0_UNIFIED_MANIFEST.json \
  s3://pixel-data/releases/v2026-01-07/RELEASE_0_UNIFIED_MANIFEST.json
```

## Execution Order

1. ✅ Create unified manifest locally
2. ✅ Delete deprecated local manifests
3. ⏳ Upload unified manifest to S3 release directory
4. ⏳ Verify unified manifest in S3
5. ⏳ Delete deprecated S3 manifests (run commands above)
6. ⏳ Update training pipeline references to new manifest location

## Rollback Plan

If issues arise, the deprecated S3 manifests have these ETags for restoration:

- FINAL_TRAINING_DATA_MANIFEST.json: `efe4d4cb227aa60c2514f6a931c1726b`
- MANIFEST.json: `23d1b41669590eda1e8afe76324028b3`
- MASTER_STAGE_MANIFEST.json: Not specified (file is minimal)

## Notes

- New unified manifest provides complete Release 0 coverage
- All dataset families inventoried (priority, professional_therapeutic, cot_reasoning, edge_cases, voice)
- Ready for training pipeline integration
- Includes provenance, size, and quality metadata
- Documents readiness gates and next actions
