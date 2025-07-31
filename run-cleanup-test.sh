#!/bin/bash

echo "🚀 CrateMatch Load Test with User Cleanup"
echo "=========================================="

# Check if BASE_URL is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the server URL"
    echo "Usage: ./run-cleanup-test.sh <server-url>"
    echo "Example: ./run-cleanup-test.sh http://128.199.1.245"
    exit 1
fi

BASE_URL="$1"

# Set default values
CONCURRENT_USERS=${CONCURRENT_USERS:-50}
TEST_DURATION=${TEST_DURATION:-120}
RAMP_UP_TIME=${RAMP_UP_TIME:-10}

echo "📊 Test Configuration:"
echo "   - Server: $BASE_URL"
echo "   - $CONCURRENT_USERS concurrent users"
echo "   - ${TEST_DURATION}-second test duration"
echo "   - ${RAMP_UP_TIME}-second ramp-up time"
echo "   - Automatic user cleanup"
echo ""

# Test server connection
echo "[INFO] Testing connection to $BASE_URL..."
if curl -s --max-time 10 "$BASE_URL/health" > /dev/null 2>&1; then
    echo "[INFO] ✅ Server is responding!"
else
    echo "[INFO] ⚠️  Server health check failed, but continuing..."
fi

# Set environment variables
export BASE_URL="$BASE_URL"
export CONCURRENT_USERS="$CONCURRENT_USERS"
export TEST_DURATION="$TEST_DURATION"
export RAMP_UP_TIME="$RAMP_UP_TIME"

echo "[STEP] Starting $CONCURRENT_USERS-user load test with cleanup..."
echo ""

# Run the test
node test-with-cleanup.js

echo ""
echo "✅ Test completed!" 