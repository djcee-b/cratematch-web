#!/bin/bash

# Setup Regular User Script
# Run this as root to create a regular user for deployment

set -e

echo "👤 Setting up regular user for CrateMatch deployment..."

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_warning "This script must be run as root to create a user"
   exit 1
fi

# Create user
USERNAME="cratematch"
print_status "Creating user: $USERNAME"
useradd -m -s /bin/bash $USERNAME

# Add user to sudo group
print_status "Adding user to sudo group..."
usermod -aG sudo $USERNAME

# Set up SSH directory for the user
print_status "Setting up SSH directory..."
mkdir -p /home/$USERNAME/.ssh
chown $USERNAME:$USERNAME /home/$USERNAME/.ssh
chmod 700 /home/$USERNAME/.ssh

# Copy authorized keys if they exist
if [ -f /root/.ssh/authorized_keys ]; then
    print_status "Copying SSH keys..."
    cp /root/.ssh/authorized_keys /home/$USERNAME/.ssh/
    chown $USERNAME:$USERNAME /home/$USERNAME/.ssh/authorized_keys
    chmod 600 /home/$USERNAME/.ssh/authorized_keys
fi

# Set up app directory permissions
print_status "Setting up app directory permissions..."
chown -R $USERNAME:$USERNAME /var/www/cratematch

print_status "User setup complete!"
echo ""
echo "🔑 Next steps:"
echo "1. Switch to the new user: su - $USERNAME"
echo "2. Navigate to app directory: cd /var/www/cratematch"
echo "3. Run the deployment script: ./scripts/deploy-droplet.sh"
echo ""
echo "💡 Or you can SSH directly as the new user:"
echo "ssh $USERNAME@YOUR_DROPLET_IP" 