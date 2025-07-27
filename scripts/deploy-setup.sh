#!/bin/bash

# CrateMatch Web Deployment Setup Script
# This script handles common npm installation issues on servers

set -e  # Exit on any error

echo "🚀 Starting CrateMatch Web deployment setup..."

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "Node.js: $NODE_VERSION"
echo "npm: $NPM_VERSION"

# Check if Node.js version is sufficient (18+)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ is required. Current version: $NODE_VERSION"
    echo "Please upgrade Node.js on your server."
    exit 1
fi

# Check for NPM token
echo "🔐 Checking NPM authentication..."
if [ -z "$NPM_TOKEN" ]; then
    echo "❌ Error: NPM_TOKEN environment variable is not set"
    echo "Please set NPM_TOKEN with your npm access token for @musiclibrarytools packages"
    echo "You can get a token from: https://www.npmjs.com/settings/tokens"
    exit 1
else
    echo "✅ NPM token found"
fi

# Clean up any existing installation
echo "🧹 Cleaning up existing installation..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
fi

# Clear npm cache
echo "🗑️  Clearing npm cache..."
npm cache clean --force

# Set npm configuration for better reliability
echo "⚙️  Configuring npm..."
npm config set registry https://registry.npmjs.org/
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

# Configure NPM authentication for private packages
echo "🔑 Setting up NPM authentication..."
npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN

# Install dependencies
echo "📦 Installing dependencies..."
npm install --verbose

# Verify installation
echo "✅ Verifying installation..."
if [ -d "node_modules/@musiclibrarytools" ]; then
    echo "✅ @musiclibrarytools packages installed successfully"
    ls -la node_modules/@musiclibrarytools/
else
    echo "❌ @musiclibrarytools packages not found"
    exit 1
fi

# Test the application
echo "🧪 Testing application..."
if node -e "require('@musiclibrarytools/mlt.js'); console.log('✅ mlt.js loaded successfully')"; then
    echo "✅ mlt.js module test passed"
else
    echo "❌ mlt.js module test failed"
    exit 1
fi

if node -e "require('@musiclibrarytools/serato.js'); console.log('✅ serato.js loaded successfully')"; then
    echo "✅ serato.js module test passed"
else
    echo "❌ serato.js module test failed"
    exit 1
fi

echo "🎉 Deployment setup completed successfully!"
echo "You can now run: npm start" 