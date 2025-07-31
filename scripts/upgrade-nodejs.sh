#!/bin/bash

# Upgrade Node.js to version 20 on Digital Ocean Droplet
# Run this script on your droplet if you want to upgrade Node.js manually

set -e

echo "🚀 Upgrading Node.js to version 20..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check current Node.js version
CURRENT_VERSION=$(node --version)
print_status "Current Node.js version: $CURRENT_VERSION"

if [[ "$CURRENT_VERSION" == v20* ]]; then
    print_status "Node.js is already version 20. No upgrade needed."
    exit 0
fi

print_warning "Upgrading Node.js from $CURRENT_VERSION to version 20..."

# Stop PM2 processes if running
if command -v pm2 >/dev/null 2>&1; then
    print_status "Stopping PM2 processes..."
    pm2 stop all || true
fi

# Remove old Node.js
print_status "Removing old Node.js installation..."
sudo apt-get remove -y nodejs npm || true
sudo apt-get autoremove -y || true

# Add NodeSource repository for Node.js 20
print_status "Adding NodeSource repository for Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js 20
print_status "Installing Node.js 20..."
sudo apt-get install -y nodejs

# Verify installation
NEW_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

print_status "Node.js upgraded successfully!"
print_status "New Node.js version: $NEW_VERSION"
print_status "New npm version: $NPM_VERSION"

# Restart PM2 processes if they were running
if command -v pm2 >/dev/null 2>&1; then
    print_status "Restarting PM2 processes..."
    pm2 start all || true
    pm2 save || true
fi

print_status "✅ Node.js upgrade completed successfully!" 