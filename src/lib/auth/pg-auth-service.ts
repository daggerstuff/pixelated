import { betterAuth } from "better-auth";
import { kyselyAdapter } from "better-auth/adapters/kysely";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Kysely instance
const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: pool,
  }),
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err);
  } else {
    console.log('✅ PostgreSQL connected successfully');
  }
});

// Better-Auth configuration
export const auth = betterAuth({
  database: kyselyAdapter(db, {
    provider: "postgres",
    schema: {
      user: "users",
      session: "auth_sessions",
      account: "auth_accounts",
    },
  }),
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
  user: {
    modelName: "users",
  },
  session: {
    modelName: "auth_sessions",
  },
});

// Export types
export type BetterAuthClient = typeof auth;