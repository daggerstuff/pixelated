import { betterAuth } from "better-auth";
import { kyselyAdapter } from "better-auth/adapters/kysely";
import { Kysely, PostgresDialect } from "kysely";
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

// Create Kysely instance
const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: pool,
  }),
});

// Better-Auth configuration with explicit Kysely adapter
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
});