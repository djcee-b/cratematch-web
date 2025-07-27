#!/bin/bash

# Simple script to copy public files to the correct location
echo "📄 Copying public files..."

# Get the current working directory
CURRENT_DIR=$(pwd)
echo "Current directory: $CURRENT_DIR"

# Check if we're in a workspace environment
if [ -d "/workspace" ]; then
    echo "🔧 Detected workspace environment"
    TARGET_DIR="/workspace"
elif [ -d "/app" ]; then
    echo "🚀 Detected app environment"
    TARGET_DIR="/app"
else
    echo "🏠 Using current directory"
    TARGET_DIR="$CURRENT_DIR"
fi

# Create public directory
echo "📁 Creating public directory at: $TARGET_DIR/public"
mkdir -p "$TARGET_DIR/public"

# Copy public files
echo "📋 Copying files from $CURRENT_DIR/public to $TARGET_DIR/public"
cp -r "$CURRENT_DIR/public/"* "$TARGET_DIR/public/"

# Verify the copy
echo "✅ Files copied. Contents of $TARGET_DIR/public:"
ls -la "$TARGET_DIR/public/"

echo "🎉 Public files copy completed!" 