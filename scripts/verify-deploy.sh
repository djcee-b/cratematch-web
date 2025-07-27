#!/bin/bash

# Simple deployment verification script
echo "🔍 Verifying deployment..."

# Check if public files exist
if [ -f "public/index.html" ]; then
    echo "✅ public/index.html exists"
else
    echo "❌ public/index.html missing"
    exit 1
fi

# Check if dependencies are installed
if [ -d "node_modules/@musiclibrarytools" ]; then
    echo "✅ @musiclibrarytools packages installed"
else
    echo "❌ @musiclibrarytools packages missing"
    exit 1
fi

echo "✅ Deployment verification passed!" 