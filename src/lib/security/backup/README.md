# Backup Storage Providers

This module provides interfaces and implementations for storage providers used by the backup security system to store and retrieve encrypted backups.

## Overview

The backup system supports various storage providers:

1. **Local File System Storage** - Stores backups on the local file system
2. **In-Memory Storage** - Stores backups in memory (for testing only)
3. **AWS S3 Storage** - Stores backups in Amazon S3
4. **Google Cloud Storage** - Stores backups in Google Cloud Storage
5. **Azure Blob Storage** - Stores backups in Azure Blob Storage
6. **Mock Cloud Storage** - Simulates cloud storage behavior with local files (for development)

## Cloud Provider Dependencies

The cloud storage providers use dynamic imports to avoid requiring their dependencies for all users. You need to install the appropriate packages depending on which storage provider you plan to use:

### AWS S3
```
pnpm add @aws-sdk/client-s3
```

### Google Cloud Storage
```
pnpm add @google-cloud/storage
```

### Azure Blob Storage
```
pnpm add @azure/storage-blob
```

## Usage

Import the `getStorageProvider` function to create an instance of a storage provider:

```typescript
import { getStorageProvider } from './storage-providers';

// Create a File System Storage Provider
const fileStorage = getStorageProvider('file', {
  basePath: '/path/to/backups'
});

// Create an S3 Storage Provider
const s3Storage = getStorageProvider('aws-s3', {
  bucket: 'my-backup-bucket',
  region: 'us-east-1',
  prefix: 'backups/'
});

// Create a Google Cloud Storage Provider
const gcsStorage = getStorageProvider('google-cloud-storage', {
  bucketName: 'my-backup-bucket',
  prefix: 'backups/',
  keyFilename: '/path/to/service-account-key.json'
});

// Create an Azure Blob Storage Provider
const azureStorage = getStorageProvider('azure-blob-storage', {
  containerName: 'my-backup-container',
  connectionString: 'DefaultEndpointsProtocol=https;AccountName=...'
});

// For development/testing, you can use the mock providers
const mockS3Storage = getStorageProvider('mock-aws', {
  bucket: 'mock-s3-bucket'
});
```

## Configuration Options

### File System Storage
- `basePath`: The base directory path where backups will be stored

### In-Memory Storage
- No configuration required

### AWS S3 Storage
- `bucket`: S3 bucket name (required)
- `region`: AWS region (default: 'us-east-1')
- `prefix`: Key prefix for stored files (default: '')
- `endpoint`: Custom endpoint URL for S3-compatible services
- `credentials`: AWS credentials object with `accessKeyId` and `secretAccessKey`

### Google Cloud Storage
- `bucketName`: GCS bucket name (required)
- `prefix`: Object prefix for stored files (default: '')
- `keyFilename`: Path to service account key file
- `credentials`: GCP credentials object

### Azure Blob Storage
- `containerName`: Azure Storage container name (required)
- `prefix`: Blob prefix for stored files (default: '')
- `connectionString`: Azure Storage connection string, or
- `accountName` and `accountKey`: Azure Storage account credentials

### Mock Cloud Storage
- `bucket`: Mock bucket name
- `basePath`: Local directory for mock storage (default: 'data/mock-cloud')
