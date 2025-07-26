# CDN Setup Guide

This guide explains how to configure and use a CDN for serving static assets in production.

## Prerequisites

1. AWS S3 bucket for storing assets
2. AWS IAM user with S3 write permissions
3. (Optional) CloudFront distribution in front of the S3 bucket

## Configuration

### Required Environment Variables

Set these in your AWS Amplify Console:

- `CDN_BUCKET_NAME`: Your S3 bucket name
- `AWS_ACCESS_KEY_ID`: AWS access key with S3 write permissions
- `AWS_SECRET_ACCESS_KEY`: Corresponding AWS secret key
- `AWS_REGION`: AWS region (defaults to us-east-1)
- `CDN_URL`: Base URL of your CDN (e.g., https://your-cdn.example.com)

### Local Development

For local development, no additional setup is needed. The application will use local assets.

## How It Works

1. During build, the `upload-to-cdn.js` script will:
   - Scan the `public` directory for assets
   - Upload them to the configured S3 bucket
   - Generate a mapping of local paths to CDN URLs

2. The Vite plugin will replace local asset paths with CDN URLs in the built output.

3. In production, assets will be served from the CDN instead of the application server.

## Testing Locally

To test the CDN upload locally:

```bash
export CDN_BUCKET_NAME=your-bucket-name
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export CDN_URL=https://your-cdn-url.com
node scripts/upload-to-cdn.js
```

## Troubleshooting

- If you see 403 errors, check the IAM permissions for your AWS credentials
- If assets aren't being replaced, check the CDN asset map in `src/cdn-asset-map.json`
- Ensure the `CDN_URL` is correctly set and includes the protocol (https://)

## Disabling CDN

To disable CDN and use local assets:
1. Remove the CDN-related environment variables
2. The build will automatically fall back to using local assets
