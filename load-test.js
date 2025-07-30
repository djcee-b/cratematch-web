const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || "http://localhost:3000",
  testDuration: parseInt(process.env.TEST_DURATION) || 60, // seconds
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 10,
  rampUpTime: parseInt(process.env.RAMP_UP_TIME) || 10, // seconds
  testUser: {
    email: process.env.TEST_EMAIL || "loadtest@example.com",
    password: process.env.TEST_PASSWORD || "loadtest123",
  },
  // Test scenarios weights (higher = more frequent)
  scenarios: {
    staticPages: 30, // 30% of requests
    authEndpoints: 20, // 20% of requests
    apiEndpoints: 30, // 30% of requests
    fileUploads: 10, // 10% of requests
    heavyOperations: 10, // 10% of requests
  },
};

// Test data
const TEST_DATA = {
  playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
  databaseFile: path.join(__dirname, "test-database.db"), // You'll need to create this
  threshold: 90,
};

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

// Helper function to create a test database file
function createTestDatabase() {
  if (!fs.existsSync(TEST_DATA.databaseFile)) {
    console.log("Creating test database file...");
    // Create a minimal test database file (you might want to use a real Serato database)
    const testData = Buffer.from("Test database content for load testing");
    fs.writeFileSync(TEST_DATA.databaseFile, testData);
  }
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
  return "staticPages"; // fallback
}

// Test scenarios
const testScenarios = {
  // Static page requests
  staticPages: async (session) => {
    const pages = [
      "/",
      "/auth",
      "/app",
      "/onboarding",
      "/pricing",
      "/settings",
    ];
    const page = pages[getRandomInt(0, pages.length - 1)];

    try {
      const response = await session.get(page);
      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Authentication endpoints
  authEndpoints: async (session) => {
    const endpoints = [
      { method: "post", path: "/auth/signin", data: CONFIG.testUser },
      { method: "post", path: "/auth/signup", data: CONFIG.testUser },
      {
        method: "post",
        path: "/auth/reset-password",
        data: { email: CONFIG.testUser.email },
      },
    ];

    const endpoint = endpoints[getRandomInt(0, endpoints.length - 1)];

    try {
      const response = await session[endpoint.method](
        endpoint.path,
        endpoint.data
      );
      return { success: response.status < 500, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // API endpoints (require authentication)
  apiEndpoints: async (session) => {
    const endpoints = [
      { method: "get", path: "/api/auth/verify" },
      { method: "get", path: "/databases" },
      { method: "get", path: "/api/scan-history" },
    ];

    const endpoint = endpoints[getRandomInt(0, endpoints.length - 1)];

    try {
      const response = await session[endpoint.method](endpoint.path);
      return { success: response.status < 500, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // File uploads
  fileUploads: async (session) => {
    try {
      const form = new FormData();
      form.append("database", fs.createReadStream(TEST_DATA.databaseFile));

      const response = await session.post("/upload-database", form, {
        headers: form.getHeaders(),
      });

      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Heavy operations (playlist processing)
  heavyOperations: async (session) => {
    try {
      const response = await session.post("/process-playlist", {
        playlistUrl: TEST_DATA.playlistUrl,
        threshold: TEST_DATA.threshold,
        databaseFileName: "database-v2",
      });

      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// Create authenticated session
async function createAuthenticatedSession() {
  const session = axios.create({
    baseURL: CONFIG.baseURL,
    timeout: 30000,
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

    // If both fail, return unauthenticated session
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

  while (Date.now() - startTime < CONFIG.testDuration * 1000) {
    const scenario = getRandomScenario();
    const scenarioStart = Date.now();

    try {
      const result = await testScenarios[scenario](session);
      const responseTime = Date.now() - scenarioStart;

      // Update statistics
      stats.totalRequests++;
      stats.responseTimes.push(responseTime);

      if (result.success) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
        const errorKey = `${scenario}:${result.status || "unknown"}`;
        stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      }

      // Add some randomness to request timing
      await new Promise((resolve) =>
        setTimeout(resolve, getRandomInt(100, 1000))
      );
    } catch (error) {
      stats.totalRequests++;
      stats.failedRequests++;
      const errorKey = `${scenario}:error`;
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    }
  }
}

// Main load test runner
async function runLoadTest() {
  console.log("🚀 Starting Load Test");
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
  console.log("\n📊 Load Test Results");
  console.log("==================");
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

  if (Object.keys(stats.errors).length > 0) {
    console.log("\nErrors:");
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });
  }

  // Performance recommendations
  console.log("\n💡 Performance Recommendations:");
  if (avgResponseTime > 2000) {
    console.log(
      "  ⚠️  Average response time is high (>2s). Consider optimizing database queries or adding caching."
    );
  }
  if (p95ResponseTime > 5000) {
    console.log(
      "  ⚠️  95th percentile response time is high (>5s). Consider scaling up resources."
    );
  }
  if (stats.successfulRequests / stats.totalRequests < 0.95) {
    console.log(
      "  ⚠️  Success rate is below 95%. Check error logs and server stability."
    );
  }
  if (stats.totalRequests / totalTime < 10) {
    console.log(
      "  ⚠️  Requests per second is low (<10). Consider optimizing server performance."
    );
  }

  console.log("\n✅ Load test completed!");
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest, CONFIG, stats };
