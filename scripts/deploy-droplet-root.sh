#!/bin/bash

# CrateMatch Droplet Deployment Script (Root Version)
# Run this script on your DigitalOcean Droplet as root

set -e

echo "🚀 Starting CrateMatch deployment to Droplet (Root Mode)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

print_warning "Running as root - this is less secure but will work for deployment"

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Install PM2 globally
print_status "Installing PM2 process manager..."
npm install -g pm2

# Install Nginx
print_status "Installing Nginx..."
apt install nginx -y

# Install Git
print_status "Installing Git..."
apt install git -y

# Install UFW firewall
print_status "Installing UFW firewall..."
apt install ufw -y

# Configure firewall
print_status "Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Create app directory
print_status "Setting up application directory..."
mkdir -p /var/www/cratematch
cd /var/www/cratematch

# Check if repository already exists
if [ -d ".git" ]; then
    print_status "Repository already exists, pulling latest changes..."
    git pull
else
    print_warning "Please clone your repository manually:"
    echo "git clone https://github.com/YOUR_USERNAME/MLT-CrateMatch-Web.git ."
    echo "Then run this script again."
    exit 1
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
print_status "Setting up npm authentication for private packages..."
./scripts/setup-npm-auth.sh
print_status "Installing dependencies..."
npm install

# Set up environment file
if [ ! -f ".env" ]; then
    print_status "Creating environment file..."
    cp env.example .env
    print_warning "Please edit .env file with your actual environment variables:"
    echo "nano .env"
    echo ""
    echo "Required variables:"
    echo "- SUPABASE_URL"
    echo "- SUPABASE_ANON_KEY"
    echo "- STRIPE_SECRET_KEY"
    echo "- STRIPE_WEBHOOK_SECRET"
    echo "- PORT=3000"
    echo ""
    read -p "Press Enter after you've configured the environment variables..."
else
    print_status "Environment file already exists"
fi

# Create Nginx configuration
print_status "Creating Nginx configuration..."
tee /etc/nginx/sites-available/cratematch > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Important for SSE
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/cratematch /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_status "Testing Nginx configuration..."
nginx -t

# Restart Nginx
print_status "Restarting Nginx..."
systemctl restart nginx

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start server.js --name "cratematch"

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
print_status "Setting up PM2 to start on boot..."
pm2 startup

print_status "Deployment completed successfully!"
echo ""
echo "🎉 Your CrateMatch app should now be running!"
echo ""
echo "📋 Next steps:"
echo "1. Visit your droplet's IP address in a browser"
echo "2. Test the SSE functionality by processing a playlist"
echo "3. Set up SSL certificate if you have a domain:"
echo "   apt install certbot python3-certbot-nginx -y"
echo "   certbot --nginx -d YOUR_DOMAIN.com"
echo ""
echo "🔧 Useful commands:"
echo "- Check app status: pm2 status"
echo "- View logs: pm2 logs cratematch"
echo "- Restart app: pm2 restart cratematch"
echo "- Monitor app: pm2 monit"
echo ""
echo "🌐 Your app should be accessible at: http://$(curl -s ifconfig.me)" 