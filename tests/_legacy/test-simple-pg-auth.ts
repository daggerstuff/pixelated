import { auth } from "./src/lib/auth/simple-pg-auth";

async function testSimpleAuth() {
  try {
    console.log("🚀 Testing Simple Better-Auth PostgreSQL Integration");

    // Test user creation
    console.log("\n📝 Creating test user...");
    const user = await auth.api.signUpEmail({
      body: {
        email: "simpletest@example.com",
        password: "SecurePassword123!",
        name: "Simple Test User",
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
        email: "simpletest@example.com",
        password: "SecurePassword123!",
      },
    });

    if (!session) {
      throw new Error("Failed to authenticate user");
    }

    console.log("✅ User authenticated successfully!");
    console.log("Session ID:", session.session.id);

    console.log("\n🎉 Simple auth test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testSimpleAuth();