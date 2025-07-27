#!/bin/bash

# Deployment setup script for CrateMatch Web
# This script handles npm registry issues and ensures proper installation

echo "Setting up deployment environment..."

# Clear npm cache
npm cache clean --force

# Set npm registry explicitly
npm config set registry https://registry.npmjs.org/

# Install dependencies with retry mechanism
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $((RETRY_COUNT + 1)) of $MAX_RETRIES to install dependencies..."
    
    if npm install --no-optional --production=false; then
        echo "Dependencies installed successfully!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "Installation failed. Retrying in 10 seconds..."
            sleep 10
            npm cache clean --force
        else
            echo "All installation attempts failed. Exiting."
            exit 1
        fi
    fi
done

echo "Deployment setup completed successfully!" 