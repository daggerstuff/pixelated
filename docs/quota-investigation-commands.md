# QUOTA INVESTIGATION COMMANDS
# Find what's consuming your 300GB quota

## IMMEDIATE INVESTIGATION COMMANDS

### 1. Check ALL disks across all zones
```bash
gcloud compute disks list --project=pixelated-463209-e5 --format="table(name,zone,sizeGb,type,status)"
```

### 2. Check GKE-specific disks (often hidden)
```bash
gcloud compute disks list --project=pixelated-463209-e5 --filter="name~gke" --format="table(name,zone,sizeGb,type,status)"
```

### 3. Check by individual zones
```bash
for zone in us-east1-a us-east1-b us-east1-c us-east1-d; do echo "=== $zone ==="; gcloud compute disks list --project=pixelated-463209-e5 --zone="$zone" --format="table(name,sizeGb,type,users.list():label=ATTACHED_TO)"; done
```

### 4. Check instance templates (can consume quota)
```bash
gcloud compute instance-templates list --project=pixelated-463209-e5 --format="table(name,properties.disks[].initializeParams.diskSizeGb,properties.disks[].initializeParams.diskType)"
```

### 5. Check snapshots (consume quota)
```bash
gcloud compute snapshots list --project=pixelated-463209-e5 --format="table(name,diskSizeGb,creationTimestamp)"
```

### 6. Check regional quota details
```bash
gcloud compute regions describe us-east1 --project=pixelated-463209-e5 --format="json" | jq '.quotas[] | select(.metric=="SSD_TOTAL_GB")'
```

### 7. Check ALL compute instances
```bash
gcloud compute instances list --project=pixelated-463209-e5 --format="table(name,zone,machineType,status,disks[].source,disks[].diskSizeGb)"
```

### 8. Check for unattached disks (safe to delete)
```bash
gcloud compute disks list --project=pixelated-463209-e5 --filter="-users:*" --format="table(name,zone,sizeGb,type)"
```

### 9. Check GKE clusters (if any exist)
```bash
gcloud container clusters list --project=pixelated-463209-e5 --format="table(name,location,currentNodeCount,status)"
```

### 10. Check specific GKE node pools
```bash
gcloud container node-pools list --cluster=pixelcluster --region=us-east1 --project=pixelated-463209-e5 --format="table(name,config.machineType,config.diskSizeGb,config.diskType)" 2>/dev/null || echo "No node pools found"
```

## WHAT TO LOOK FOR:

### **High Priority Issues:**
- **GKE system disks**: Look for `gke-pixelcluster-*` disks
- **Large disks**: Anything over 50GB
- **Unattached disks**: Safe to delete
- **Instance templates**: With 100GB+ disk configurations
- **Old snapshots**: Consuming quota without being used

### **Common Culprits:**
1. **GKE boot disks**: Usually 100GB each
2. **GKE node pool disks**: Additional disks per node
3. **Instance templates**: With oversized disk configurations
4. **Regional persistent disks**: That span multiple zones
5. **Old snapshots**: Forgotten backups consuming space

## IMMEDIATE ACTION:

**Run these commands in order:**
1. `gcloud compute disks list --project=pixelated-463209-e5 --format="table(name,zone,sizeGb,type,status)"`
2. `gcloud compute disks list --project=pixelated-463209-e5 --filter="name~gke" --format="table(name,zone,sizeGb,type,status)"`
3. `gcloud compute instance-templates list --project=pixelated-463209-e5 --format="table(name,properties.disks[].initializeParams.diskSizeGb)"`

**The output will show you exactly what's consuming your 300GB quota so you can delete it.**