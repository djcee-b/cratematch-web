#!/bin/bash

# NPM Authentication Setup Script
# This script sets up proper authentication for @musiclibrarytools packages

set -e

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

echo "🔑 Setting up NPM authentication for GitHub packages..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# Check if NPM_TOKEN is set
if [ -z "$NPM_TOKEN" ]; then
    print_warning "NPM_TOKEN environment variable is not set"
    echo ""
    echo "Please set your GitHub Personal Access Token:"
    echo "export NPM_TOKEN=your_github_token_here"
    echo ""
    echo "Or add it to your .env file:"
    echo "NPM_TOKEN=your_github_token_here"
    echo ""
    read -p "Do you want to set it now? (y/n): " -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Enter your GitHub Personal Access Token:"
        read -s NPM_TOKEN
        export NPM_TOKEN
        echo "Token set for this session"
    else
        print_error "NPM_TOKEN is required to install @musiclibrarytools packages"
        exit 1
    fi
fi

# Create proper .npmrc file
print_status "Creating .npmrc file..."
cat > .npmrc << EOF
registry=https://registry.npmjs.org/
@musiclibrarytools:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=\${NPM_TOKEN}
EOF

# Set proper permissions
chmod 600 .npmrc

# Test the configuration
print_status "Testing npm configuration..."
npm config list

# Test package access
print_status "Testing access to @musiclibrarytools packages..."
npm view @musiclibrarytools/mlt.js --json > /dev/null 2>&1 && {
    print_status "✅ Successfully authenticated with GitHub packages!"
} || {
    print_error "❌ Failed to authenticate with GitHub packages"
    echo ""
    echo "Please check:"
    echo "1. Your GitHub token has 'read:packages' permission"
    echo "2. The token is valid and not expired"
    echo "3. You have access to the @musiclibrarytools organization"
    exit 1
}

print_status "NPM authentication setup complete!"
echo ""
echo "You can now run: npm install" 