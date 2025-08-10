# MongoDB Atlas Migration Guide

This document provides a comprehensive guide for migrating from Supabase to MongoDB Atlas in the Pixelated Empathy project.

## 🎯 Overview

The migration from Supabase to MongoDB Atlas provides several benefits:

- **Better Performance**: MongoDB's document-based structure is ideal for our JSON-heavy data
- **Scalability**: MongoDB Atlas provides auto-scaling capabilities
- **Cost Efficiency**: More predictable pricing model
- **Flexibility**: Schema-less design allows for easier iteration
- **Integration**: Better integration with our existing Node.js stack

## 🚀 Quick Start

### 1. Run the Migration Script

```bash
./scripts/migrate-to-mongodb-atlas.sh
```

This script will:
- Check MongoDB Atlas environment variables
- Test database connection
- Remove Supabase dependencies
- Install MongoDB dependencies
- Create environment file template
- Update TypeScript types

### 2. Configure Environment Variables

Create or update your `.env` file with MongoDB Atlas credentials:

```bash
# Option 1: Full connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Option 2: Individual components (script will build URI)
MONGODB_USERNAME=your_username
MONGODB_PASSWORD=your_password
MONGODB_CLUSTER=your_cluster.mongodb.net

# Database name
MONGODB_DB_NAME=pixelated_empathy

# JWT Authentication (replaces Supabase Auth)
JWT_SECRET=your_secure_jwt_secret_key
JWT_EXPIRES_IN=24h
```

### 3. Set up MongoDB Atlas Cluster

1. **Create MongoDB Atlas Account**: Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Create Cluster**: Choose your preferred region and tier
3. **Configure Network Access**: Add your IP addresses to the whitelist
4. **Create Database User**: Set up authentication credentials
5. **Get Connection String**: Copy the connection string from Atlas dashboard

## 📊 Database Schema Migration

### Collections Structure

The new MongoDB schema includes these collections:

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User accounts | `email`, `name`, `azure_id`, `role` |
| `profiles` | User profiles | `userId`, `fullName`, `preferences` |
| `sessions` | Authentication sessions | `userId`, `accessToken`, `expiresAt` |
| `conversations` | Chat conversations | `userId`, `messages`, `isActive` |
| `security_events` | Security audit logs | `userId`, `eventType`, `severity` |
| `ai_metrics` | AI usage metrics | `model`, `requestCount`, `totalTokens` |
| `user_settings` | User preferences | `userId`, `preferences`, `notificationSettings` |
| `crisis_detection` | Crisis detection results | `userId`, `crisisDetected`, `riskLevel` |
| `consent_management` | GDPR consent tracking | `userId`, `consentType`, `granted` |
| `audit_logs` | System audit logs | `action`, `resource`, `success` |

### Data Migration

If you have existing data in Supabase, you'll need to migrate it:

1. **Export from Supabase**:
   ```bash
   # Export using Supabase CLI
   supabase db dump --data-only > supabase_data.sql
   ```

2. **Transform Data**:
   - Convert PostgreSQL schema to MongoDB documents
   - Handle relationship mapping (foreign keys → embedded documents or references)
   - Update data types (UUID → ObjectId, timestamps, etc.)

3. **Import to MongoDB**:
   ```bash
   # Use the seeding script
   node scripts/mongodb-seed.js
   ```

## 🔧 Code Changes

### Key Files Updated

- ✅ `src/lib/db/ai/types.ts` - Updated import from Supabase types to JSON types
- ✅ `src/config/env.config.ts` - Added MongoDB environment variables
- ✅ `src/env.d.ts` - Updated environment interface
- ✅ `src/types/environment.ts` - Added MongoDB types
- ✅ `src/types/utility.ts` - Updated utility types
- ✅ `src/config/mongodb.config.ts` - Enhanced MongoDB configuration
- ✅ `src/lib/mongodb.types.ts` - New MongoDB type definitions
- ✅ Documentation files - Updated references

### Authentication Changes

- **Before (Supabase)**:
  ```typescript
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  ```

- **After (MongoDB + JWT)**:
  ```typescript
  const session = await mongoAuthService.signIn(email, password)
  ```

### Database Queries

- **Before (Supabase)**:
  ```typescript
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
  ```

- **After (MongoDB)**:
  ```typescript
  const db = await mongodb.connect()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  ```

## 🔒 Security Considerations

### Authentication
- JWT tokens replace Supabase Auth tokens
- Azure AD integration maintained for SSO
- Session management handled by MongoDB

### Data Protection
- MongoDB Atlas encryption at rest and in transit
- Network access controls via IP whitelisting
- Database user authentication
- Audit logging maintained

### Environment Variables
- Remove all `SUPABASE_*` environment variables
- Add `MONGODB_*` and `JWT_*` variables
- Update CI/CD pipelines with new secrets

## 🧪 Testing

### Database Connection Test
```bash
# Test MongoDB connection
node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);
client.connect().then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  client.close();
}).catch(err => {
  console.error('❌ Connection failed:', err);
});
"
```

### Application Testing
```bash
# Run application tests
npm test

# Run type checking
npm run typecheck

# Start development server
npm run dev
```

## 📈 Performance Optimization

### Indexing Strategy
```javascript
// Create indexes for better query performance
db.users.createIndex({ email: 1 }, { unique: true })
db.conversations.createIndex({ userId: 1, createdAt: -1 })
db.security_events.createIndex({ userId: 1, eventType: 1 })
db.ai_metrics.createIndex({ timestamp: -1, model: 1 })
```

### Connection Pooling
The MongoDB configuration includes optimized connection pool settings:
- Max pool size: 10 connections
- Min pool size: 2 connections
- Connection timeout: 10 seconds
- Idle timeout: 30 seconds

## 🚨 Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check network access settings in MongoDB Atlas
   - Verify IP whitelist includes your current IP
   - Ensure connection string is correct

2. **Authentication Failed**
   - Verify username/password in MongoDB Atlas
   - Check if database user has correct permissions
   - Ensure connection string includes credentials

3. **Database Not Found**
   - Verify `MONGODB_DB_NAME` environment variable
   - Check if database exists in Atlas cluster
   - Run seeding script to create collections

4. **Type Errors**
   - Update imports from Supabase types to MongoDB types
   - Use `ObjectId` instead of string IDs where needed
   - Handle optional fields properly

### Logging and Monitoring

Enable debug logging:
```bash
# MongoDB driver logging
DEBUG=mongodb:* node your-app.js

# Application logging
LOG_LEVEL=debug npm start
```

Monitor in MongoDB Atlas:
- Real-time performance metrics
- Query performance insights
- Index usage statistics
- Connection metrics

## 📚 Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
- [MongoDB Atlas Security](https://docs.atlas.mongodb.com/security/)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)

## 🆘 Support

If you encounter issues during migration:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review MongoDB Atlas logs in the web console
3. Check application logs for specific error messages
4. Ensure all environment variables are properly configured

---

**Note**: This migration represents a significant architectural change. Test thoroughly in a development environment before deploying to production.
