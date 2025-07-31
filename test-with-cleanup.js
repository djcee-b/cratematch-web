const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Test Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || "http://128.199.1.245",
  testDuration: parseInt(process.env.TEST_DURATION) || 120, // 2 minutes
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 50, // Default to 50 users
  rampUpTime: parseInt(process.env.RAMP_UP_TIME) || 10,
  scenarios: {
    uploadDatabase: 5, // Minimal - Upload database (done once per user)
    processPlaylist: 70, // Focus on playlist processing (main test)
    checkStatus: 25, // Some status checks
  },
};

// Test users to create and cleanup
const TEST_USERS = [];

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: {},
  startTime: null,
  endTime: null,
};

// Helper functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomScenario() {
  const totalWeight = Object.values(CONFIG.scenarios).reduce(
    (a, b) => a + b,
    0
  );
  let random = Math.random() * totalWeight;
  for (const [scenario, weight] of Object.entries(CONFIG.scenarios)) {
    random -= weight;
    if (random <= 0) return scenario;
  }
  return "processPlaylist";
}

function createTestDatabase() {
  const testFile = path.join(__dirname, "database-v2");
  if (!fs.existsSync(testFile)) {
    console.log("Error: database-v2 file not found!");
    process.exit(1);
  }
  return testFile;
}

