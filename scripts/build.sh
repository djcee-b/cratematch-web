#!/bin/bash

# Build script for DigitalOcean App Platform
echo "🏗️  Building CrateMatch Web for deployment..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public uploads crates

# Copy public files to ensure they're included in deployment
echo "📄 Ensuring public files are present..."
if [ -d "public" ]; then
    echo "✅ Public directory exists"
    ls -la public/
else
    echo "❌ Public directory missing - creating from source"
    # This shouldn't happen, but just in case
    mkdir -p public
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Verify critical files
echo "🔍 Verifying deployment files..."
if [ -f "public/index.html" ]; then
    echo "✅ index.html found"
else
    echo "❌ index.html missing"
    exit 1
fi

if [ -f "server.js" ]; then
    echo "✅ server.js found"
else
    echo "❌ server.js missing"
    exit 1
fi

echo "🎉 Build completed successfully!" 