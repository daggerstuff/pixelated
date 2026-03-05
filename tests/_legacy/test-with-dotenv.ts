import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import { auth } from "./src/lib/auth/working-pg-auth-final";

async function testWithDotenv() {
  try {
    console.log("🚀 Testing With Dotenv");

    // Test user creation
    console.log("\n📝 Creating test user...");
    const user = await auth.api.signUpEmail({
      body: {
        email: "dotenvtest@example.com",
        password: "SecurePassword123!",
        name: "Dotenv Test User",
      },
    });

    if (!user) {
      throw new Error("Failed to create user");
    }

    console.log("✅ User created successfully!");
    console.log("User ID:", user.user.id);

    console.log("\n🎉 Dotenv test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testWithDotenv();