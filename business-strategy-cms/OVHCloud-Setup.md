# OVHCloud Object Storage Setup Guide

## Overview
This guide explains how to configure the Business Strategy CMS to use OVHCloud Object Storage instead of AWS S3. OVHCloud provides S3-compatible object storage with the same API endpoints and SDK compatibility.

## Configuration

### 1. Environment Variables

Update your `.env` file with OVHCloud credentials:

```bash
# OVHCloud Object Storage (S3-compatible)
OVH_ENDPOINT=https://s3.[REGION].io.cloud.ovh.net
OVH_ACCESS_KEY_ID=your-ovh-access-key
OVH_SECRET_ACCESS_KEY=your-ovh-secret-key
OVH_REGION=your-region (e.g., us-east-1, gra, de, uk)
OVH_BUCKET_NAME=your-bucket-name

# Optional: Custom settings
MAX_FILE_SIZE=10485760  # 10MB default
UPLOAD_PATH=./uploads   # Local fallback for development
```

### 2. OVHCloud Credentials

Get your credentials from OVHCloud:

1. **Access Key ID**: Your OVHCloud access key
2. **Secret Access Key**: Your OVHCloud secret key
3. **Endpoint**: Based on your region:
   - `https://s3.gra.io.cloud.ovh.net` (Gravelines, France)
   - `https://s3.de.io.cloud.ovh.net` (Germany)
   - `https://s3.uk.io.cloud.ovh.net` (United Kingdom)
   - `https://s3.us-east-1.io.cloud.ovh.net` (US East)
   - `https://s3.ca-east-1.io.cloud.ovh.net` (Canada East)

### 3. Bucket Creation

Create your bucket using OVHCloud Control Panel or API:

```bash
# Using AWS CLI
aws s3api create-bucket \
  --bucket your-bucket-name \
  --endpoint-url https://s3.gra.io.cloud.ovh.net \
  --region gra
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

| Region | Endpoint |
|--------|----------|
| Gravelines (France) | `https://s3.gra.io.cloud.ovh.net` |
| Strasbourg (France) | `https://s3.sbg.io.cloud.ovh.net` |
| Frankfurt (Germany) | `https://s3.de.io.cloud.ovh.net` |
| London (UK) | `https://s3.uk.io.cloud.ovh.net` |
| Beauharnois (Canada) | `https://s3.ca-east-1.io.cloud.ovh.net` |
| US East | `https://s3.us-east-1.io.cloud.ovh.net` |

## Migration from AWS S3

The migration is seamless since both use the same AWS SDK. Simply update:

1. **Environment variables** from AWS_* to OVH_*
2. **Endpoint URL** to OVHCloud regional endpoint
3. **Region** to your OVHCloud region

### Before (AWS S3)
```bash
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-bucket
```

### After (OVHCloud)
```bash
OVH_ACCESS_KEY_ID=xxx
OVH_SECRET_ACCESS_KEY=xxx
OVH_REGION=us-east-1
OVH_BUCKET_NAME=my-bucket
OVH_ENDPOINT=https://s3.us-east-1.io.cloud.ovh.net
```

## Testing

Test your OVHCloud integration:

```bash
# Install dependencies
pnpm install

# Test OVHCloud connection
pnpm test:ovh

# Upload test file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.pdf" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

1. **Access Denied**: Check OVHCloud credentials and bucket permissions
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
  endpoint: 'https://s3.gra.io.cloud.ovh.net',
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
- **Bandwidth**: No egress charges within OVHCloud
- **CDN**: Optional integration with OVHCloud CDN

## Cost

OVHCloud Object Storage pricing:
- Storage: €0.01/GB/month
- Outbound traffic: €0.01/GB
- API requests: €0.01 per 1,000 requests

## Production Checklist

- [ ] Valid OVHCloud credentials
- [ ] Correct regional endpoint
- [ ] Bucket created in correct region
- [ ] Environment variables configured
- [ ] Security groups/ACLs configured
- [ ] CORS settings for web access
- [ ] Bucket lifecycle policies
- [ ] Backup strategy implemented