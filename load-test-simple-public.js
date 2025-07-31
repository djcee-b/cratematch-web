const axios = require("axios");

// Configuration
const CONFIG = {
  baseURL: "http://localhost:3000", // Change to your server URL
  concurrentUsers: 50,
  testDuration: 300, // 5 minutes
  rampUpTime: 60, // 1 minute
  thinkTime: 2000, // 2 seconds between requests
  testScenarios: {
    homepage: 0.6, // 60% of traffic
    auth: 0.4, // 40% of traffic (public auth pages)
  },
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
  },
};

// Utility functions
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

  try {
    // Test auth page load (public page)
    const response = await axios.get(`${CONFIG.baseURL}/auth`, {
      timeout: 10000,
      headers: {
        "User-Agent": "LoadTest/1.0",
      },
    });

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.auth.requests++;

    console.log(`✅ Auth Page: ${response.status} (${responseTime}ms)`);
    return responseTime;
  } catch (error) {
    metrics.scenarios.auth.errors++;
    console.log(`❌ Auth Error: ${error.message}`);
    return null;
  }
}

// Main load test function
async function runLoadTest() {
  console.log("🚀 Starting CrateMatch Public Endpoints Load Test");
  console.log(`📊 Configuration:`);
  console.log(`   - Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`   - Test Duration: ${CONFIG.testDuration}s`);
  console.log(`   - Ramp Up Time: ${CONFIG.rampUpTime}s`);
  console.log(`   - Base URL: ${CONFIG.baseURL}`);
  console.log(`   - Testing: Homepage (60%) and Auth Page (40%)`);
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
      } else {
        scenario = "auth";
      }

      // Execute scenario
      switch (scenario) {
        case "homepage":
          await testHomepage();
          break;
        case "auth":
          await testAuth();
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
  console.log("📈 CrateMatch Public Endpoints Load Test Results");
  console.log("=".repeat(60));
  console.log(`⏱️  Test Duration: ${totalTime}s`);
  console.log(`📊 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`✅ Success Rate: ${successRate}%`);
  console.log(`📈 Requests/Second: ${(totalRequests / totalTime).toFixed(2)}`);
  console.log("");
  console.log("⏱️  Response Times:");
  console.log(`   Average: ${avgResponseTime}ms`);
  console.log(`   P50: ${p50}ms`);
  console.log(`   P90: ${p90}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  console.log("");
  console.log("📊 Scenario Breakdown:");
  console.log(
    `   Homepage: ${metrics.scenarios.homepage.requests} requests, ${metrics.scenarios.homepage.errors} errors`
  );
  console.log(
    `   Auth Page: ${metrics.scenarios.auth.requests} requests, ${metrics.scenarios.auth.errors} errors`
  );
  console.log("=".repeat(60));
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest, CONFIG };
