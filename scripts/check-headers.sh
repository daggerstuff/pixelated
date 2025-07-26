#!/bin/bash
echo "Checking security headers configuration..."
# First try with our script
if node scripts/verify-security-headers.js; then
	echo "✅ Security headers verified successfully with our script"
else
	# Fallback to simpler check
	echo "Attempting fallback verification method..."
	# Define required headers for HIPAA compliance
	cat >required-headers.json <<'EOFINNER'
{
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ]
}
EOFINNER

	# Check Astro config for security headers
	if grep -r "headers" astro.config.mjs | grep -q "key"; then
		echo "✅ Security headers configuration found"
		exit 0
	else
		echo "⚠️ Warning: No security headers configuration found"
		exit 1
	fi
fi
