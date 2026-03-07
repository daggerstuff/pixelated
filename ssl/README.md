# SSL Certificates

This directory contains SSL certificates for the PixelatedEmpathy project.

## Quick Start

### For Production (Recommended)
Use Let's Encrypt for trusted, free SSL certificates. See [`LETSENCRYPT_SETUP.md`](LETSENCRYPT_SETUP.md:1) for detailed instructions.

**Quick command:**
```bash
# Install certbot (Ubuntu/Debian)
sudo apt install certbot

# Get certificate (standalone method)
sudo certbot certonly --standalone -d pixelatedempathy.com -d www.pixelatedempathy.com
```

### For Development (Local Only)
Use the self-signed certificate in this directory:

```bash
# Regenerate with correct SANs
bash ssl/regenerate-cert.sh

# Server configuration:
# Certificate: ssl/certs/business-strategy-cms.crt
# Private Key: ssl/private/business-strategy-cms.key
```

## Files

| File | Description |
|------|-------------|
| [`openssl.cnf`](openssl.cnf:1) | OpenSSL configuration with SANs |
| [`regenerate-cert.sh`](regenerate-cert.sh:1) | Script to regenerate self-signed certificate |
| [`LETSENCRYPT_SETUP.md`](LETSENCRYPT_SETUP.md:1) | Complete Let's Encrypt setup guide |
| `certs/business-strategy-cms.crt` | Self-signed certificate (for dev) |
| `private/business-strategy-cms.key` | Private key (for dev) |
| `certs/business-strategy-cms.pem` | Combined PEM file (for dev) |

## Important Notes

**Production vs Development**
- **Production**: Use Let's Encrypt or a trusted CA certificate
- **Development**: Use the self-signed certificate (`ssl/certs/business-strategy-cms.crt`)

**Self-Signed Warnings**
- Modern browsers will show security warnings for self-signed certificates
- This is expected and normal for local development
- For production, always use trusted certificates

## Certificate Details

The self-signed certificate supports:
- `pixelatedempathy.com`
- `www.pixelatedempathy.com`
- `*.pixelatedempathy.com` (wildcard subdomains)
- `localhost`
- `*.localhost`
- `127.0.0.1` and `::1`

Valid for 10 years from generation date.