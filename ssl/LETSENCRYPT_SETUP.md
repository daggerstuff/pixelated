# Let's Encrypt SSL Certificate Setup for pixelatedempathy.com

## Overview

This guide explains how to set up free, trusted SSL certificates from Let's Encrypt for `pixelatedempathy.com`.

## Prerequisites

1. **Domain pointing to your server**: Ensure `pixelatedempathy.com` and `www.pixelatedempathy.com` have DNS A records pointing to your server's public IP address
2. **Port 80 and 443 open**: Let's Encrypt needs access to these ports for domain validation
3. **Root or sudo access**: Required to install and configure certificates
4. **Web server running**: Apache, Nginx, or another server that can serve ACME challenges

## Installation

### Option 1: Using Certbot (Recommended)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot
```

**CentOS/RHEL:**
```bash
sudo yum install epel-release
sudo yum install certbot
```

**macOS (Homebrew):**
```bash
brew install certbot
```

### Option 2: Using Docker

```bash
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly --standalone
```

## Method 1: Standalone (Easiest for Testing)

Use this method if you don't have a web server running yet, or want to test quickly.

```bash
sudo certbot certonly --standalone -d pixelatedempathy.com -d www.pixelatedempathy.com
```

This will:
1. Temporarily start a web server on port 80
2. Validate domain ownership
3. Issue certificate
4. Save certificates to `/etc/letsencrypt/live/pixelatedempathy.com/`

## Method 2: Nginx Plugin (Recommended for Nginx)

**If you're using Nginx:**

```bash
# Install Nginx plugin if not already installed
sudo apt install python3-certbot-nginx

# Get certificate and auto-configure Nginx
sudo certbot --nginx -d pixelatedempathy.com -d www.pixelatedempathy.com
```

Certbot will automatically update your Nginx configuration to use the new certificates.

## Method 3: Apache Plugin (Recommended for Apache)

**If you're using Apache:**

```bash
# Install Apache plugin if not already installed
sudo apt install python3-certbot-apache

# Get certificate and auto-configure Apache
sudo certbot --apache -d pixelatedempathy.com -d www.pixelatedempathy.com
```

## Certificate Locations

After successful installation, certificates are stored at:

- **Certificate**: `/etc/letsencrypt/live/pixelatedempathy.com/fullchain.pem`
- **Private Key**: `/etc/letsencrypt/live/pixelatedempathy.com/privkey.pem`
- **Chain**: `/etc/letsencrypt/live/pixelatedempathy.com/chain.pem`

## Manual Web Server Configuration

If you need to manually configure your web server:

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name pixelatedempathy.com www.pixelatedempathy.com;

    ssl_certificate /etc/letsencrypt/live/pixelatedempathy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixelatedempathy.com/privkey.pem;

    # Recommended SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Your server configuration...
}

# Redirect HTTP to HTTPS (optional)
server {
    listen 80;
    listen [::]:80;
    server_name pixelatedempathy.com www.pixelatedempathy.com;

    return 301 https://$server_name$request_uri;
}
```

### Apache Configuration

```apache
<VirtualHost *:443>
    ServerName pixelatedempathy.com
    ServerAlias www.pixelatedempathy.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/pixelatedempathy.com/cert.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/pixelatedempathy.com/privkey.pem
    SSLCertificateChainFile /etc/letsencrypt/live/pixelatedempathy.com/chain.pem

    # Your server configuration...
</VirtualHost>

# Redirect HTTP to HTTPS (optional)
<VirtualHost *:80>
    ServerName pixelatedempathy.com
    ServerAlias www.pixelatedempathy.com
    Redirect permanent / https://pixelatedempathy.com/
</VirtualHost>
```

## Automatic Renewal

Let's Encrypt certificates are valid for 90 days and should be renewed automatically.

### Test Renewal (Dry Run)

```bash
sudo certbot renew --dry-run
```

### Setup Automatic Renewal

**Systemd timer (Ubuntu 18.04+):**
The certbot package automatically sets up a systemd timer. Verify it's running:

```bash
sudo systemctl status certbot.timer
```

**Cron job (if needed):**
```bash
# Add this to crontab (runs daily at 3:30 AM)
30 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

Or for Apache:
```bash
30 3 * * * certbot renew --quiet --post-hook "systemctl reload apache2"
```

## Troubleshooting

### "Connection refused" error

**Problem**: Port 80 or 443 blocked
**Solution**: 
```bash
# Check firewall rules
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or for firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### "Invalid domain" or DNS error

**Problem**: Domain not pointing to correct IP
**Solution**:
```bash
# Check DNS propagation
dig pixelatedempathy.com +short
nslookup pixelatedempathy.com
```

Wait up to 24 hours for DNS to propagate.

### Rate limiting

Let's Encrypt has rate limits (50 certificates per domain per week). If you hit this limit, use their staging environment:

```bash
sudo certbot --test-mode --standalone -d pixelatedempathy.com
```

### Web server reload fails

After renewal, certbot needs to reload your web server. If it can't auto-detect your web server, set up a renewal hook:

```bash
# Edit /etc/letsencrypt/cli.ini or /etc/letsencrypt/renewal/pixelatedempathy.com.conf
renew_hook = systemctl reload nginx
```

## Security Best Practices

1. **Use strong TLS configurations**:
   - Enable TLS 1.2 and 1.3 only
   - Disable weak ciphers
   - Enable HSTS if appropriate
   - Use OCSP stapling if possible

2. **Test your SSL configuration**:
   Visit https://www.ssllabs.com/ssltest/ and run the test

3. **Monitor expiration**:
   ```bash
   sudo certbot certificates
   ```

4. **Backup certificates**:
   ```bash
   sudo tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt
   ```

## Local Development (Self-Signed)

For local development, use the self-signed certificate in this directory:

```bash
# Regenerate with correct SANs
ssl/regenerate-cert.sh

# Files are in:
# ssl/certs/business-strategy-cms.crt
# ssl/private/business-strategy-cms.key
```

**Note**: You'll still see a security warning in browsers for self-signed certificates. Trust them manually for development.

## Summary

- **Production**: Use Let's Encrypt (recommended) or another trusted CA
- **Development**: Use the self-signed certificate in `ssl/`
- **Never use self-signed certificates in production**

The self-signed certificate we generated in [`ssl/regenerate-cert.sh`](ssl/regenerate-cert.sh:1) is suitable for local development only.