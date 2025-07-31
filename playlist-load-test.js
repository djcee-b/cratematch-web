const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Playlist Processing Load Test Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || "http://128.199.1.245",
  testDuration: parseInt(process.env.TEST_DURATION) || 120, // 2 minutes
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 5, // Start with 5 users
  rampUpTime: parseInt(process.env.RAMP_UP_TIME) || 10, // seconds
  testUser: {
    email: process.env.TEST_EMAIL || "loadtest@example.com",
    password: process.env.TEST_PASSWORD || "loadtest123",
  },
  // Focus on playlist processing scenarios
  scenarios: {
    uploadDatabase: 20, // 20% - Upload database
    processPlaylist: 60, // 60% - Process playlist (heavy operation)
    checkStatus: 20, // 20% - Check processing status
  },
};

// Test data - Multiple playlist URLs for variety
const TEST_PLAYLISTS = [
  "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
  "https://open.spotify.com/playlist/37i9dQZF1DX5Ejj0EkURtP", // All Out 2010s
  "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6", // Chill Hits
  "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", // RapCaviar
  "https://open.spotify.com/playlist/37i9dQZF1DX5Vy6DFOcx00", // Alternative Rock
];

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: {},
  processingJobs: new Map(), // Track ongoing playlist processing
  startTime: null,
  endTime: null,
};

// Helper function to create a test database file
function createTestDatabase() {
  const testFile = path.join(__dirname, "database-v2");
  if (!fs.existsSync(testFile)) {
    console.log("Error: database-v2 file not found!");
    console.log(
      "Please ensure the database-v2 file is in the project root directory."
    );
    process.exit(1);
  }
  console.log("Using existing database-v2 file for testing");
  return testFile;
}

// Helper function to get random number within range
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to get weighted random scenario
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
  return "processPlaylist"; // fallback
}

// Helper function to get random playlist
function getRandomPlaylist() {
  return TEST_PLAYLISTS[getRandomInt(0, TEST_PLAYLISTS.length - 1)];
}

