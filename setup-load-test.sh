#!/bin/bash

# CrateMatch Load Testing Setup Script

echo "🚀 Setting up CrateMatch Load Testing Environment"
echo "================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Create load test directory
LOAD_TEST_DIR="cratematch-load-test"
if [ -d "$LOAD_TEST_DIR" ]; then
    echo "📁 Load test directory already exists: $LOAD_TEST_DIR"
else
    echo "📁 Creating load test directory: $LOAD_TEST_DIR"
    mkdir -p "$LOAD_TEST_DIR"
fi

cd "$LOAD_TEST_DIR"

# Copy load test files if they don't exist
if [ ! -f "load-test.js" ]; then
    echo "📄 Copying load-test.js..."
    cp ../load-test.js .
fi

if [ ! -f "package.json" ]; then
    echo "📄 Copying package.json..."
    cp ../load-test-package.json package.json
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Configure server URL
echo ""
echo "🔧 Configuration"
echo "================"

# Get current server URL from load-test.js
CURRENT_URL=$(grep -o "baseURL: '[^']*'" load-test.js | cut -d"'" -f2)
echo "Current server URL: $CURRENT_URL"

read -p "Enter your server URL (or press Enter to keep current): " NEW_URL

if [ ! -z "$NEW_URL" ]; then
    # Update the URL in load-test.js
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|baseURL: '[^']*'|baseURL: '$NEW_URL'|" load-test.js
    else
        # Linux
        sed -i "s|baseURL: '[^']*'|baseURL: '$NEW_URL'|" load-test.js
    fi
    echo "✅ Server URL updated to: $NEW_URL"
else
    echo "✅ Keeping current server URL: $CURRENT_URL"
fi

echo ""
echo "🎯 Available Test Commands"
echo "=========================="
echo "npm run test:light    - 10 users, 1 minute (Development)"
echo "npm run test:medium   - 50 users, 5 minutes (Staging)"
echo "npm run test:heavy    - 100 users, 10 minutes (Production)"
echo "npm run test:stress   - 200 users, 15 minutes (Stress)"
echo ""
echo "Custom test: node load-test.js --users 25 --duration 120"
echo ""

# Test server connectivity
echo "🔍 Testing server connectivity..."
if curl -s --max-time 5 "$CURRENT_URL" > /dev/null; then
    echo "✅ Server is accessible"
else
    echo "❌ Warning: Server might not be accessible. Please check your URL."
fi

echo ""
echo "📋 Next Steps:"
echo "1. Make sure your CrateMatch server is running"
echo "2. Start with a light test: npm run test:light"
echo "3. Monitor your server during testing"
echo "4. Check the results and adjust server configuration if needed"
echo ""
echo "📖 For detailed instructions, see: LOAD_TESTING_GUIDE.md"
echo ""
echo "🎉 Setup complete! Ready to load test your CrateMatch server." 