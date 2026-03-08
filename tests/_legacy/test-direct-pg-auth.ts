import { auth } from "./src/lib/auth/direct-pg-auth";

async function testDirectAuth() {
  try {
    console.log("🚀 Testing Direct Better-Auth PostgreSQL Integration");

    // Test user creation
    console.log("\n📝 Creating test user...");
    const user = await auth.api.signUpEmail({
      body: {
        email: "directtest@example.com",
        password: "SecurePassword123!",
        name: "Direct Test User",
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
        email: "directtest@example.com",
        password: "SecurePassword123!",
      },
    });

    if (!session) {
      throw new Error("Failed to authenticate user");
    }

    console.log("✅ User authenticated successfully!");
    console.log("Session ID:", session.session.id);

    console.log("\n🎉 Direct auth test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testDirectAuth();