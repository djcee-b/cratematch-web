# Deploying CrateMatch to DigitalOcean Droplet

## Step 1: Create a Droplet

1. **Log into DigitalOcean** and go to the Droplets section
2. **Click "Create" → "Droplets"**
3. **Choose your configuration:**
   - **Choose an image:** Ubuntu 22.04 (LTS) x64
   - **Choose a plan:** Basic (Shared CPU)
   - **Choose a plan type:** Regular with SSD
   - **Choose a datacenter region:** Choose closest to your users
   - **Choose authentication method:** SSH key (recommended) or Password
   - **Finalize and create**

## Step 2: Connect to Your Droplet

```bash
# Replace YOUR_DROPLET_IP with your actual droplet IP
ssh root@YOUR_DROPLET_IP
```

## Step 3: Set Up the Server Environment

```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Install UFW firewall
sudo apt install ufw -y
```

## Step 4: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 5: Clone Your Repository

```bash
# Create a directory for your app
mkdir -p /var/www/cratematch
cd /var/www/cratematch

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/MLT-CrateMatch-Web.git .

# Install dependencies
npm install
```

## Step 6: Set Up Environment Variables

```bash
# Copy your environment file
cp env.example .env

# Edit the environment file with your actual values
nano .env
```

Make sure to set all your environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PORT=3000`

## Step 7: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cratematch
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Important for SSE
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/cratematch /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 8: Set Up PM2 Process Manager

```bash
# Navigate to your app directory
cd /var/www/cratematch

# Start your app with PM2
pm2 start server.js --name "cratematch"

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

## Step 9: Set Up SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d YOUR_DOMAIN.com
```

## Step 10: Test Your Deployment

1. Visit your droplet's IP address or domain
2. Test the SSE functionality by processing a playlist
3. Check logs if needed: `pm2 logs cratematch`

## Troubleshooting

### Check if your app is running:

```bash
pm2 status
pm2 logs cratematch
```

### Check Nginx logs:

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart services if needed:

```bash
pm2 restart cratematch
sudo systemctl restart nginx
```

## Updating Your App

```bash
cd /var/www/cratematch
git pull
npm install
pm2 restart cratematch
```

## Important Notes

1. **SSE Support**: Droplets provide full support for Server-Sent Events, unlike App Platform
2. **Persistence**: Your app will keep running even after you disconnect from SSH
3. **Monitoring**: Use `pm2 monit` to monitor your app's performance
4. **Backups**: Consider setting up regular backups of your app data
5. **Domain**: Point your domain's A record to your droplet's IP address
