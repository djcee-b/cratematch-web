#!/bin/bash

# Load Test Runner for CrateMatch
# This script updates the load test URL and runs it against your deployed server

set -e

echo "🚀 CrateMatch Load Test Runner"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get server URL from user
if [ -z "$1" ]; then
    print_step "Enter your server URL (e.g., http://YOUR_DROPLET_IP or https://yourdomain.com):"
    read -p "Server URL: " SERVER_URL
else
    SERVER_URL="$1"
fi

# Validate URL format
if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
    print_error "Invalid URL format. Please include http:// or https://"
    exit 1
fi

print_status "Testing connection to $SERVER_URL..."

# Test if server is reachable
if curl -f -s "$SERVER_URL/health" > /dev/null 2>&1; then
    print_status "✅ Server is responding!"
elif curl -f -s "$SERVER_URL/" > /dev/null 2>&1; then
    print_status "✅ Server is responding!"
else
    print_error "❌ Cannot reach server at $SERVER_URL"
    print_warning "Please check your server URL and make sure the server is running"
    exit 1
fi

print_step "Updating load test configuration..."

# Create a temporary load test file with the correct URL
TEMP_LOAD_TEST="load-test-temp.js"
cp playlist-load-test.js "$TEMP_LOAD_TEST"

# Update the baseURL in the temporary file
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|baseURL: \"http://localhost:3000\"|baseURL: \"$SERVER_URL\"|g" "$TEMP_LOAD_TEST"
else
    # Linux
    sed -i "s|baseURL: \"http://localhost:3000\"|baseURL: \"$SERVER_URL\"|g" "$TEMP_LOAD_TEST"
fi

print_status "Load test configuration updated"
print_status "Target server: $SERVER_URL"

print_step "Starting 50-user load test..."
echo ""
echo "📊 Test Configuration:"
echo "   - 50 concurrent users"
echo "   - 2-minute test duration"
echo "   - 10-second ramp-up time"
echo "   - Testing: Playlist processing with authentication"
echo "   - User: djceebweb@gmail.com"
echo "   - Database: database-v2"
echo ""

# Run the load test
node "$TEMP_LOAD_TEST"

# Clean up
rm "$TEMP_LOAD_TEST"

print_status "✅ Load test completed!" 