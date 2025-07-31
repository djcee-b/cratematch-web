const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  baseURL: "http://localhost:3000", // Change to your server URL
  concurrentUsers: 50,
  testDuration: 300, // 5 minutes
  rampUpTime: 60, // 1 minute
  thinkTime: 2000, // 2 seconds between requests
  testScenarios: {
    homepage: 0.3, // 30% of traffic
    auth: 0.2, // 20% of traffic
    app: 0.4, // 40% of traffic
    processing: 0.1, // 10% of traffic
  },
};

// Test data
const TEST_DATA = {
  users: [
    { email: "test1@example.com", password: "password123" },
    { email: "test2@example.com", password: "password123" },
    { email: "test3@example.com", password: "password123" },
    { email: "test4@example.com", password: "password123" },
    { email: "test5@example.com", password: "password123" },
  ],
  playlists: [
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
    "https://open.spotify.com/playlist/37i9dQZF1DX5Ejj0EkURtP", // All Out 2010s
    "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6", // Chill Hits
    "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", // RapCaviar
    "https://open.spotify.com/playlist/37i9dQZF1DX5Vy6DFOcx00", // Rock Classics
  ],
};

// Metrics tracking
const metrics = {
  requests: 0,
  errors: 0,
  responseTimes: [],
  startTime: Date.now(),
  scenarios: {
    homepage: { requests: 0, errors: 0, avgResponseTime: 0 },
    auth: { requests: 0, errors: 0, avgResponseTime: 0 },
    app: { requests: 0, errors: 0, avgResponseTime: 0 },
    processing: { requests: 0, errors: 0, avgResponseTime: 0 },
  },
};

// Utility functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculatePercentile(values, percentile) {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Test scenarios
async function testHomepage() {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${CONFIG.baseURL}/`, {
      timeout: 10000,
      headers: {
        "User-Agent": "LoadTest/1.0",
      },
    });

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.homepage.requests++;

    console.log(`✅ Homepage: ${response.status} (${responseTime}ms)`);
    return responseTime;
  } catch (error) {
    metrics.scenarios.homepage.errors++;
    console.log(`❌ Homepage Error: ${error.message}`);
    return null;
  }
}

async function testAuth() {
  const startTime = Date.now();
  const user = getRandomElement(TEST_DATA.users);

  try {
    // Test signup
    const signupResponse = await axios.post(
      `${CONFIG.baseURL}/auth/signup`,
      {
        email: user.email,
        password: user.password,
      },
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LoadTest/1.0",
        },
      }
    );

    // Test signin
    const signinResponse = await axios.post(
      `${CONFIG.baseURL}/auth/signin`,
      {
        email: user.email,
        password: user.password,
      },
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LoadTest/1.0",
        },
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.auth.requests++;

    console.log(`✅ Auth: ${signinResponse.status} (${responseTime}ms)`);
    return responseTime;
  } catch (error) {
    metrics.scenarios.auth.errors++;
    console.log(`❌ Auth Error: ${error.message}`);
    return null;
  }
}

async function testApp() {
  const startTime = Date.now();

  try {
    // Test app page load
    const response = await axios.get(`${CONFIG.baseURL}/app`, {
      timeout: 10000,
      headers: {
        "User-Agent": "LoadTest/1.0",
      },
    });

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.app.requests++;

    console.log(`✅ App: ${response.status} (${responseTime}ms)`);
    return responseTime;
  } catch (error) {
    metrics.scenarios.app.errors++;
    console.log(`❌ App Error: ${error.message}`);
    return null;
  }
}

async function testProcessing() {
  const startTime = Date.now();
  const playlist = getRandomElement(TEST_DATA.playlists);

  try {
    // Simulate playlist processing request
    const response = await axios.post(
      `${CONFIG.baseURL}/api/process-playlist`,
      {
        playlistUrl: playlist,
        threshold: Math.floor(Math.random() * 20) + 80, // Random threshold 80-100
      },
      {
        timeout: 30000, // Longer timeout for processing
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LoadTest/1.0",
        },
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.processing.requests++;

    console.log(`✅ Processing: ${response.status} (${responseTime}ms)`);
    return responseTime;
  } catch (error) {
    metrics.scenarios.processing.errors++;
    console.log(`❌ Processing Error: ${error.message}`);
    return null;
  }
}

// Main load test function
async function runLoadTest() {
  console.log("🚀 Starting CrateMatch Load Test");
  console.log(`📊 Configuration:`);
  console.log(`   - Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`   - Test Duration: ${CONFIG.testDuration}s`);
  console.log(`   - Ramp Up Time: ${CONFIG.rampUpTime}s`);
  console.log(`   - Base URL: ${CONFIG.baseURL}`);
  console.log("");

  const startTime = Date.now();
  const endTime = startTime + CONFIG.testDuration * 1000;

  // Create concurrent user sessions
  const userSessions = Array.from(
    { length: CONFIG.concurrentUsers },
    (_, i) => i
  );

  // Run concurrent sessions
  const sessionPromises = userSessions.map(async (userId) => {
    while (Date.now() < endTime) {
      // Random scenario selection based on weights
      const rand = Math.random();
      let scenario;

      if (rand < CONFIG.testScenarios.homepage) {
        scenario = "homepage";
      } else if (
        rand <
        CONFIG.testScenarios.homepage + CONFIG.testScenarios.auth
      ) {
        scenario = "auth";
      } else if (
        rand <
        CONFIG.testScenarios.homepage +
          CONFIG.testScenarios.auth +
          CONFIG.testScenarios.app
      ) {
        scenario = "app";
      } else {
        scenario = "processing";
      }

      // Execute scenario
      switch (scenario) {
        case "homepage":
          await testHomepage();
          break;
        case "auth":
          await testAuth();
          break;
        case "app":
          await testApp();
          break;
        case "processing":
          await testProcessing();
          break;
      }

      metrics.requests++;

      // Think time between requests
      await sleep(CONFIG.thinkTime + Math.random() * 1000);
    }
  });

  // Wait for all sessions to complete
  await Promise.all(sessionPromises);

  // Generate report
  generateReport();
}

