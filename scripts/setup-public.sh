#!/bin/bash

# Setup public files for deployment
echo "📁 Setting up public files..."

# Check if we're in a workspace environment
if [ -d "/workspace" ]; then
    echo "🔧 Detected workspace environment"
    WORKSPACE_DIR="/workspace"
else
    echo "🏠 Using local directory"
    WORKSPACE_DIR="$(pwd)"
fi

# Create public directory if it doesn't exist
if [ ! -d "$WORKSPACE_DIR/public" ]; then
    echo "📂 Creating public directory..."
    mkdir -p "$WORKSPACE_DIR/public"
fi

# Copy public files if they don't exist
if [ ! -f "$WORKSPACE_DIR/public/index.html" ]; then
    echo "📄 Copying public files..."
    cp -r public/* "$WORKSPACE_DIR/public/"
    echo "✅ Public files copied successfully"
else
    echo "✅ Public files already exist"
fi

# Verify the files
echo "🔍 Verifying public files..."
ls -la "$WORKSPACE_DIR/public/"

echo "✅ Public files setup complete!" 