// Test scenarios focused on playlist processing
const testScenarios = {
  // Upload database (required before processing)
  uploadDatabase: async (session) => {
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
  },

  // Process playlist (the heavy operation)
  processPlaylist: async (session, userId) => {
    try {
      const playlistUrl = getRandomPlaylist();
      const threshold = getRandomInt(85, 95);

      console.log(
        `User ${userId}: Processing playlist with threshold ${threshold}`
      );

      const response = await session.post("/process-playlist", {
        playlistUrl: playlistUrl,
        threshold: threshold,
        databaseFileName: "database-v2",
      });

      if (response.status === 200) {
        // Track this processing job
        const jobId = `${userId}-${Date.now()}`;
        stats.processingJobs.set(jobId, {
          userId,
          playlistUrl,
          startTime: Date.now(),
          status: "processing",
        });

        // Clean up old jobs after 5 minutes
        setTimeout(() => {
          stats.processingJobs.delete(jobId);
        }, 5 * 60 * 1000);
      }

      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Check processing status
  checkStatus: async (session) => {
    try {
      // Check various status endpoints
      const endpoints = ["/api/auth/verify", "/databases", "/api/scan-history"];

      const endpoint = endpoints[getRandomInt(0, endpoints.length - 1)];
      const response = await session.get(endpoint);

      return { success: response.status < 500, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// Create authenticated session
async function createAuthenticatedSession() {
  const session = axios.create({
    baseURL: CONFIG.baseURL,
    timeout: 60000, // 60 second timeout for playlist processing
    validateStatus: () => true, // Don't throw on any status code
  });

  try {
    // Try to sign in first
    const signInResponse = await session.post("/auth/signin", CONFIG.testUser);

    if (signInResponse.data.session?.access_token) {
      session.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${signInResponse.data.session.access_token}`;
      return session;
    }

    // If sign in fails, try to sign up
    const signUpResponse = await session.post("/auth/signup", CONFIG.testUser);

    if (signUpResponse.data.session?.access_token) {
      session.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${signUpResponse.data.session.access_token}`;
      return session;
    }

    console.warn(
      "Failed to authenticate test user, using unauthenticated session"
    );
    return session;
  } catch (error) {
    console.warn(
      "Authentication failed, using unauthenticated session:",
      error.message
    );
    return session;
  }
}

// Single user test runner
async function runUserTest(userId) {
  const session = await createAuthenticatedSession();
  const startTime = Date.now();

  console.log(`User ${userId}: Starting playlist processing test`);

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

      // Add some randomness to request timing
      await new Promise(
        (resolve) => setTimeout(resolve, getRandomInt(2000, 10000)) // 2-10 seconds between requests
      );
    } catch (error) {
      stats.totalRequests++;
      stats.failedRequests++;
      const errorKey = `${scenario}:error`;
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      console.log(`User ${userId}: ${scenario} error - ${error.message}`);
    }
  }

  console.log(`User ${userId}: Test completed`);
}

// Main load test runner
async function runPlaylistLoadTest() {
  console.log("🚀 Starting Playlist Processing Load Test");
  console.log("Configuration:", CONFIG);
  console.log("Test duration:", CONFIG.testDuration, "seconds");
  console.log("Concurrent users:", CONFIG.concurrentUsers);
  console.log("Ramp up time:", CONFIG.rampUpTime, "seconds");
  console.log("Base URL:", CONFIG.baseURL);
  console.log("---");

  // Create test database if needed
  createTestDatabase();

  // Initialize statistics
  stats.startTime = Date.now();

  // Start users gradually (ramp up)
  const userPromises = [];
  const rampUpDelay = (CONFIG.rampUpTime * 1000) / CONFIG.concurrentUsers;

  for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    const userPromise = new Promise((resolve) => {
      setTimeout(async () => {
        console.log(`Starting user ${i + 1}/${CONFIG.concurrentUsers}`);
        await runUserTest(i + 1);
        resolve();
      }, i * rampUpDelay);
    });
    userPromises.push(userPromise);
  }

  // Wait for all users to complete
  await Promise.all(userPromises);

  // Calculate final statistics
  stats.endTime = Date.now();
  const totalTime = (stats.endTime - stats.startTime) / 1000;

  // Calculate response time statistics
  const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
  const avgResponseTime =
    stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
  const medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

  // Print results
  console.log("\n📊 Playlist Processing Load Test Results");
  console.log("======================================");
  console.log(`Total test time: ${totalTime.toFixed(2)} seconds`);
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
    `Requests per second: ${(stats.totalRequests / totalTime).toFixed(2)}`
  );
  console.log("\nResponse Times:");
  console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`  Median: ${medianResponseTime.toFixed(2)}ms`);
  console.log(`  95th percentile: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`  99th percentile: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(`  Min: ${sortedTimes[0].toFixed(2)}ms`);
  console.log(`  Max: ${sortedTimes[sortedTimes.length - 1].toFixed(2)}ms`);

  console.log(`\nActive processing jobs: ${stats.processingJobs.size}`);

  if (Object.keys(stats.errors).length > 0) {
    console.log("\nErrors:");
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });
  }

  // Performance recommendations
  console.log("\n💡 Performance Recommendations:");
  if (avgResponseTime > 30000) {
    console.log(
      "  ⚠️  Average response time is very high (>30s). Consider optimizing playlist processing."
    );
  }
  if (p95ResponseTime > 60000) {
    console.log(
      "  ⚠️  95th percentile response time is very high (>60s). Consider scaling up resources."
    );
  }
  if (stats.successfulRequests / stats.totalRequests < 0.9) {
    console.log(
      "  ⚠️  Success rate is below 90%. Check server logs and processing stability."
    );
  }
  if (stats.processingJobs.size > CONFIG.concurrentUsers) {
    console.log(
      "  ⚠️  Many active processing jobs. Consider implementing job queuing."
    );
  }

  console.log("\n✅ Playlist processing load test completed!");
}

// Run the load test
if (require.main === module) {
  runPlaylistLoadTest().catch(console.error);
}

module.exports = { runPlaylistLoadTest, CONFIG, stats };
