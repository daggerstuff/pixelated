# AWS Deployment for Pixelated Astro App

This directory contains everything needed to deploy the Pixelated Astro application to AWS using Lambda, CloudFront, and S3.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   Lambda@Edge   │    │   S3 Static     │
│   Distribution  │────│   Functions     │────│   Assets        │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │              ┌─────────────────┐            │
         └──────────────│   API Gateway   │────────────┘
                        │   + Lambda      │
                        │   Functions     │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Route 53      │
                        │   DNS           │
                        └─────────────────┘
```

## Benefits over Vercel

1. **No 250MB Function Limit**: Lambda functions can be up to 10GB
2. **Separate Static Assets**: Static files served from S3 via CloudFront
3. **Better Cost Control**: Pay only for what you use
4. **Advanced CDN**: CloudFront with custom caching rules
5. **Lambda Layers**: Externalize heavy dependencies
6. **Auto-scaling**: No cold start limitations

## Prerequisites

1. **AWS CLI**: Install and configure with credentials
   ```bash
   aws configure
   ```

2. **AWS Account**: With CloudFormation deployment permissions

3. **Domain Name**: Must own domain for SSL certificate

4. **Node.js**: Version 22+ for Lambda runtime compatibility

## Quick Start

### 1. Set Environment Variables

```bash
export AWS_REGION="us-east-1"
export AWS_PROFILE="your-profile"
export DOMAIN_NAME="pixelatedempathy.com"
export STACK_NAME="pixelated-astro"
```

### 2. Deploy to AWS

```bash
# From project root
./scripts/deploy-aws.sh
```

The script will:
- Build the Astro app with AWS optimizations
- Create deployment package excluding heavy dependencies
- Upload to S3
- Deploy CloudFormation stack
- Set up CloudFront distribution
- Configure Route 53 DNS

### 3. Update DNS

After deployment, update your domain's nameservers to the Route 53 nameservers shown in the output.

## Configuration Files

### `astro.config.aws.mjs`
- AWS-optimized Astro configuration
- Uses `@astrojs/node` adapter in standalone mode
- Externalizes heavy dependencies for Lambda layers
- Optimized build settings for cold starts

### `cloudformation.yaml`
- Complete AWS infrastructure as code
- Lambda functions with proper IAM roles
- CloudFront distribution with custom cache policies
- S3 buckets for static assets
- Route 53 hosted zone and records
- SSL certificates via ACM

### `.awsignore`
- Excludes unnecessary files from Lambda deployment
- Reduces package size for faster cold starts
- Heavy dependencies marked for Lambda layers

## Manual Steps

### 1. SSL Certificate Validation

After first deployment, validate the SSL certificate:

1. Go to AWS Certificate Manager console
2. Find your certificate for `pixelatedempathy.com`
3. Add the CNAME record to your DNS

### 2. Lambda Layers (Optional)

For better performance, create Lambda layers for heavy dependencies:

```bash
# Create layer for TensorFlow (if needed)
mkdir -p lambda-layers/tensorflow/nodejs/node_modules
cd lambda-layers/tensorflow/nodejs
npm install @tensorflow/tfjs
zip -r ../tensorflow-layer.zip .

# Upload layer
aws lambda publish-layer-version \
  --layer-name tensorflow-layer \
  --zip-file fileb://tensorflow-layer.zip \
  --compatible-runtimes nodejs22.x
```

Then add the layer ARN to your Lambda function.

## Monitoring & Debugging

### CloudWatch Logs

```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/pixelated"

# Stream logs in real-time
aws logs tail /aws/lambda/pixelated-astro-astro-function --follow
```

### CloudWatch Metrics

The deployment includes alarms for:
- Lambda errors (>5 errors in 5 minutes)
- Lambda duration (>25 seconds average)

### X-Ray Tracing

X-Ray tracing is enabled for performance analysis:

```bash
# View traces
aws xray get-trace-summaries --time-range-type TimeRangeByStartTime \
  --start-time 2025-01-15T00:00:00Z \
  --end-time 2025-01-15T23:59:59Z
```

## Cost Optimization

### 1. Lambda Optimizations
- Memory: 1024MB (balance of performance vs. cost)
- Timeout: 30 seconds (sufficient for SSR)
- Provisioned Concurrency: Not enabled (reduce costs)

### 2. CloudFront Optimizations
- Price Class: 100 (US, Canada, Europe only)
- Compression: Enabled
- HTTP/2 & HTTP/3: Enabled

### 3. S3 Optimizations
- Standard storage class
- Lifecycle policies for old assets
- CloudFront caching reduces S3 requests

## Troubleshooting

### Build Failures

```bash
# Check build with AWS config
pnpm astro build --config astro.config.aws.mjs

# Verify dependencies
pnpm install @astrojs/node
```

### Deployment Failures

```bash
# Check CloudFormation stack events
aws cloudformation describe-stack-events --stack-name pixelated-astro

# Validate template
aws cloudformation validate-template --template-body file://deploy/aws/cloudformation.yaml
```

### Runtime Errors

```bash
# Check Lambda function logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/pixelated-astro-astro-function \
  --filter-pattern "ERROR"

# Test Lambda function locally
sam local start-api --template deploy/aws/cloudformation.yaml
```

### Large Bundle Size

If deployment package is still too large:

1. **Check bundle contents**:
   ```bash
   # Analyze bundle
   cd build-aws
   du -sh node_modules/* | sort -hr | head -20
   ```

2. **Create Lambda layers** for heavy dependencies
3. **Use external services** for ML/AI processing
4. **Optimize imports** to tree-shake unused code

### SSL Certificate Issues

```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Request new certificate manually
aws acm request-certificate \
  --domain-name pixelatedempathy.com \
  --subject-alternative-names www.pixelatedempathy.com \
  --validation-method DNS
```

## Environment Variables

Set these in the Lambda function environment:

```bash
NODE_ENV=production
AWS_DEPLOYMENT=1
STATIC_ASSETS_URL=https://your-cloudfront-domain.cloudfront.net
```

## Performance Benchmarks

Expected performance improvements over Vercel:

- **Cold Start**: ~2-3 seconds (vs. timeout issues)
- **Warm Start**: ~100-300ms
- **Static Assets**: ~20-50ms (CloudFront CDN)
- **API Routes**: ~200-500ms (Lambda)

## Scaling

The deployment auto-scales based on traffic:

- **Lambda Concurrency**: Up to 1000 concurrent executions
- **CloudFront**: Global edge locations
- **S3**: Unlimited storage and requests

## Security

Security features included:

- **WAF**: Web Application Firewall (optional add-on)
- **Security Headers**: HSTS, XSS Protection, Content-Type Options
- **IAM Roles**: Least privilege access
- **VPC**: Can be added for database connections
- **Encryption**: At rest and in transit

## Rollback

To rollback a deployment:

```bash
# Rollback CloudFormation stack
aws cloudformation cancel-update-stack --stack-name pixelated-astro

# Or deploy previous version
aws cloudformation deploy \
  --template-file deploy/aws/cloudformation.yaml \
  --stack-name pixelated-astro \
  --parameter-overrides DeploymentBucket=old-bucket-name
```

## Support

For issues with this deployment:

1. Check CloudFormation stack events
2. Review Lambda function logs
3. Verify IAM permissions
4. Test locally with SAM CLI

## Next Steps

After successful deployment:

1. Set up monitoring dashboards
2. Configure custom domain emails
3. Add WAF rules for security
4. Set up CI/CD pipeline
5. Optimize Lambda layers for better performance 