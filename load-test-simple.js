const axios = require("axios");

// Simple load test configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || "http://localhost:3000",
  duration: parseInt(process.env.DURATION) || 30, // seconds
  requestsPerSecond: parseInt(process.env.RPS) || 10,
  endpoints: ["/", "/auth", "/app", "/onboarding", "/pricing", "/settings"],
};

// Statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: {},
};

// Simple request function
async function makeRequest(endpoint) {
  const startTime = Date.now();

  try {
    const response = await axios.get(`${CONFIG.baseURL}${endpoint}`, {
      timeout: 10000,
      validateStatus: () => true,
    });

    const responseTime = Date.now() - startTime;

    stats.totalRequests++;
    stats.responseTimes.push(responseTime);

    if (response.status === 200) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
      const errorKey = `${endpoint}:${response.status}`;
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    }

    return {
      success: response.status === 200,
      status: response.status,
      time: responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    stats.totalRequests++;
    stats.failedRequests++;
    stats.responseTimes.push(responseTime);

    const errorKey = `${endpoint}:error`;
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;

    return { success: false, error: error.message, time: responseTime };
  }
}

// Main load test function
async function runSimpleLoadTest() {
  console.log("🚀 Starting Simple Load Test");
  console.log("Configuration:", CONFIG);
  console.log("---");

  const startTime = Date.now();
  const interval = 1000 / CONFIG.requestsPerSecond; // milliseconds between requests
  let requestCount = 0;

  const testInterval = setInterval(async () => {
    // Check if test duration has elapsed
    if (Date.now() - startTime >= CONFIG.duration * 1000) {
      clearInterval(testInterval);
      printResults();
      return;
    }

    // Make a request to a random endpoint
    const endpoint =
      CONFIG.endpoints[Math.floor(Math.random() * CONFIG.endpoints.length)];
    const result = await makeRequest(endpoint);

    requestCount++;
    if (requestCount % 10 === 0) {
      console.log(`Made ${requestCount} requests...`);
    }
  }, interval);
}

// Print results
function printResults() {
  const totalTime = CONFIG.duration;
  const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
  const avgResponseTime =
    stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
  const medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

  console.log("\n📊 Simple Load Test Results");
  console.log("==========================");
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
  console.log(`  Min: ${sortedTimes[0].toFixed(2)}ms`);
  console.log(`  Max: ${sortedTimes[sortedTimes.length - 1].toFixed(2)}ms`);

  if (Object.keys(stats.errors).length > 0) {
    console.log("\nErrors:");
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });
  }

  console.log("\n✅ Simple load test completed!");
}

// Run the test
if (require.main === module) {
  runSimpleLoadTest().catch(console.error);
}

module.exports = { runSimpleLoadTest, CONFIG, stats };
