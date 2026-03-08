import { auth } from "./src/lib/auth/correct-pg-auth";

async function testCorrectAuth() {
  try {
    console.log("🚀 Testing Correct Better-Auth PostgreSQL Integration");

    // Test user creation
    console.log("\n📝 Creating test user...");
    const user = await auth.api.signUpEmail({
      body: {
        email: "correcttest@example.com",
        password: "SecurePassword123!",
        name: "Correct Test User",
      },
    });

    if (!user) {
      throw new Error("Failed to create user");
    }

    console.log("✅ User created successfully!");
    console.log("User ID:", user.user.id);

    // Test user authentication
    console.log("\n🔐 Authenticating user...");
    const session = await auth.api.signInEmail({
      body: {
        email: "correcttest@example.com",
        password: "SecurePassword123!",
      },
    });

    if (!session) {
      throw new Error("Failed to authenticate user");
    }

    console.log("✅ User authenticated successfully!");
    console.log("Session ID:", session.session.id);

    console.log("\n🎉 Correct auth test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testCorrectAuth();