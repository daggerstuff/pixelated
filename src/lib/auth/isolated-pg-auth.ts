import { betterAuth } from "better-auth";

// Ultra-minimal Better-Auth configuration
export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
  },
});