import { betterAuth } from "better-auth";

// Simple Better-Auth configuration with minimal settings
export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
  },
});