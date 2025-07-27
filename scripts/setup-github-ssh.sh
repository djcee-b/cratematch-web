#!/bin/bash

# GitHub SSH Key Setup Script for DigitalOcean Droplet
# Run this script on your droplet to set up SSH access to GitHub

set -e

echo "🔑 Setting up SSH key for GitHub access..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if SSH key already exists
if [ -f ~/.ssh/id_ed25519 ]; then
    print_warning "SSH key already exists at ~/.ssh/id_ed25519"
    echo "Do you want to create a new one? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Using existing SSH key..."
        cat ~/.ssh/id_ed25519.pub
        exit 0
    fi
fi

# Generate SSH key
print_status "Generating new SSH key..."
ssh-keygen -t ed25519 -C "cratematch-droplet@$(hostname)" -f ~/.ssh/id_ed25519 -N ""

# Start SSH agent and add key
print_status "Starting SSH agent and adding key..."
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Display the public key
print_status "Your SSH public key:"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""

print_warning "IMPORTANT: Copy the public key above and add it to your GitHub account:"
echo ""
echo "1. Go to GitHub.com → Settings → SSH and GPG keys"
echo "2. Click 'New SSH key'"
echo "3. Give it a title like 'CrateMatch Droplet'"
echo "4. Paste the public key above"
echo "5. Click 'Add SSH key'"
echo ""

# Test GitHub connection (optional)
echo "Would you like to test the GitHub connection? (y/n)"
read -r test_response
if [[ "$test_response" =~ ^[Yy]$ ]]; then
    print_status "Testing GitHub SSH connection..."
    ssh -T git@github.com || true
    echo ""
    print_status "If you see 'Hi username! You've successfully authenticated...' then it's working!"
fi

print_status "SSH key setup complete!" 