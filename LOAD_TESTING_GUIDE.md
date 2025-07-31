# 🚀 CrateMatch Load Testing Guide

This guide will help you load test your CrateMatch server to ensure it can handle the expected traffic and identify performance bottlenecks.

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **Your CrateMatch server** running and accessible
3. **Test environment** (don't test on production initially)

## 🛠️ Setup

### 1. Install Dependencies

```bash
# Copy the load test files to a separate directory
mkdir cratematch-load-test
cd cratematch-load-test

# Copy the load testing files
cp load-test.js .
cp load-test-package.json package.json

# Install dependencies
npm install
```

### 2. Configure Your Server URL

Edit `load-test.js` and update the `baseURL` in the CONFIG object:

```javascript
const CONFIG = {
  baseURL: "http://your-server-ip:3000", // Update this
  // ... rest of config
};
```

## 🎯 Test Scenarios

### Light Load Test (Development)

```bash
npm run test:light
# 10 concurrent users for 1 minute
```

### Medium Load Test (Staging)

```bash
npm run test:medium
# 50 concurrent users for 5 minutes
```

### Heavy Load Test (Production Prep)

```bash
npm run test:heavy
# 100 concurrent users for 10 minutes
```

### Stress Test (Breaking Point)

```bash
npm run test:stress
# 200 concurrent users for 15 minutes
```

## 📊 What Gets Tested

### 1. **Homepage Access** (30% of traffic)

- Landing page load times
- Static asset delivery
- SEO performance

### 2. **Authentication** (20% of traffic)

- User signup/signin
- Session management
- Auth token validation

### 3. **App Interface** (40% of traffic)

- Main app page loads
- UI responsiveness
- Client-side performance

### 4. **Playlist Processing** (10% of traffic)

- Spotify API integration
- Serato database matching
- SSE (Server-Sent Events) performance

## 📈 Understanding Results

### Key Metrics

- **Success Rate**: Should be >95% for production
- **Response Times**:
  - Average: <1s for most requests
  - P95: <3s for critical paths
  - P99: <5s for all requests
- **Requests/sec**: Depends on your server capacity

### Performance Targets

| Metric            | Target | Warning  | Critical |
| ----------------- | ------ | -------- | -------- |
| Success Rate      | >99%   | 95-99%   | <95%     |
| Avg Response Time | <500ms | 500ms-1s | >1s      |
| P95 Response Time | <2s    | 2-5s     | >5s      |
| Requests/sec      | >50    | 20-50    | <20      |

## 🔧 Custom Test Configurations

### Test Specific Endpoints

```bash
# Test only homepage
node load-test.js --users 25 --duration 120 --url http://localhost:3000

# Test production server
node load-test.js --users 100 --duration 600 --url https://your-domain.com
```

### Environment Variables

```bash
# Set custom configuration
export BASE_URL="https://your-server.com"
export CONCURRENT_USERS=75
export TEST_DURATION=300
node load-test.js
```

## 🚨 Monitoring During Tests

### Server Metrics to Watch

1. **CPU Usage**

   ```bash
   # On your server
   htop
   # or
   top
   ```

2. **Memory Usage**

   ```bash
   # Check memory
   free -h
   # or
   cat /proc/meminfo
   ```

3. **Network I/O**

   ```bash
   # Monitor network
   iftop
   # or
   nethogs
   ```

4. **Disk I/O**
   ```bash
   # Check disk usage
   iostat -x 1
   # or
   iotop
   ```

### Application Logs

```bash
# Monitor your app logs
pm2 logs cratematch
# or
tail -f /var/log/cratematch/app.log
```

## 🐛 Troubleshooting Common Issues

### High Error Rates

1. **Check server logs** for specific error messages
2. **Verify database connections** aren't being exhausted
3. **Check memory usage** - server might be running out of RAM
4. **Monitor CPU** - server might be CPU-bound

### Slow Response Times

1. **Database queries** - check for slow queries
2. **External API calls** - Spotify API rate limits
3. **File I/O** - database file access patterns
4. **Network latency** - server location vs test location

### Server Crashes

1. **Memory leaks** - check for growing memory usage
2. **Connection limits** - increase max connections
3. **Process limits** - check ulimit settings
4. **Resource exhaustion** - monitor all system resources

## 📋 Pre-Test Checklist

- [ ] Server is running and accessible
- [ ] Database is properly configured
- [ ] External APIs (Spotify) are working
- [ ] Monitoring tools are set up
- [ ] Test environment is isolated
- [ ] Backup of production data (if testing production)

## 🔄 Continuous Load Testing

### Automated Testing

Create a cron job for regular testing:

```bash
# Add to crontab
0 */6 * * * cd /path/to/load-test && npm run test:medium >> load-test.log 2>&1
```

### CI/CD Integration

Add to your deployment pipeline:

```yaml
# Example GitHub Actions step
- name: Load Test
  run: |
    cd load-test
    npm install
    npm run test:light
```

## 📊 Performance Optimization Tips

### Based on Load Test Results

1. **If CPU is the bottleneck:**

   - Optimize database queries
   - Add caching (Redis)
   - Use worker threads for heavy operations

2. **If memory is the bottleneck:**

   - Implement connection pooling
   - Add memory limits to processes
   - Optimize data structures

3. **If network is the bottleneck:**

   - Use CDN for static assets
   - Implement compression
   - Optimize API responses

4. **If disk I/O is the bottleneck:**
   - Use SSD storage
   - Implement database indexing
   - Cache frequently accessed data

## 🎯 Load Testing Best Practices

1. **Start Small**: Begin with light load tests
2. **Gradual Increase**: Ramp up load gradually
3. **Monitor Everything**: Watch all system metrics
4. **Test Realistic Scenarios**: Use real user behavior patterns
5. **Document Results**: Keep records of all test runs
6. **Test Regularly**: Run tests after major changes
7. **Test in Production-like Environment**: Use similar hardware/config

## 🚀 Scaling Recommendations

### Based on Load Test Results

| Concurrent Users | Recommended Server Specs |
| ---------------- | ------------------------ |
| 10-50            | 2 CPU, 4GB RAM, SSD      |
| 50-100           | 4 CPU, 8GB RAM, SSD      |
| 100-200          | 8 CPU, 16GB RAM, SSD     |
| 200+             | Consider load balancing  |

### Horizontal Scaling

For high traffic, consider:

- Load balancer (nginx/haproxy)
- Multiple application instances
- Database read replicas
- Redis for session storage
- CDN for static assets

## 📞 Support

If you encounter issues during load testing:

1. Check the server logs first
2. Review the performance metrics
3. Compare with baseline results
4. Document the issue with specific details
5. Consider the recommendations above

---

**Remember**: Load testing is an iterative process. Start conservatively and gradually increase load while monitoring your system's behavior.
