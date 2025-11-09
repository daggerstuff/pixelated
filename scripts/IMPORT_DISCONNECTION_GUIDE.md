# OpenMemory Import - Disconnection Resilience Guide

## Current Status

Your import is currently running in a regular terminal session. If you disconnect, the process **will be killed**.

## Solutions

### Option 1: Let Current Process Finish (Recommended if close to done)

The current process has been running for ~43 minutes and has imported ~2,100+ memories. If you're close to completion, you can:

1. **Monitor progress:**
   ```bash
   find .brv -name "*.md" | wc -l
   ```

2. **Check if process is still running:**
   ```bash
   ps aux | grep migrate_openmemory
   ```

3. **If disconnected and process died**, use Option 2 or 3 below.

### Option 2: Resume with Built-in Resume Functionality (NEW!)

The script now has **automatic resume capability**. If the process dies, you can simply restart it:

```bash
# The script will automatically skip already-imported memories
uv run python scripts/migrate_openmemory_to_byterover.py \
    --import-file openmemory_memories_export.json \
    --resume
```

**How it works:**
- Scans `.brv/ace/bullets/` directory for already-imported memories
- Extracts `originalId` from metadata in each file
- Skips memories that have already been imported
- Only imports new memories

**Estimated time if you need to restart:**
- ~2,100 memories already imported = ~7 minutes of saved time
- Remaining ~2,400 memories = ~8 minutes

### Option 3: Use Screen for Disconnection Resilience

For future runs or if you want to restart in a resilient way:

```bash
# Start import in a screen session
bash scripts/run_import_resilient.sh

# Attach to see progress
screen -r openmemory_import

# Detach (keeps running): Press Ctrl+A then D

# View logs
tail -f openmemory_import.log
```

**Benefits:**
- Process survives disconnection
- Can attach/detach anytime
- Logs to file for monitoring
- Can check progress without interrupting

### Option 4: Use Tmux (Alternative to Screen)

```bash
# Start tmux session
tmux new -s openmemory_import

# Run import
cd /home/vivi/pixelated
uv run python scripts/migrate_openmemory_to_byterover.py \
    --import-file openmemory_memories_export.json \
    --resume

# Detach: Press Ctrl+B then D
# Attach: tmux attach -t openmemory_import
```

## If Disconnected: Quick Recovery

1. **Check if process is still running:**
   ```bash
   ps aux | grep migrate_openmemory
   ```

2. **Count imported memories:**
   ```bash
   find .brv -name "*.md" | wc -l
   ```

3. **Restart with resume:**
   ```bash
   uv run python scripts/migrate_openmemory_to_byterover.py \
       --import-file openmemory_memories_export.json \
       --resume
   ```

   The script will automatically:
   - Detect already-imported memories
   - Skip them
   - Only import remaining memories

## Progress Monitoring

```bash
# Count imported memories
find .brv -name "*.md" | wc -l

# Expected total: 4516
# Current progress: ~2,100+ (check with command above)

# Check latest imported file
ls -lt .brv/ace/bullets/*.md | head -1

# Monitor import rate
watch -n 5 'find .brv -name "*.md" | wc -l'
```

## Estimated Time Remaining

- **Total memories:** 4,516
- **Already imported:** ~2,100+ (check with `find .brv -name "*.md" | wc -l`)
- **Remaining:** ~2,400
- **Time per memory:** ~0.2 seconds
- **Estimated remaining time:** ~8-10 minutes

## Summary

✅ **Resume functionality:** Built-in (automatic)
✅ **Disconnection resilience:** Use screen/tmux
✅ **Progress tracking:** Check `.brv/ace/bullets/` directory
✅ **Recovery:** Simply restart with `--resume` flag

**If you get disconnected, just restart the import - it will automatically resume from where it left off!**

