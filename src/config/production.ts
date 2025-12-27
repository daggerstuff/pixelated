export const productionConfig = {
  // Server Configuration
  port: process.env.PORT || 3000,
  environment: 'production',

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || '',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
    ssl: {
      rejectUnauthorized: false,
    },
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || '',
    tls: {
      rejectUnauthorized: false,
    },
  },

  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || 'pixelated-business-docs',
    cloudfrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN || '',
  },

  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    fromEmail: process.env.FROM_EMAIL || 'noreply@pixelated.com',
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiration: process.env.JWT_EXPIRATION || '7d',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '30d',
    bcryptRounds: 12,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },

  // Monitoring Configuration
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: 'production',
    },
    datadog: {
      apiKey: process.env.DD_API_KEY || '',
      appKey: process.env.DD_APP_KEY || '',
    },
  },

  // CORS Configuration
  cors: {
    origin: [
      'https://pixelated.com',
      'https://www.pixelated.com',
      ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
    ],
    credentials: true,
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
  },

  // Cache Configuration
  cache: {
    ttl: 3600, // 1 hour
    redis: {
      ttl: 7200, // 2 hours
    },
  },

  // API Configuration
  api: {
    version: 'v1',
    timeout: 30000, // 30 seconds
    retries: 3,
  },
}