// Generate comprehensive test report
function generateReport() {
  const totalTime = (Date.now() - metrics.startTime) / 1000;
  const totalRequests = metrics.requests;
  const totalErrors = metrics.errors;
  const successRate = (
    ((totalRequests - totalErrors) / totalRequests) *
    100
  ).toFixed(2);

  const avgResponseTime =
    metrics.responseTimes.length > 0
      ? (
          metrics.responseTimes.reduce((a, b) => a + b, 0) /
          metrics.responseTimes.length
        ).toFixed(2)
      : 0;

  const p50 = calculatePercentile(metrics.responseTimes, 50);
  const p90 = calculatePercentile(metrics.responseTimes, 90);
  const p95 = calculatePercentile(metrics.responseTimes, 95);
  const p99 = calculatePercentile(metrics.responseTimes, 99);

  console.log("\n" + "=".repeat(60));
  console.log("📈 CrateMatch Load Test Results");
  console.log("=".repeat(60));
  console.log(`⏱️  Test Duration: ${totalTime}s`);
  console.log(`👥 Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`📊 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`✅ Success Rate: ${successRate}%`);
  console.log(`📈 Requests/sec: ${(totalRequests / totalTime).toFixed(2)}`);
  console.log("");

  console.log("⏱️  Response Time Statistics:");
  console.log(`   Average: ${avgResponseTime}ms`);
  console.log(`   P50: ${p50}ms`);
  console.log(`   P90: ${p90}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  console.log("");

  console.log("📊 Scenario Breakdown:");
  Object.entries(metrics.scenarios).forEach(([scenario, data]) => {
    const scenarioSuccessRate =
      data.requests > 0
        ? (((data.requests - data.errors) / data.requests) * 100).toFixed(2)
        : 0;
    console.log(
      `   ${scenario}: ${data.requests} requests, ${data.errors} errors (${scenarioSuccessRate}% success)`
    );
  });
  console.log("");

  // Recommendations
  console.log("💡 Recommendations:");
  if (successRate < 95) {
    console.log("   ⚠️  Success rate below 95% - investigate error patterns");
  }
  if (p95 > 5000) {
    console.log(
      "   ⚠️  P95 response time above 5s - consider performance optimizations"
    );
  }
  if (avgResponseTime > 2000) {
    console.log(
      "   ⚠️  Average response time above 2s - investigate slow endpoints"
    );
  }
  if (successRate >= 95 && p95 < 3000 && avgResponseTime < 1000) {
    console.log("   ✅ Performance looks good for current load");
  }

  console.log("=".repeat(60));
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
CrateMatch Load Testing Tool

Usage: node load-test.js [options]

Options:
  --users <number>     Number of concurrent users (default: 50)
  --duration <seconds> Test duration in seconds (default: 300)
  --url <url>          Server URL to test (default: http://localhost:3000)
  --help, -h           Show this help message

Examples:
  node load-test.js --users 100 --duration 600 --url https://your-server.com
  node load-test.js --users 25 --duration 120
    `);
    process.exit(0);
  }

  // Parse command line arguments
  const userIndex = args.indexOf("--users");
  if (userIndex !== -1 && args[userIndex + 1]) {
    CONFIG.concurrentUsers = parseInt(args[userIndex + 1]);
  }

  const durationIndex = args.indexOf("--duration");
  if (durationIndex !== -1 && args[durationIndex + 1]) {
    CONFIG.testDuration = parseInt(args[durationIndex + 1]);
  }

  const urlIndex = args.indexOf("--url");
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    CONFIG.baseURL = args[urlIndex + 1];
  }

  // Run the load test
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest, CONFIG, metrics };
