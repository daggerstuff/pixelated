#!/bin/bash
# Regenerate SSL certificate with correct SANs for pixelatedempathy.com

SSL_DIR="$(dirname "$0")"
cd "$SSL_DIR" || exit 1

echo "Regenerating SSL certificate for pixelatedempathy.com..."
echo ""

# Backup existing certificates
echo "Backing up existing certificates..."
mkdir -p backup
cp certs/business-strategy-cms.crt backup/ 2>/dev/null || true
cp certs/business-strategy-cms.csr backup/ 2>/dev/null || true
cp certs/business-strategy-cms.pem backup/ 2>/dev/null || true
echo "Backup created in ssl/backup/"
echo ""

# Generate new private key and CSR
echo "Generating new private key and CSR..."
openssl req -new -newkey rsa:4096 -sha256 \
    -nodes \
    -keyout ./private/business-strategy-cms.key \
    -out ./certs/business-strategy-cms.csr \
    -config openssl.cnf \
    -extensions v3_req

if [ $? -ne 0 ]; then
    echo "Error: Failed to generate CSR"
    exit 1
fi
echo "✓ Private key and CSR generated"
echo ""

# Generate self-signed certificate
echo "Generating self-signed certificate..."
openssl x509 -req -sha256 \
    -days 3650 \
    -in ./certs/business-strategy-cms.csr \
    -signkey ./private/business-strategy-cms.key \
    -out ./certs/business-strategy-cms.crt \
    -extensions v3_req \
    -extfile openssl.cnf

if [ $? -ne 0 ]; then
    echo "Error: Failed to generate certificate"
    exit 1
fi
echo "✓ Certificate generated (valid for 10 years)"
echo ""

# Create PEM file for applications
cat ./certs/business-strategy-cms.crt ./private/business-strategy-cms.key > ./certs/business-strategy-cms.pem
chmod 600 ./certs/business-strategy-cms.pem
echo "✓ PEM file created"
echo ""

# Display certificate info
echo "Certificate Details:"
echo "===================="
openssl x509 -in ./certs/business-strategy-cms.crt -text -noout | grep -A 2 "Subject:"
echo ""
openssl x509 -in ./certs/business-strategy-cms.crt -text -noout | grep -A 10 "Subject Alternative Name"
echo ""
echo "✓ Certificate successfully regenerated!"
echo ""
echo "The new certificate is valid for:"
echo "  - pixelatedempathy.com"
echo "  - www.pixelatedempathy.com"
echo "  - *.pixelatedempathy.com"
echo "  - localhost"
echo "  - *.localhost"
echo ""
echo "To use this certificate, restart your web server and load:"
echo "  Certificate: ssl/certs/business-strategy-cms.crt"
echo "  Private Key: ssl/private/business-strategy-cms.key"
echo ""
echo "IMPORTANT: This is a self-signed certificate. You will need to:"
echo "  1. Accept the security warning in your browser, OR"
echo "  2. Import the certificate into your browser's trusted certificates"
echo ""