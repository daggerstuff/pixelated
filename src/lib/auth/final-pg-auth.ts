import { betterAuth } from "better-auth";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Better-Auth configuration with explicit table names
export const auth = betterAuth({
  database: {
    provider: "postgres",
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    modelName: "users",
  },
  session: {
    modelName: "auth_sessions",
  },
  account: {
    modelName: "auth_accounts",
  },
});