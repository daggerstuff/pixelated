import { betterAuth } from "better-auth";
import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

console.log("DATABASE_URL is set");

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err);
  } else {
    console.log('✅ PostgreSQL connected successfully');
  }
});

// Better-Auth configuration with proper database object
export const auth = betterAuth({
  database: {
    provider: "postgres",
    url: process.env.DATABASE_URL,
    connection: pool
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
});