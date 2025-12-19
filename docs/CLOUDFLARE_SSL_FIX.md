# Fixing Cloudflare Redirect Loop for Ollama

## Problem

When accessing `ollama.pixelatedempathy.com`, you get a "too_many_redirects" error. This is caused by Cloudflare's SSL/TLS mode conflicting with NGINX ingress redirects.

## Root Cause

Cloudflare is proxying your traffic, and the SSL/TLS mode is likely set to "Flexible" or incorrectly configured, causing:
1. Cloudflare receives HTTPS from users
2. Cloudflare sends HTTP to origin (NGINX)
3. NGINX redirects HTTP to HTTPS
4. Cloudflare redirects again → infinite loop

## Solution

### Option 1: Fix Cloudflare SSL/TLS Mode (Recommended)

1. Go to Cloudflare Dashboard → Your Domain → SSL/TLS
2. Set SSL/TLS encryption mode to **"Full"** or **"Full (strict)"**
   - **Full**: Cloudflare → Origin uses HTTPS (validates any cert)
   - **Full (strict)**: Cloudflare → Origin uses HTTPS (validates cert is valid)
3. Save changes

**Why this works**: With "Full" mode, Cloudflare sends HTTPS to your origin, so NGINX doesn't need to redirect.

### Option 2: Disable Cloudflare Proxy (Temporary)

1. Go to Cloudflare Dashboard → DNS
2. Find `ollama.pixelatedempathy.com` A record
3. Click the orange cloud icon to turn it gray (DNS only, not proxied)
4. Wait for DNS propagation

**Note**: This removes Cloudflare's DDoS protection and CDN benefits.

### Option 3: Use Direct IP Access (Testing Only)

For testing, you can bypass Cloudflare entirely:

```bash
# Direct HTTPS access (bypass Cloudflare)
curl -k -H "Host: ollama.pixelatedempathy.com" https://48.194.123.79/api/tags

# Or add to /etc/hosts for browser testing
echo "48.194.123.79 ollama.pixelatedempathy.com" | sudo tee -a /etc/hosts
```

## Current Configuration

The ingress has been updated to:
- ✅ `ssl-redirect: false` - NGINX won't redirect (Cloudflare handles it)
- ✅ TLS certificates are ready and valid
- ✅ Backend is working (direct IP access works)

## Verification

After fixing Cloudflare SSL/TLS mode:

```bash
# Should return 200 OK
curl -I https://ollama.pixelatedempathy.com/api/tags

# Should return list of models (or empty if none pulled yet)
curl https://ollama.pixelatedempathy.com/api/tags
```

## Apply Same Fix to Other Services

If you have the same issue with other services, update their ingress files:

- `k8s/azure/pixelated-ingress.yaml`
- `k8s/azure/nemo-ingress.yaml`

Set `nginx.ingress.kubernetes.io/ssl-redirect: "false"` in the annotations.

## Quick Fix Command

```bash
# Update all ingresses to disable SSL redirect (when behind Cloudflare)
cd /home/vivi/pixelated/terraform
export KUBECONFIG=./kubeconfig-staging.config

kubectl annotate ingress pixelated -n pixelated \
  nginx.ingress.kubernetes.io/ssl-redirect=false --overwrite

kubectl annotate ingress nemo-data-designer -n nemo-data-designer \
  nginx.ingress.kubernetes.io/ssl-redirect=false --overwrite
```
