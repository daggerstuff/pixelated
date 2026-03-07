export const config = {
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  apiPrefix: process.env['API_PREFIX'] || '/api/v1',
  jwtSecret: process.env['JWT_SECRET'] || 'your-secret-key',
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret',
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
  jwtRefreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
  rateLimitWindowMs: parseInt(
    process.env['RATE_LIMIT_WINDOW_MS'] || '900000',
    10,
  ),
  rateLimitMaxRequests: parseInt(
    process.env['RATE_LIMIT_MAX_REQUESTS'] || '100',
    10,
  ),
  maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10),
  uploadPath: process.env['UPLOAD_PATH'] || './uploads',

  // Feature flags
  enableRealTimeCollaboration:
    process.env['ENABLE_REAL_TIME_COLLABORATION'] === 'true',
  enableWorkflowApproval: process.env['ENABLE_WORKFLOW_APPROVAL'] === 'true',
  enableAnalytics: process.env['ENABLE_ANALYTICS'] === 'true',
  enableExport: process.env['ENABLE_EXPORT'] === 'true',
}
