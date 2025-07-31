# GitHub Actions Deployment to Digital Ocean Droplet

This guide will help you set up automated deployment from GitHub to your Digital Ocean droplet using GitHub Actions.

## 🚀 Quick Start

1. **Run the setup script:**

   ```bash
   ./scripts/setup-github-deploy.sh
   ```

2. **Add GitHub secrets** (the script will show you exactly what to add)

3. **Push to main branch** to trigger your first deployment

## 📋 Prerequisites

- A Digital Ocean droplet with your app already set up
- SSH access to your droplet
- GitHub repository with your code

## 🔧 Detailed Setup Process

### Step 1: Initial Droplet Setup

Make sure your droplet has the basic setup completed:

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Run the deployment script
cd /var/www/cratematch
bash scripts/deploy-droplet.sh
```

### Step 2: Generate SSH Keys for GitHub Actions

The setup script will automatically:

- Generate a new SSH key pair for GitHub Actions
- Add the public key to your droplet
- Test the SSH connection
- Show you the private key to add to GitHub secrets

### Step 3: Configure GitHub Secrets

Go to your GitHub repository: `Settings` → `Secrets and variables` → `Actions`

Add these secrets:

| Secret Name       | Value                   | Description                   |
| ----------------- | ----------------------- | ----------------------------- |
| `DROPLET_HOST`    | `YOUR_DROPLET_IP`       | Your droplet's IP address     |
| `DROPLET_USER`    | `root` or your username | SSH username for your droplet |
| `DROPLET_PORT`    | `22`                    | SSH port (usually 22)         |
| `DROPLET_SSH_KEY` | Private key content     | The private SSH key content   |

### Step 4: Test the Deployment

```bash
# Push to main branch to trigger deployment
git push origin main

# Or manually trigger from GitHub Actions tab
```

## 🔄 How the Deployment Works

The GitHub Action workflow (`.github/workflows/deploy.yml`) does the following:

1. **Triggers on:**

   - Push to `main` or `master` branch
   - Manual workflow dispatch

2. **Builds the application:**

   - Checks out code
   - Installs dependencies
   - Runs build process

3. **Deploys to droplet:**

   - Connects via SSH
   - Pulls latest changes
   - Installs production dependencies
   - Restarts the application with PM2
   - Verifies the deployment

4. **Verification:**
   - Checks if the application is responding
   - Shows deployment status

## 🛠️ Manual Deployment Commands

If you need to deploy manually:

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Navigate to app directory
cd /var/www/cratematch

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --production

# Restart application
pm2 restart cratematch

# Check status
pm2 status
pm2 logs cratematch
```

## 🔍 Troubleshooting

### Common Issues

1. **SSH Connection Failed**

   - Check your droplet IP and SSH port
   - Verify the SSH key is properly added to GitHub secrets
   - Test SSH connection manually

2. **Deployment Fails**

   - Check PM2 logs: `pm2 logs cratematch`
   - Verify environment variables are set
   - Check if the app directory exists

3. **Application Not Responding**
   - Check if PM2 process is running: `pm2 status`
   - Check application logs: `pm2 logs cratematch`
   - Verify Nginx configuration

### Useful Commands

```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs cratematch

# Monitor application
pm2 monit

# Restart application
pm2 restart cratematch

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 🔐 Security Considerations

1. **SSH Key Security:**

   - Use a dedicated SSH key for GitHub Actions
   - Never commit SSH keys to your repository
   - Rotate keys periodically

2. **Environment Variables:**

   - Keep sensitive data in GitHub secrets
   - Use `.env` files on the droplet for local configuration

3. **Firewall:**
   - Only allow necessary ports (22, 80, 443)
   - Use UFW or similar firewall

## 📈 Monitoring and Maintenance

### Health Checks

The deployment includes automatic health checks:

- Verifies PM2 process is running
- Tests application response
- Shows deployment status

### Logs

Monitor your application:

```bash
# Real-time logs
pm2 logs cratematch --lines 100

# Error logs only
pm2 logs cratematch --err

# Monitor resources
pm2 monit
```

### Updates

To update your deployment process:

1. Modify `.github/workflows/deploy.yml`
2. Push changes to trigger a new deployment
3. Monitor the Actions tab for results

## 🎉 Success!

Once set up, every push to your main branch will automatically:

- Build your application
- Deploy to your Digital Ocean droplet
- Restart the application
- Verify the deployment

Your app will be live at `http://YOUR_DROPLET_IP` within minutes of each push!

## 📞 Support

If you encounter issues:

1. Check the GitHub Actions logs
2. Review the troubleshooting section above
3. Check your droplet's PM2 and Nginx logs
4. Verify all GitHub secrets are correctly set
