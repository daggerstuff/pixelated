# Handoff: OVH Persona Regeneration Job (Stage2)

## 🟢 Current Status: Fixed & Relaunched (2026-03-01)

The OVH Persona Re-Generation job has been successfully debugged and relaunched.

### 🛠️ Fixes Applied

1. **UID Alignment**: Updated `ai/Dockerfile` to use **UID 42420** (ovhcloud),
   which is mandated by the OVH AI Training platform. This resolved the "Exit
   Code 2" permission errors.
2. **Import Path Fix**: Corrected the source file layout and set
   `PYTHONPATH=/app`. Source code is now at `/app/ai/`, allowing
   `from ai.core ...` to resolve correctly.
3. **Cache Breaker**: Updated `scripts/ovh/ovhai-run-persona-regeneration.sh` to
   use **unique timestamped tags** (e.g., `v1772392159`) for every build/push.
   This bypasses the stale `:latest` cache on OVH nodes.

### 🚀 Active Job

- **UUID**: `4bab277d-77b0-45d3-8c02-9b27036653ca`
- **Tag**: `v1772392159`
- **Monitoring**: `ovhai job logs 4bab277d-77b0-45d3-8c02-9b27036653ca`

### 📚 Internal Knowledge

- Operational guide created at
  `docs/operations/ovh-ai-training-troubleshooting.md`.
- Byterover (`brv`) curated with these technical decisions.
- Asana Task "3.2 Persona Re-Generation" updated with findings.

---

## 🛠️ Next Steps

1. **Monitor Logs**: Confirm the first few records are processed without
   GPU/memory issues.
2. **Verify S3 Output**: Once the job finishes, check
   `s3://pixel-data/final_dataset/shards/curriculum/stage2/synthetic_persona_batch_5k.jsonl`.
3. **Clean up Registry**: Periodically delete old timestamped tags from Docker
   Hub to save space.

## Key OVH Jobs (IDs)

- v3: `c4a0c8fd-6c79-46b8-b8e1-80e5fa9ca1d7` (FAILED import)
- v4: `0bb658d7-1b48-4ca0-b3bf-66f34e1d9f9c` (FAILED import)
- v5: `235cd935-a23f-4997-b838-e1812f24d0d4` (FAILED import)
- v6: `e7d52b2f-ba9c-48b3-951b-1f893e181dbf` (FAILED missing script path)
- v7: `75747138-04f8-4281-a02a-02a93a867795` (FAILED exit code 2, no logs)
- All old jobs deleted successfully:
  - `5ed4a16c-0c32-4359-8882-d088e46e08b1`
  - `8d21c7b4-e0f8-42ce-bd46-7e6d627f4e2f`
  - `10f714dc-bade-476a-a750-8ba4531d6b9a`
  - `0bb658d7-1b48-4ca0-b3bf-66f34e1d9f9c`
  - `c4a0c8fd-6c79-46b8-b8e1-80e5fa9ca1d7`
  - `26affc87-6aff-407a-9d01-def2e95df433`
  - `bc2e1ee5-eb3e-4464-9708-857c9d37b3c3`
  - `6a07ee29-888b-41bb-a3a5-b6594a8691c2`
  - `332b300a-2a2c-41b6-b626-88140425f727`
  - `7950e748-b76c-46f2-8961-0ea2c66661a0`
  - `235cd935-a23f-4997-b838-e1812f24d0d4`
  - `e7d52b2f-ba9c-48b3-951b-1f893e181dbf`

## Important Observations

- `ai/Dockerfile` copies source into `/app/ai`:
  - `COPY --chown=ubuntu:ubuntu . ai/`
  - `WORKDIR /app/ai`
- The script exists locally at `ai/training/scripts/batch_regenerate.py`.
- The **import error suggests** that inside OVH, either:
  - the image still doesn’t have `ai/core`, or
  - PYTHONPATH is wrong, or
  - the command is pointing to a path not present in that image.
- A prior OVH probe on an older image showed `/app/ai` only had `data/`,
  indicating the wrong image contents.

## Next Concrete Steps (what I was about to do)

1. **Inspect the built image locally** to confirm file layout and correct
   command:

   ```bash
   docker run --rm --entrypoint bash pixelatedempathy/training-node:latest -lc "ls -la /app/ai/training/scripts | sed -n '1,40p'"
   docker run --rm --entrypoint bash pixelatedempathy/training-node:latest -lc "python -c 'import sys; print(sys.path); import ai.core; print(ai.core)'"
   ```

2. If files are present locally but OVH still fails, consider **tagging the
   image with a new tag** and re-run:

   ```bash
   docker tag pixelatedempathy/training-node:latest pixelatedempathy/training-node:pix-148-regenerate
   docker push pixelatedempathy/training-node:pix-148-regenerate
   ```

   Then run OVH job with that tag to force cache refresh.

3. If local image also lacks files, fix Dockerfile context or `.dockerignore`
   and rebuild.

## Current Job Command Template (desired)

```bash
ovhai job run \
  --name "pixelated-persona-regeneration-v7" \
  --gpu 1 --flavor "l40s-1-gpu" \
  --env PYTHONPATH="/app/ai" \
  --env GOOGLE_CLOUD_API_KEY="$GOOGLE_CLOUD_API_KEY" \
  --env OVH_S3_ACCESS_KEY="$OVH_S3_ACCESS_KEY" \
  --env OVH_S3_SECRET_KEY="$OVH_S3_SECRET_KEY" \
  --env OVH_S3_ENDPOINT="$OVH_S3_ENDPOINT" \
  --env OVH_S3_BUCKET="$OVH_S3_BUCKET" \
  --env OVH_S3_REGION="$OVH_S3_REGION" \
  docker.io/pixelatedempathy/training-node:latest \
  -- python /app/ai/training/scripts/batch_regenerate.py \
     --input-s3-prefix final_dataset/shards/curriculum/stage2/ \
     --output-s3-key final_dataset/shards/curriculum/stage2/synthetic_persona_batch_5k.jsonl \
     --max-records 5000 \
     --defense-model-path /tmp/model.ckpt \
     --defense-model-s3-key models/psydefdetect/psydef_deberta_v3_base.ckpt \
     --s3-bucket pixel-data
```

## Research Request

User asked for deep web scan using agent skills. Firecrawl skill requires
`FIRECRAWL_API_KEY`, which is **not set**. Web research has not been completed
yet.
