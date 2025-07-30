#!/bin/bash

# Apache Bench Load Testing Script
# This script uses Apache Bench (ab) to test your server performance

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
CONCURRENT_USERS=${CONCURRENT_USERS:-10}
TOTAL_REQUESTS=${TOTAL_REQUESTS:-1000}
TEST_DURATION=${TEST_DURATION:-60}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Apache Bench Load Testing${NC}"
echo "================================"
echo -e "Base URL: ${YELLOW}${BASE_URL}${NC}"
echo -e "Concurrent Users: ${YELLOW}${CONCURRENT_USERS}${NC}"
echo -e "Total Requests: ${YELLOW}${TOTAL_REQUESTS}${NC}"
echo -e "Test Duration: ${YELLOW}${TEST_DURATION}s${NC}"
echo ""

# Check if ab is installed
if ! command -v ab &> /dev/null; then
    echo -e "${RED}❌ Apache Bench (ab) is not installed${NC}"
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt-get install apache2-utils"
    echo "  macOS: brew install httpd"
    echo "  CentOS/RHEL: sudo yum install httpd-tools"
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
    
    # Run Apache Bench test
    ab -n ${TOTAL_REQUESTS} \
       -c ${CONCURRENT_USERS} \
       -t ${TEST_DURATION} \
       -g "ab_results_${test_name}.gnuplot" \
       -e "ab_results_${test_name}.csv" \
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
    echo "High load test with ${CONCURRENT_USERS} concurrent users"
    echo "----------------------------------------"
    
    ab -n 5000 \
       -c ${CONCURRENT_USERS} \
       -t 120 \
       -g "ab_stress_test.gnuplot" \
       -e "ab_stress_test.csv" \
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
    echo "Phase 1: Normal load (10 users for 30s)"
    ab -n 300 -c 10 -t 30 "${BASE_URL}/" > /dev/null 2>&1
    
    # Spike load
    echo "Phase 2: Spike load (100 users for 10s)"
    ab -n 1000 -c 100 -t 10 "${BASE_URL}/" > /dev/null 2>&1
    
    # Return to normal
    echo "Phase 3: Return to normal (10 users for 30s)"
    ab -n 300 -c 10 -t 30 "${BASE_URL}/" > /dev/null 2>&1
    
    echo -e "${GREEN}✅ Spike test completed successfully${NC}"
    echo ""
}

# Function to analyze results
analyze_results() {
    echo -e "${BLUE}📊 Analyzing Results${NC}"
    echo "================================"
    
    # Check if results files exist
    if [ -f "ab_results_home.csv" ]; then
        echo -e "${GREEN}Results files generated:${NC}"
        ls -la ab_results_*.csv ab_results_*.gnuplot 2>/dev/null
        echo ""
        
        echo -e "${YELLOW}To visualize results with gnuplot:${NC}"
        echo "gnuplot -e \"set terminal png; set output 'response_time.png'; plot 'ab_results_home.gnuplot' using 9 with lines title 'Response Time'\""
        echo ""
    fi
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
    
    # Analyze results
    analyze_results
    
    echo -e "${GREEN}🎉 All load tests completed!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Review the generated CSV files for detailed metrics"
    echo "2. Use gnuplot to visualize response times"
    echo "3. Check server logs for any errors during testing"
    echo "4. Monitor server resources (CPU, memory, disk I/O) during tests"
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