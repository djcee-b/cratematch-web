#!/bin/bash

# GitHub Actions Digital Ocean Deployment Setup Script
# This script helps you set up the necessary secrets and SSH keys for automated deployment

set -e

echo "🚀 Setting up GitHub Actions deployment to Digital Ocean Droplet..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running on macOS/Linux
if [[ "$OSTYPE" != "linux-gnu"* && "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS and Linux systems."
    exit 1
fi

print_step "Step 1: Generate SSH Key Pair for GitHub Actions"
echo ""

# Check if SSH key already exists
if [ -f ~/.ssh/github_actions_deploy ]; then
    print_warning "SSH key already exists at ~/.ssh/github_actions_deploy"
    read -p "Do you want to generate a new one? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f ~/.ssh/github_actions_deploy*
    else
        print_status "Using existing SSH key"
    fi
fi

# Generate SSH key if it doesn't exist
if [ ! -f ~/.ssh/github_actions_deploy ]; then
    print_status "Generating new SSH key pair..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_deploy -N "" -C "github-actions-deploy"
    print_status "SSH key generated successfully!"
fi

print_step "Step 2: Add SSH Key to Digital Ocean Droplet"
echo ""

# Get droplet details
read -p "Enter your Digital Ocean droplet IP address: " DROPLET_IP
read -p "Enter your droplet username (usually 'root' or your username): " DROPLET_USER
read -p "Enter your droplet SSH port (default: 22): " DROPLET_PORT
DROPLET_PORT=${DROPLET_PORT:-22}

print_status "Adding SSH key to droplet..."
print_warning "You'll need to enter your droplet password or use your existing SSH key"

# Copy the public key to the droplet
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP

print_status "SSH key added to droplet successfully!"

print_step "Step 3: Test SSH Connection"
echo ""

print_status "Testing SSH connection..."
if ssh -i ~/.ssh/github_actions_deploy -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP "echo 'SSH connection successful!'"; then
    print_status "✅ SSH connection test passed!"
else
    print_error "❌ SSH connection test failed!"
    print_warning "Please check your droplet IP, username, and port settings"
    exit 1
fi

print_step "Step 4: Set Up GitHub Repository Secrets"
echo ""

print_status "You need to add the following secrets to your GitHub repository:"
echo ""
echo "Go to: https://github.com/YOUR_USERNAME/MLT-CrateMatch-Web/settings/secrets/actions"
echo ""

# Display the private key content
print_status "Copy this private key content to the DROPLET_SSH_KEY secret:"
echo ""
echo "=== PRIVATE KEY (DROPLET_SSH_KEY) ==="
cat ~/.ssh/github_actions_deploy
echo "=== END PRIVATE KEY ==="
echo ""

# Display other required secrets
echo "=== REQUIRED GITHUB SECRETS ==="
echo ""
echo "DROPLET_HOST: $DROPLET_IP"
echo "DROPLET_USER: $DROPLET_USER"
echo "DROPLET_PORT: $DROPLET_PORT"
echo "DROPLET_SSH_KEY: [The private key content above]"
echo "NPM_TOKEN: [Your npm authentication token for private packages]"
echo ""

print_step "Step 5: Verify Droplet Setup"
echo ""

print_status "Checking if your droplet has the required setup..."

# Check if the app directory exists
if ssh -i ~/.ssh/github_actions_deploy -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP "[ -d /var/www/cratematch ]"; then
    print_status "✅ App directory exists"
else
    print_warning "❌ App directory /var/www/cratematch does not exist"
    print_warning "Please run the initial droplet setup first:"
    echo "ssh $DROPLET_USER@$DROPLET_IP"
    echo "cd /var/www/cratematch"
    echo "git clone https://github.com/YOUR_USERNAME/MLT-CrateMatch-Web.git ."
fi

# Check if PM2 is installed
if ssh -i ~/.ssh/github_actions_deploy -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP "command -v pm2 >/dev/null 2>&1"; then
    print_status "✅ PM2 is installed"
else
    print_warning "❌ PM2 is not installed"
    print_warning "Please install PM2 on your droplet:"
    echo "ssh $DROPLET_USER@$DROPLET_IP"
    echo "sudo npm install -g pm2"
fi

# Check if Node.js is installed
if ssh -i ~/.ssh/github_actions_deploy -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP "command -v node >/dev/null 2>&1"; then
    NODE_VERSION=$(ssh -i ~/.ssh/github_actions_deploy -p $DROPLET_PORT $DROPLET_USER@$DROPLET_IP "node --version")
    print_status "✅ Node.js is installed: $NODE_VERSION"
else
    print_warning "❌ Node.js is not installed"
    print_warning "Please install Node.js on your droplet"
fi

print_step "Step 6: Final Instructions"
echo ""

print_status "Setup completed! Here's what you need to do next:"
echo ""
echo "1. Add the GitHub secrets listed above to your repository"
echo "2. Make sure your droplet has the initial setup completed"
echo "3. Push to your main branch to trigger the first deployment"
echo ""
echo "To test the deployment:"
echo "git push origin main"
echo ""
echo "To manually trigger deployment:"
echo "Go to Actions tab → Deploy to Digital Ocean Droplet → Run workflow"
echo ""
print_status "🎉 GitHub Actions deployment setup is complete!" 