#!/bin/bash

# WRK Load Testing Script
# This script uses wrk to test your server performance

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
CONCURRENT_CONNECTIONS=${CONCURRENT_CONNECTIONS:-10}
THREADS=${THREADS:-2}
TEST_DURATION=${TEST_DURATION:-30}
REQUESTS_PER_SECOND=${REQUESTS_PER_SECOND:-100}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 WRK Load Testing${NC}"
echo "====================="
echo -e "Base URL: ${YELLOW}${BASE_URL}${NC}"
echo -e "Concurrent Connections: ${YELLOW}${CONCURRENT_CONNECTIONS}${NC}"
echo -e "Threads: ${YELLOW}${THREADS}${NC}"
echo -e "Test Duration: ${YELLOW}${TEST_DURATION}s${NC}"
echo -e "Requests per Second: ${YELLOW}${REQUESTS_PER_SECOND}${NC}"
echo ""

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
    echo -e "${RED}❌ WRK is not installed${NC}"
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt-get install wrk"
    echo "  macOS: brew install wrk"
    echo "  Or build from source: https://github.com/wg/wrk"
    exit 1
fi

# Test endpoints
endpoints=(
    "/"
    "/auth"
    "/app"
    "/onboarding"
    "/pricing"
    "/settings"
)

# Function to run test for an endpoint
run_test() {
    local endpoint=$1
    local test_name=$2
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    echo "Endpoint: ${BASE_URL}${endpoint}"
    echo "----------------------------------------"
    
    # Run WRK test
    wrk -t${THREADS} \
        -c${CONCURRENT_CONNECTIONS} \
        -d${TEST_DURATION}s \
        -R${REQUESTS_PER_SECOND} \
        --latency \
        --timeout 10s \
        "${BASE_URL}${endpoint}" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test completed successfully${NC}"
    else
        echo -e "${RED}❌ Test failed${NC}"
    fi
    echo ""
}

# Function to run stress test
run_stress_test() {
    echo -e "${BLUE}🔥 Running Stress Test${NC}"
    echo "High load test with maximum connections"
    echo "----------------------------------------"
    
    wrk -t${THREADS} \
        -c100 \
        -d60s \
        -R500 \
        --latency \
        --timeout 10s \
        "${BASE_URL}/" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Stress test completed successfully${NC}"
    else
        echo -e "${RED}❌ Stress test failed${NC}"
    fi
    echo ""
}

# Function to run spike test
run_spike_test() {
    echo -e "${BLUE}⚡ Running Spike Test${NC}"
    echo "Sudden burst of traffic test"
    echo "----------------------------------------"
    
    # Normal load
    echo "Phase 1: Normal load (10 connections for 30s)"
    wrk -t${THREADS} -c10 -d30s -R50 "${BASE_URL}/" > /dev/null 2>&1
    
    # Spike load
    echo "Phase 2: Spike load (200 connections for 10s)"
    wrk -t${THREADS} -c200 -d10s -R1000 "${BASE_URL}/" > /dev/null 2>&1
    
    # Return to normal
    echo "Phase 3: Return to normal (10 connections for 30s)"
    wrk -t${THREADS} -c10 -d30s -R50 "${BASE_URL}/" > /dev/null 2>&1
    
    echo -e "${GREEN}✅ Spike test completed successfully${NC}"
    echo ""
}

# Function to run custom Lua script test
run_lua_test() {
    echo -e "${BLUE}📝 Running Custom Lua Script Test${NC}"
    echo "Testing with custom request patterns"
    echo "----------------------------------------"
    
    # Create a simple Lua script for testing
    cat > test_script.lua << 'EOF'
-- Custom test script for WRK
function setup(thread)
    thread:set("id", thread.id)
end

function init(args)
    requests = 0
    responses = 0
end

function request()
    requests = requests + 1
    
    -- Randomly choose different endpoints
    local endpoints = {
        "/",
        "/auth", 
        "/app",
        "/onboarding",
        "/pricing",
        "/settings"
    }
    
    local endpoint = endpoints[math.random(#endpoints)]
    
    return wrk.format("GET", endpoint)
end

function response(status, headers, body)
    responses = responses + 1
end

function done(summary, latency, requests)
    io.write(string.format("Thread %d: %d requests, %d responses\n", 
        wrk.thread.id, requests, responses))
end
EOF
    
    wrk -t${THREADS} \
        -c${CONCURRENT_CONNECTIONS} \
        -d${TEST_DURATION}s \
        -R${REQUESTS_PER_SECOND} \
        --latency \
        --timeout 10s \
        --script test_script.lua \
        "${BASE_URL}" 2>/dev/null
    
    # Clean up
    rm -f test_script.lua
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Custom Lua test completed successfully${NC}"
    else
        echo -e "${RED}❌ Custom Lua test failed${NC}"
    fi
    echo ""
}

# Function to run memory leak test
run_memory_test() {
    echo -e "${BLUE}🧠 Running Memory Leak Test${NC}"
    echo "Long duration test to check for memory leaks"
    echo "----------------------------------------"
    
    wrk -t${THREADS} \
        -c${CONCURRENT_CONNECTIONS} \
        -d300s \
        -R${REQUESTS_PER_SECOND} \
        --latency \
        --timeout 10s \
        "${BASE_URL}/" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Memory test completed successfully${NC}"
    else
        echo -e "${RED}❌ Memory test failed${NC}"
    fi
    echo ""
}

# Function to analyze results
analyze_results() {
    echo -e "${BLUE}📊 Analyzing Results${NC}"
    echo "================================"
    
    echo -e "${YELLOW}Performance Recommendations:${NC}"
    echo "1. Monitor server CPU and memory usage during tests"
    echo "2. Check for connection timeouts or errors"
    echo "3. Look for response time degradation under load"
    echo "4. Verify database connection pooling is working"
    echo "5. Check if rate limiting is properly configured"
    echo ""
    
    echo -e "${YELLOW}Common issues to watch for:${NC}"
    echo "- High latency under load (>1s average)"
    echo "- Connection timeouts"
    echo "- Memory leaks (increasing memory usage)"
    echo "- CPU saturation (100% usage)"
    echo "- Database connection pool exhaustion"
    echo ""
}

# Main execution
main() {
    # Test each endpoint
    for endpoint in "${endpoints[@]}"; do
        test_name=$(echo $endpoint | sed 's/\//_/g' | sed 's/^_//')
        if [ -z "$test_name" ]; then
            test_name="home"
        fi
        run_test "$endpoint" "$test_name"
    done
    
    # Run stress test
    run_stress_test
    
    # Run spike test
    run_spike_test
    
    # Run custom Lua test
    run_lua_test
    
    # Run memory leak test (optional - uncomment if needed)
    # run_memory_test
    
    # Analyze results
    analyze_results
    
    echo -e "${GREEN}🎉 All WRK load tests completed!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Review the latency distribution in test output"
    echo "2. Monitor server resources during testing"
    echo "3. Check server logs for errors"
    echo "4. Consider running longer tests for memory leak detection"
    echo "5. Test with different connection patterns"
}

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if curl -s "${BASE_URL}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
    echo ""
    main
else
    echo -e "${RED}❌ Server is not running at ${BASE_URL}${NC}"
    echo "Please start your server first:"
    echo "  npm start"
    echo "  or"
    echo "  node server.js"
    exit 1
fi 