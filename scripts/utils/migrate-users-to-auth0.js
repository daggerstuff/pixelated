#!/usr/bin/env node

/**
 * Script to migrate users from MongoDB to Auth0
 *
 * This script exports users from the current MongoDB database in a format
 * that can be imported into Auth0 using the Auth0 Management API.
 */

import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // MongoDB connection
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  DB_NAME: process.env.MONGODB_DB_NAME || 'pixelated_empathy',

  // Output file
  OUTPUT_FILE: path.join(__dirname, 'auth0-users-export.json'),

  // Batch size for processing
  BATCH_SIZE: 1000
};

/**
 * Build MongoDB URI from environment variables
 */
function buildMongoDBUri() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    return mongoUri;
  }

  // Build URI from components for MongoDB Atlas
  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;
  const cluster = process.env.MONGODB_CLUSTER;

  if (username && password && cluster) {
    return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/?retryWrites=true&w=majority`;
  }

  // Fallback to localhost for development
  return 'mongodb://localhost:27017';
}

/**
 * Transform user data for Auth0 import
 * @param {Object} user - MongoDB user document
 * @returns {Object} Auth0 user object
 */
function transformUserForAuth0(user) {
  // Map roles to Auth0 roles
  const auth0Roles = [];
  switch (user.role) {
    case 'admin':
      auth0Roles.push('Admin');
      break;
    case 'therapist':
      auth0Roles.push('Therapist');
      break;
    case 'user':
    default:
      auth0Roles.push('User');
      break;
  }

  // Create Auth0 user object
  const auth0User = {
    email: user.email,
    email_verified: user.emailVerified || false,
    // Note: Passwords will need to be reset by users
    // Auth0 requires a temporary password for import
    password: 'TempPass123!', // Users will need to reset this
    connection: 'Username-Password-Authentication',
    user_metadata: {
      role: user.role,
      created_at: user.createdAt,
      last_login: user.lastLogin,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      preferences: user.preferences
    },
    app_metadata: {
      roles: auth0Roles,
      imported_from: 'mongodb'
    }
  };

  // Add custom fields if they exist
  if (user.profile) {
    auth0User.user_metadata.profile = user.profile;
  }

  return auth0User;
}

/**
 * Export users from MongoDB
 */
async function exportUsers() {
  console.log('Starting user export from MongoDB...');

  let client;
  try {
    // Connect to MongoDB
    const mongoUri = buildMongoDBUri();
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log(`Connected to MongoDB at ${mongoUri}`);

    const db = client.db(CONFIG.DB_NAME);
    const usersCollection = db.collection('users');

    // Get total count
    const totalCount = await usersCollection.countDocuments();
    console.log(`Found ${totalCount} users to export`);

    // Export users in batches
    const users = [];
    let processedCount = 0;

    const cursor = usersCollection.find({}, { batchSize: CONFIG.BATCH_SIZE });

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (user) {
        const auth0User = transformUserForAuth0(user);
        users.push(auth0User);
        processedCount++;

        if (processedCount % CONFIG.BATCH_SIZE === 0) {
          console.log(`Processed ${processedCount}/${totalCount} users`);
        }
      }
    }

    // Save to file
    console.log(`Exported ${users.length} users. Saving to ${CONFIG.OUTPUT_FILE}`);
    await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(users, null, 2));
    console.log('Export completed successfully!');

    // Print summary
    console.log('\nExport Summary:');
    console.log(`- Total users exported: ${users.length}`);
    console.log(`- Output file: ${CONFIG.OUTPUT_FILE}`);
    console.log(`- Import format: Auth0 Bulk User Import JSON`);
    console.log('\nNext steps:');
    console.log('1. Review the exported file');
    console.log('2. Use the Auth0 Dashboard or Management API to import users');
    console.log('3. Notify users to reset their passwords');

    return users;
  } catch (error) {
    console.error('Error during user export:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Auth0 User Migration Script');
    console.log('==========================');

    // Check if required environment variables are set
    const requiredEnvVars = ['MONGODB_URI', 'MONGODB_DB_NAME'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
      console.warn('Warning: The following environment variables are not set:');
      missingEnvVars.forEach(envVar => console.warn(`- ${envVar}`));
      console.warn('Using default values where possible.');
    }

    // Export users
    await exportUsers();

    console.log('\n✅ User export completed successfully!');
    console.log(`📁 Export file saved to: ${CONFIG.OUTPUT_FILE}`);
  } catch (error) {
    console.error('❌ User export failed:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { exportUsers, transformUserForAuth0 };