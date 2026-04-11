# Hetzner Object Storage Setup Guide

## Overview

This guide explains how to configure the Business Strategy CMS to use Hetzner
Object Storage instead of AWS S3. Hetzner provides S3-compatible object storage
with the same API endpoints and SDK compatibility.

## Configuration

### 1. Environment Variables

Update your `.env` file with Hetzner credentials:

```bash
# Hetzner Object Storage (S3-compatible)
HETZNER_ENDPOINT=https://hel1.your-objectstorage.com
HETZNER_ACCESS_KEY_ID=your-hetzner-access-key
HETZNER_SECRET_ACCESS_KEY=your-hetzner-secret-key
HETZNER_REGION=your-region (e.g., hel1)
HETZNER_BUCKET_NAME=your-bucket-name

# Optional: Custom settings
MAX_FILE_SIZE=10485760  # 10MB default
UPLOAD_PATH=./uploads   # Local fallback for development
```

### 2. Hetzner Credentials

Get your credentials from Hetzner:

1. **Access Key ID**: Your Hetzner access key
2. **Secret Access Key**: Your Hetzner secret key
3. **Endpoint**: Based on your region:
   - `https://hel1.your-objectstorage.com` (Default Hetzner endpoint)
   - `https://hel1.your-objectstorage.com` (Hetzner default)

### 3. Bucket Creation

Create your bucket using Hetzner Control Panel or API:

```bash
# Using AWS CLI
aws s3api create-bucket \
  --bucket your-bucket-name \
  --endpoint-url https://hel1.your-objectstorage.com \
  --region hel1
```

## Usage

### File Upload

```typescript
import { MediaService } from '@/services/mediaService'

// Upload a file
const upload = await MediaService.uploadFile(file, userId, 'documents')
console.log('File uploaded:', upload.key)

// Get signed URL for secure access
const signedUrl = await MediaService.getSignedUrl(upload.key, 3600)
console.log('Signed URL:', signedUrl)
```

### File Management

```typescript
// List files
const files = await MediaService.listFiles('documents')

// Get file metadata
const metadata = await MediaService.getFileMetadata('documents/file.pdf')

// Delete file
await MediaService.deleteFile('documents/file.pdf')
```

## Features

### ✅ **Supported Operations**

- File upload with automatic folder organization
- Secure file access via signed URLs
- File metadata retrieval
- File deletion
- Folder-based listing
- Bucket creation and management

### ✅ **File Types**

- Images (JPEG, PNG, GIF, WebP)
- PDFs
- Office documents (Word, Excel, PowerPoint)
- Text files and Markdown
- Custom file types

### ✅ **Security**

- Private ACL by default
- Signed URLs for temporary access
- Metadata tracking (uploaded-by, original-name)
- Content-Type validation

## Regional Endpoints

| Region               | Endpoint                                |
| -------------------- | --------------------------------------- |
| Hetzner Default      | `https://hel1.your-objectstorage.com`   |

## Migration from AWS S3

The migration is seamless since both use the same AWS SDK. Simply update:

1. **Environment variables** from AWS*\* to HETZNER*\*
2. **Endpoint URL** to Hetzner regional endpoint
3. **Region** to your Hetzner region

### Before (AWS S3)

```bash
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=hel1
AWS_S3_BUCKET=my-bucket
```

### After (Hetzner)

```bash
HETZNER_ACCESS_KEY_ID=xxx
HETZNER_SECRET_ACCESS_KEY=xxx
HETZNER_REGION=hel1
HETZNER_BUCKET_NAME=my-bucket
HETZNER_ENDPOINT=https://hel1.your-objectstorage.com
```

## Testing

Test your Hetzner integration:

```bash
# Install dependencies
pnpm install

# Test Hetzner connection
pnpm test:hetzner

# Upload test file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.pdf" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

1. **Access Denied**: Check Hetzner credentials and bucket permissions
2. **Endpoint Not Found**: Verify region endpoint URL
3. **Bucket Not Found**: Ensure bucket exists in correct region

### Debug Mode

Enable debug logging:

```bash
DEBUG=aws-sdk* pnpm dev
```

### Direct API Test

```typescript
import AWS from 'aws-sdk'

const s3 = new AWS.S3({
  endpoint: 'https://hel1.your-objectstorage.com',
  accessKeyId: 'your-key',
  secretAccessKey: 'your-secret',
  region: 'gra',
  s3ForcePathStyle: true,
})

// Test connection
s3.listBuckets().promise().then(console.log).catch(console.error)
```

## Performance

- **Upload Speed**: Comparable to AWS S3
- **Latency**: Regional optimization
- **Bandwidth**: No egress charges within Hetzner
- **CDN**: Optional integration with Hetzner CDN

## Cost

Hetzner Object Storage pricing:

- Storage: €0.01/GB/month
- Outbound traffic: €0.01/GB
- API requests: €0.01 per 1,000 requests

## Production Checklist

- [ ] Valid Hetzner credentials
- [ ] Correct regional endpoint
- [ ] Bucket created in correct region
- [ ] Environment variables configured
- [ ] Security groups/ACLs configured
- [ ] CORS settings for web access
- [ ] Bucket lifecycle policies
- [ ] Backup strategy implemented
