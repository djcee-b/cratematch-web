const axios = require("axios");

// Simple Authentication Test
const CONFIG = {
  baseURL: process.env.BASE_URL || "http://128.199.1.245",
  testUser: {
    email: process.env.TEST_EMAIL || "loadtest@example.com",
    password: process.env.TEST_PASSWORD || "loadtest123",
  },
};

async function testAuthentication() {
  console.log("🔐 Testing Authentication");
  console.log("========================");
  console.log("Base URL:", CONFIG.baseURL);
  console.log("Test User:", CONFIG.testUser.email);
  console.log("---");

  const session = axios.create({
    baseURL: CONFIG.baseURL,
    timeout: 30000,
    validateStatus: () => true,
  });

  try {
    // Step 1: Try to sign in
    console.log("1. Testing sign in...");
    const signInResponse = await session.post("/auth/signin", CONFIG.testUser);
    console.log("   Status:", signInResponse.status);
    console.log("   Response:", signInResponse.data);

    if (signInResponse.data.session?.access_token) {
      console.log("   ✅ Sign in successful!");
      session.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${signInResponse.data.session.access_token}`;
    } else {
      console.log("   ❌ Sign in failed, trying sign up...");

      // Step 2: Try to sign up
      const signUpResponse = await session.post(
        "/auth/signup",
        CONFIG.testUser
      );
      console.log("   Status:", signUpResponse.status);
      console.log("   Response:", signUpResponse.data);

      if (signUpResponse.data.session?.access_token) {
        console.log("   ✅ Sign up successful!");
        session.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${signUpResponse.data.session.access_token}`;
      } else {
        console.log("   ❌ Both sign in and sign up failed");
        return;
      }
    }

    // Step 3: Test authenticated endpoints
    console.log("\n2. Testing authenticated endpoints...");

    const endpoints = [
      { name: "Auth Verify", path: "/api/auth/verify" },
      { name: "Databases", path: "/databases" },
      { name: "Scan History", path: "/api/scan-history" },
      { name: "User Profile", path: "/auth/me" },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await session.get(endpoint.path);
        console.log(
          `   ${endpoint.name}: ${response.status} - ${response.statusText}`
        );
        if (response.status !== 200) {
          console.log(`   Response:`, response.data);
        }
      } catch (error) {
        console.log(`   ${endpoint.name}: Error - ${error.message}`);
      }
    }

    // Step 4: Test database upload (should fail with 403 if not premium)
    console.log("\n3. Testing database upload...");
    try {
      const response = await session.post("/upload-database", {});
      console.log(
        `   Upload Database: ${response.status} - ${response.statusText}`
      );
      console.log(`   Response:`, response.data);
    } catch (error) {
      console.log(`   Upload Database: Error - ${error.message}`);
    }

    // Step 5: Test playlist processing (should fail with 403 if not premium)
    console.log("\n4. Testing playlist processing...");
    try {
      const response = await session.post("/process-playlist", {
        playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        threshold: 90,
        databaseFileName: "database-v2",
      });
      console.log(
        `   Process Playlist: ${response.status} - ${response.statusText}`
      );
      console.log(`   Response:`, response.data);
    } catch (error) {
      console.log(`   Process Playlist: Error - ${error.message}`);
    }

    console.log("\n✅ Authentication test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
if (require.main === module) {
  testAuthentication().catch(console.error);
}

module.exports = { testAuthentication };
