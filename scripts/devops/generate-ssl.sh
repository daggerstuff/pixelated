#!/bin/bash

# SSL Certificate Generation Script for Business Strategy CMS
# This script generates self-signed SSL certificates for development
# For production, use Let's Encrypt with Certbot

set -e

echo "🔐 Generating SSL Certificates for Business Strategy CMS..."

# Create SSL directory
mkdir -p ./ssl/certs ./ssl/private
chmod 700 ./ssl/private

# Generate private key
openssl genrsa -out ./ssl/private/business-strategy-cms.key 4096
chmod 600 ./ssl/private/business-strategy-cms.key

# Generate certificate signing request
openssl req -new -key ./ssl/private/business-strategy-cms.key -out ./ssl/certs/business-strategy-cms.csr -config ./ssl/openssl.cnf

# Generate self-signed certificate (valid for 1 year)
openssl x509 -req -in ./ssl/certs/business-strategy-cms.csr -signkey ./ssl/private/business-strategy-cms.key -out ./ssl/certs/business-strategy-cms.crt -days 365 -extensions v3_req -extfile ./ssl/openssl.cnf

# Create combined certificate for nginx
cat ./ssl/certs/business-strategy-cms.crt ./ssl/private/business-strategy-cms.key > ./ssl/certs/business-strategy-cms.pem
chmod 600 ./ssl/certs/business-strategy-cms.pem

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificate files:"
echo "   - Certificate: ./ssl/certs/business-strategy-cms.crt"
echo "   - Private Key: ./ssl/private/business-strategy-cms.key"
echo "   - Combined: ./ssl/certs/business-strategy-cms.pem"
echo ""
echo "⚠️  These are self-signed certificates for development use only."
echo "   For production, use Let's Encrypt with Certbot."
echo ""
echo "🔧 To use in production, update SSL_CERT_PATH and SSL_KEY_PATH in .env"