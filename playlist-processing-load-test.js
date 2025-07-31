const axios = require("axios");

// Configuration
const CONFIG = {
  baseURL: "http://localhost:3000", // Change to your server URL
  concurrentUsers: 10, // Reduced for processing test
  testDuration: 300, // 5 minutes
  rampUpTime: 30, // 30 seconds
  thinkTime: 5000, // 5 seconds between requests
  credentials: {
    email: "djceebweb@gmail.com",
    password: "Terry1234",
  },
  databaseFileName: "databasev2",
  playlists: [
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
    "https://open.spotify.com/playlist/37i9dQZF1DX5Ejj0EkURtP", // All Out 2010s
    "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6", // Chill Hits
    "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", // RapCaviar
    "https://open.spotify.com/playlist/37i9dQZF1DX5Vy6DFOcx00", // Rock Classics
    "https://open.spotify.com/playlist/37i9dQZF1DX7KNKjOK0o75", // Have a Great Day!
    "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO", // Peaceful Piano
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
    login: { requests: 0, errors: 0, avgResponseTime: 0 },
    processing: { requests: 0, errors: 0, avgResponseTime: 0 },
  },
  authTokens: new Map(), // Store auth tokens per user
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

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Test scenarios
async function testLogin(userId) {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/auth/signin`,
      {
        email: CONFIG.credentials.email,
        password: CONFIG.credentials.password,
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
    metrics.scenarios.login.requests++;

    // Store the auth token
    if (response.data && response.data.access_token) {
      metrics.authTokens.set(userId, response.data.access_token);
      console.log(
        `✅ Login: ${response.status} (${responseTime}ms) - User ${userId}`
      );
    } else {
      console.log(
        `⚠️  Login: ${response.status} (${responseTime}ms) - No token received`
      );
    }

    return responseTime;
  } catch (error) {
    metrics.scenarios.login.errors++;
    console.log(`❌ Login Error: ${error.message}`);
    return null;
  }
}

async function testPlaylistProcessing(userId) {
  const startTime = Date.now();
  const playlist = getRandomElement(CONFIG.playlists);
  const authToken = metrics.authTokens.get(userId);

  if (!authToken) {
    console.log(`❌ No auth token for user ${userId}, skipping processing`);
    return null;
  }

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/process-playlist`,
      {
        playlistUrl: playlist,
        threshold: Math.floor(Math.random() * 20) + 80, // Random threshold 80-100
        databaseFileName: CONFIG.databaseFileName,
      },
      {
        timeout: 120000, // 2 minutes timeout for processing
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LoadTest/1.0",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    metrics.scenarios.processing.requests++;

    console.log(
      `✅ Processing: ${response.status} (${responseTime}ms) - User ${userId} - ${playlist}`
    );
    return responseTime;
  } catch (error) {
    metrics.scenarios.processing.errors++;
    console.log(`❌ Processing Error: ${error.message} - User ${userId}`);
    return null;
  }
}

// Main load test function
async function runLoadTest() {
  console.log("🚀 Starting CrateMatch Playlist Processing Load Test");
  console.log(`📊 Configuration:`);
  console.log(`   - Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`   - Test Duration: ${CONFIG.testDuration}s`);
  console.log(`   - Ramp Up Time: ${CONFIG.rampUpTime}s`);
  console.log(`   - Base URL: ${CONFIG.baseURL}`);
  console.log(`   - User: ${CONFIG.credentials.email}`);
  console.log(`   - Database: ${CONFIG.databaseFileName}`);
  console.log(`   - Playlists: ${CONFIG.playlists.length} different playlists`);
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
    // Login first
    await testLogin(userId);
    await sleep(2000); // Wait 2 seconds after login

    while (Date.now() < endTime) {
      // Test playlist processing
      await testPlaylistProcessing(userId);
      metrics.requests++;

      // Think time between requests
      await sleep(CONFIG.thinkTime + Math.random() * 2000);
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
  console.log("📈 CrateMatch Playlist Processing Load Test Results");
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
    `   Login: ${metrics.scenarios.login.requests} requests, ${metrics.scenarios.login.errors} errors`
  );
  console.log(
    `   Processing: ${metrics.scenarios.processing.requests} requests, ${metrics.scenarios.processing.errors} errors`
  );
  console.log("");
  console.log("🔑 Authentication:");
  console.log(
    `   Users with tokens: ${metrics.authTokens.size}/${CONFIG.concurrentUsers}`
  );
  console.log("=".repeat(60));
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest, CONFIG };