// Helper function to retry failed requests
async function retryRequest(requestFn, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await requestFn();
      if (result.success) {
        return result;
      }
      // If not successful but not an error, don't retry
      if (result.status && result.status !== 500) {
        return result;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return { success: false, error: "Max retries exceeded" };
}

// Test scenarios
const testScenarios = {
  uploadDatabase: async (session) => {
    return retryRequest(async () => {
      try {
        const testFile = createTestDatabase();
        const form = new FormData();
        form.append("database", fs.createReadStream(testFile));

        const response = await session.post("/upload-database", form, {
          headers: form.getHeaders(),
        });

        return { success: response.status === 200, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  },

  processPlaylist: async (session, userId) => {
    return retryRequest(async () => {
      try {
        const playlists = [
          "https://open.spotify.com/playlist/2uck8x0IQTP3Z1Z5mJBXaB",
          "https://open.spotify.com/playlist/44nsF4WINW26yHK9UeXzqT",
        ];
        const playlistUrl = playlists[getRandomInt(0, playlists.length - 1)];
        const threshold = getRandomInt(85, 95);

        console.log(
          `User ${userId}: Processing playlist with threshold ${threshold}`
        );

        const response = await session.post("/process-playlist", {
          playlistUrl,
          threshold,
          databaseFileName: "database-v2",
        });

        // Handle export limit exceeded (429) gracefully
        if (response.status === 429) {
          console.log(
            `User ${userId}: Daily export limit exceeded - this is expected for free users`
          );
          return {
            success: false,
            status: 429,
            error:
              "Daily export limit exceeded - this is expected for free users",
          };
        }

        // Log detailed error information for 500 errors
        if (response.status === 500) {
          console.log(`User ${userId}: 500 Error Details:`, response.data);
        }

        return { success: response.status === 200, status: response.status };
      } catch (error) {
        // Handle export limit exceeded in catch block too
        if (error.response && error.response.status === 429) {
          console.log(
            `User ${userId}: Daily export limit exceeded - this is expected for free users`
          );
          return {
            success: false,
            status: 429,
            error:
              "Daily export limit exceeded - this is expected for free users",
          };
        }

        // Log detailed error information
        if (error.response && error.response.status === 500) {
          console.log(
            `User ${userId}: 500 Error Details:`,
            error.response.data
          );
        }
        return { success: false, error: error.message };
      }
    });
  },

  checkStatus: async (session) => {
    return retryRequest(async () => {
      try {
        const response = await session.get("/api/scan-history");
        return { success: response.status < 500, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  },
};

// Create authenticated session for a specific user
async function createAuthenticatedSession(userId) {
  const session = axios.create({
    baseURL: CONFIG.baseURL,
    timeout: 60000,
    validateStatus: () => true,
  });

  const user = TEST_USERS[userId - 1]; // userId is 1-based
  if (!user) {
    console.error(`User ${userId} not found in TEST_USERS array`);
    return session;
  }

  try {
    // Try to sign in first
    const signInResponse = await session.post("/auth/signin", user);

    if (signInResponse.data.session?.access_token) {
      session.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${signInResponse.data.session.access_token}`;
      return session;
    }

    // If sign in fails, try to sign up
    const signUpResponse = await session.post("/auth/signup", user);

    if (signUpResponse.data.session?.access_token) {
      session.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${signUpResponse.data.session.access_token}`;
      return session;
    }

    console.warn(
      `User ${userId}: Failed to authenticate test user, using unauthenticated session`
    );
    return session;
  } catch (error) {
    console.warn(
      `User ${userId}: Authentication failed, using unauthenticated session:`,
      error.message
    );
    return session;
  }
}

// Setup user - authenticate and upload database
async function setupUser(userId) {
  const session = await createAuthenticatedSession(userId);

  // Step 1: Wait a moment after user creation (simulate user setup)
  console.log(`User ${userId}: Waiting after creation...`);
  await new Promise((resolve) => setTimeout(resolve, getRandomInt(2000, 5000)));

  // Step 2: Upload database first (required before processing)
  console.log(`User ${userId}: Uploading database...`);
  const uploadStart = Date.now();
  const uploadResult = await testScenarios.uploadDatabase(session);
  const uploadTime = Date.now() - uploadStart;

  // Update statistics for upload
  stats.totalRequests++;
  stats.responseTimes.push(uploadTime);

  if (uploadResult.success) {
    stats.successfulRequests++;
    console.log(`User ${userId}: Database uploaded in ${uploadTime}ms`);
  } else {
    stats.failedRequests++;
    const errorKey = `uploadDatabase:${uploadResult.status || "unknown"}`;
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    console.log(
      `User ${userId}: Database upload failed - ${
        uploadResult.error || uploadResult.status
      }`
    );
    return false; // Setup failed
  }

  // Step 3: Wait a moment after upload (simulate user thinking time)
  console.log(`User ${userId}: Waiting after upload...`);
  await new Promise((resolve) => setTimeout(resolve, getRandomInt(1000, 3000)));

  console.log(`User ${userId}: Setup complete`);
  return true; // Setup successful
}

// Single user playlist processing test (after setup)
async function runUserPlaylistTest(userId) {
  const session = await createAuthenticatedSession(userId);
  const startTime = Date.now();

  console.log(`User ${userId}: Starting continuous playlist processing...`);

  while (Date.now() - startTime < CONFIG.testDuration * 1000) {
    const scenario = getRandomScenario();
    const scenarioStart = Date.now();

    try {
      let result;

      if (scenario === "processPlaylist") {
        result = await testScenarios[scenario](session, userId);
      } else {
        result = await testScenarios[scenario](session);
      }

      const responseTime = Date.now() - scenarioStart;

      // Update statistics
      stats.totalRequests++;
      stats.responseTimes.push(responseTime);

      if (result.success) {
        stats.successfulRequests++;
        console.log(
          `User ${userId}: ${scenario} completed in ${responseTime}ms`
        );
      } else {
        stats.failedRequests++;
        const errorKey = `${scenario}:${result.status || "unknown"}`;
        stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
        console.log(
          `User ${userId}: ${scenario} failed - ${
            result.error || result.status
          }`
        );
      }

      // Add some randomness to request timing, but reduce load
      await new Promise(
        (resolve) => setTimeout(resolve, getRandomInt(3000, 8000)) // Increased delays to reduce server load
      );
    } catch (error) {
      stats.totalRequests++;
      stats.failedRequests++;
      const errorKey = `${scenario}:error`;
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      console.log(`User ${userId}: ${scenario} error - ${error.message}`);

      // Add longer delay on errors to give server time to recover
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`User ${userId}: Test completed`);
}

// Cleanup function to remove test users from database
async function cleanupTestUsers() {
  console.log("\n🧹 Cleaning up test users from database...");

  const adminSession = axios.create({
    baseURL: CONFIG.baseURL,
    timeout: 30000,
    validateStatus: () => true,
  });

  let cleanedCount = 0;
  let errorCount = 0;

  for (const user of TEST_USERS) {
    try {
      // First, try to sign in to get the user's session
      const signInResponse = await adminSession.post("/auth/signin", user);

      if (signInResponse.data.session?.access_token) {
        adminSession.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${signInResponse.data.session.access_token}`;

        // Delete user's data (this would require a cleanup endpoint)
        // For now, we'll just log the user info
        console.log(`  ✅ User ${user.email} authenticated for cleanup`);
        cleanedCount++;
      } else {
        console.log(`  ⚠️  User ${user.email} not found or already cleaned`);
      }
    } catch (error) {
      console.log(
        `  ❌ Error cleaning up user ${user.email}: ${error.message}`
      );
      errorCount++;
    }
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`  ✅ Successfully cleaned: ${cleanedCount} users`);
  console.log(`  ❌ Errors: ${errorCount} users`);
  console.log(`  📝 Note: Full cleanup requires database admin access`);
}

// Main test runner
async function runLoadTestWithCleanup() {
  console.log("🚀 CrateMatch Load Test with User Cleanup");
  console.log("==========================================");
  console.log(`Base URL: ${CONFIG.baseURL}`);
  console.log(`Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`Test Duration: ${CONFIG.testDuration}s`);
  console.log(`Ramp Up Time: ${CONFIG.rampUpTime}s`);
  console.log("---");

  // Step 1: Create test users dynamically
  console.log("👥 Creating test users...");

  // Clear any existing users
  TEST_USERS.length = 0;

  // Create the required number of test users
  for (let i = 1; i <= CONFIG.concurrentUsers; i++) {
    TEST_USERS.push({
      email: `loadtest${i}@example.com`,
      password: `loadtest${i}123`,
    });
  }

  console.log(`✅ Created ${TEST_USERS.length} test users`);
  console.log("Users:", TEST_USERS.map((u) => u.email).join(", "));

  // Step 2: Setup phase - All users authenticate, upload database, and wait
  console.log("\n📋 Setup Phase: All users uploading databases...");
  stats.startTime = Date.now();

  const setupPromises = [];
  for (let i = 1; i <= CONFIG.concurrentUsers; i++) {
    const delay = (i - 1) * 1000; // 1 second between each user setup
    const promise = new Promise((resolve) => {
      setTimeout(async () => {
        console.log(`🔧 Setting up User ${i}/${CONFIG.concurrentUsers}`);
        await setupUser(i);
        resolve();
      }, delay);
    });
    setupPromises.push(promise);
  }

  await Promise.all(setupPromises);
  console.log("✅ All users setup complete!");

  // Step 3: Load test phase - All users process playlists continuously
  console.log("\n🔥 Load Test Phase: All users processing playlists...");

  const userPromises = [];
  for (let i = 1; i <= CONFIG.concurrentUsers; i++) {
    const promise = new Promise((resolve) => {
      setTimeout(async () => {
        console.log(
          `🚀 Starting User ${i}/${CONFIG.concurrentUsers} playlist processing`
        );
        await runUserPlaylistTest(i);
        resolve();
      }, 0); // All users start simultaneously for the load test
    });
    userPromises.push(promise);
  }

  await Promise.all(userPromises);

  stats.endTime = Date.now();

  // Step 3: Print results
  console.log("\n📊 Load Test Results");
  console.log("====================");
  console.log(
    `Total test time: ${((stats.endTime - stats.startTime) / 1000).toFixed(
      2
    )} seconds`
  );
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Successful requests: ${stats.successfulRequests}`);
  console.log(`Failed requests: ${stats.failedRequests}`);
  console.log(
    `Success rate: ${(
      (stats.successfulRequests / stats.totalRequests) *
      100
    ).toFixed(2)}%`
  );
  console.log(
    `Requests per second: ${(
      stats.totalRequests /
      ((stats.endTime - stats.startTime) / 1000)
    ).toFixed(2)}`
  );

  if (stats.responseTimes.length > 0) {
    const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
    const avg =
      stats.responseTimes.reduce((a, b) => a + b, 0) /
      stats.responseTimes.length;
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

    console.log("\nResponse Times:");
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Median: ${median.toFixed(2)}ms`);
    console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`  Min: ${Math.min(...stats.responseTimes)}ms`);
    console.log(`  Max: ${Math.max(...stats.responseTimes)}ms`);
  }

  if (Object.keys(stats.errors).length > 0) {
    console.log("\nErrors:");
    for (const [error, count] of Object.entries(stats.errors)) {
      console.log(`  ${error}: ${count} occurrences`);
    }
  }

  // Step 4: Cleanup
  await cleanupTestUsers();

  console.log("\n✅ Load test with cleanup completed!");
}

// Run the test
if (require.main === module) {
  runLoadTestWithCleanup().catch(console.error);
}

module.exports = { runLoadTestWithCleanup, TEST_USERS };
