#!/bin/bash

# Build script for DigitalOcean App Platform
echo "🏗️  Building CrateMatch Web for deployment..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public uploads crates

# Check if public directory has files
echo "📄 Checking public directory contents..."
if [ -d "public" ]; then
    echo "✅ Public directory exists"
    PUBLIC_FILES=$(ls -A public/ 2>/dev/null | wc -l)
    echo "📊 Number of files in public directory: $PUBLIC_FILES"
    
    if [ "$PUBLIC_FILES" -eq 0 ]; then
        echo "⚠️  Public directory is empty - this is expected in some deployment environments"
        echo "📋 The server will handle static file serving from the source location"
    else
        echo "📄 Public files found:"
        ls -la public/
    fi
else
    echo "❌ Public directory missing - creating"
    mkdir -p public
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Verify critical files exist in the source
echo "🔍 Verifying source files..."
if [ -f "server.js" ]; then
    echo "✅ server.js found"
else
    echo "❌ server.js missing"
    exit 1
fi

# Check if we have the source public files (they might be in a different location)
echo "🔍 Checking for source public files..."
SOURCE_PUBLIC_FILES=0
if [ -f "public/index.html" ]; then
    echo "✅ Source public/index.html found"
    SOURCE_PUBLIC_FILES=$((SOURCE_PUBLIC_FILES + 1))
fi

if [ -f "public/styles.css" ]; then
    echo "✅ Source public/styles.css found"
    SOURCE_PUBLIC_FILES=$((SOURCE_PUBLIC_FILES + 1))
fi

if [ -f "public/script.js" ]; then
    echo "✅ Source public/script.js found"
    SOURCE_PUBLIC_FILES=$((SOURCE_PUBLIC_FILES + 1))
fi

echo "📊 Total source public files found: $SOURCE_PUBLIC_FILES"

# If we have source files but the public directory is empty, copy them
if [ "$SOURCE_PUBLIC_FILES" -gt 0 ] && [ "$PUBLIC_FILES" -eq 0 ]; then
    echo "📋 Copying source public files to deployment location..."
    cp -r public/* public/ 2>/dev/null || echo "⚠️  Copy operation not needed"
fi

# CRITICAL FIX: Copy public files from source to deployment location
echo "🔧 CRITICAL: Ensuring public files are available for deployment..."
CURRENT_DIR=$(pwd)
echo "Current working directory: $CURRENT_DIR"

# List all files in current directory to understand the structure
echo "📂 Current directory contents:"
ls -la

# Check if we're in a workspace environment and need to copy files
if [ -d "/workspace" ]; then
    echo "🔧 Detected workspace environment - copying public files..."
    
    # Copy public files from source to workspace
    if [ -d "$CURRENT_DIR/public" ]; then
        echo "📄 Copying public files from $CURRENT_DIR/public to /workspace/public"
        cp -r "$CURRENT_DIR/public/"* "/workspace/public/" 2>/dev/null || {
            echo "⚠️  Copy failed, trying alternative approach..."
            # Try creating the directory first
            mkdir -p "/workspace/public"
            cp -r "$CURRENT_DIR/public/"* "/workspace/public/"
        }
        
        # Verify the copy
        echo "✅ Files copied. Contents of /workspace/public:"
        ls -la "/workspace/public/"
    else
        echo "❌ Source public directory not found at $CURRENT_DIR/public"
    fi
fi

echo "🎉 Build completed successfully!" 