# Load Testing Guide for CrateMatch Web

This guide provides comprehensive load testing tools and strategies for your CrateMatch Web server to ensure it can handle expected traffic levels.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Your Server

```bash
npm start
```

### 3. Run Load Tests

Choose from the following options:

#### Simple Load Test (Recommended for beginners)

```bash
npm run load-test-simple
```

#### Comprehensive Load Test (Full authentication testing)

```bash
npm run load-test
```

#### Apache Bench Load Test (Standard tool)

```bash
npm run load-test-apache
```

#### WRK Load Test (High-performance tool)

```bash
npm run load-test-wrk
```

#### Run All Tests

```bash
npm run load-test-all
```

## 📊 Load Testing Tools

### 1. Simple Load Test (`load-test-simple.js`)

**Best for:** Quick performance checks and basic stress testing

**Features:**

- Tests static pages only
- No authentication required
- Configurable requests per second
- Real-time progress updates

**Configuration:**

```bash
# Environment variables
BASE_URL=http://localhost:3000
DURATION=30          # Test duration in seconds
RPS=10              # Requests per second
```

**Usage:**

```bash
# Basic test
npm run load-test-simple

# Custom configuration
DURATION=60 RPS=50 npm run load-test-simple
```

### 2. Comprehensive Load Test (`load-test.js`)

**Best for:** Real-world scenario testing with authentication

**Features:**

- Tests all endpoints including authenticated ones
- Simulates real user behavior
- Handles authentication automatically
- Tests file uploads and heavy operations
- Weighted scenario distribution

**Configuration:**

```bash
# Environment variables
BASE_URL=http://localhost:3000
TEST_DURATION=60           # Test duration in seconds
CONCURRENT_USERS=10        # Number of concurrent users
RAMP_UP_TIME=10           # Time to ramp up to full load
TEST_EMAIL=loadtest@example.com
TEST_PASSWORD=loadtest123
```

**Usage:**

```bash
# Basic test
npm run load-test

# High load test
CONCURRENT_USERS=50 TEST_DURATION=120 npm run load-test
```

### 3. Apache Bench (`load-test-apache-bench.sh`)

**Best for:** Standard HTTP benchmarking

**Features:**

- Industry standard tool
- Detailed latency analysis
- CSV and gnuplot output
- Stress and spike testing

**Installation:**

```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install httpd

# CentOS/RHEL
sudo yum install httpd-tools
```

**Configuration:**

```bash
# Environment variables
BASE_URL=http://localhost:3000
CONCURRENT_USERS=10
TOTAL_REQUESTS=1000
TEST_DURATION=60
```

**Usage:**

```bash
# Make script executable
chmod +x load-test-apache-bench.sh

# Run test
npm run load-test-apache
```

### 4. WRK (`load-test-wrk.sh`)

**Best for:** High-performance load testing

**Features:**

- Extremely fast and efficient
- Custom Lua scripting support
- Detailed latency distribution
- Memory leak detection

**Installation:**

```bash
# Ubuntu/Debian
sudo apt-get install wrk

# macOS
brew install wrk

# Or build from source
git clone https://github.com/wg/wrk.git
cd wrk && make
```

**Configuration:**

```bash
# Environment variables
BASE_URL=http://localhost:3000
CONCURRENT_CONNECTIONS=10
THREADS=2
TEST_DURATION=30
REQUESTS_PER_SECOND=100
```

**Usage:**

```bash
# Make script executable
chmod +x load-test-wrk.sh

# Run test
npm run load-test-wrk
```

## 📈 Understanding Results

### Key Metrics to Monitor

#### Response Times

- **Average**: Overall performance indicator
- **Median**: Typical response time
- **95th Percentile**: 95% of requests complete within this time
- **99th Percentile**: 99% of requests complete within this time

#### Throughput

- **Requests per Second (RPS)**: How many requests your server can handle
- **Concurrent Users**: How many simultaneous users your server supports

#### Error Rates

- **Success Rate**: Percentage of successful requests
- **Error Distribution**: Types and frequency of errors

### Performance Benchmarks

#### Good Performance

- Average response time: < 500ms
- 95th percentile: < 1s
- Success rate: > 99%
- RPS: > 100 (for typical web apps)

#### Warning Signs

- Average response time: > 2s
- 95th percentile: > 5s
- Success rate: < 95%
- Increasing response times under load

## 🔧 Server Optimization Tips

### 1. Database Optimization

```javascript
// Add connection pooling to your Supabase client
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(url, key, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: false, // For server-side usage
  },
});
```

### 2. Caching Strategy

```javascript
// Add Redis caching for frequently accessed data
const redis = require("redis");
const client = redis.createClient();

// Cache user data
async function getUserWithCache(userId) {
  const cached = await client.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await getUserFromDB(userId);
  await client.setex(`user:${userId}`, 3600, JSON.stringify(user));
  return user;
}
```

### 3. Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});

app.use("/api/", limiter);
```

### 4. File Upload Optimization

```javascript
// Use streaming for large file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
});
```

## 🚨 Common Issues and Solutions

### High Response Times

**Symptoms:** Average response time > 2s
**Solutions:**

- Optimize database queries
- Add caching layer
- Use connection pooling
- Consider CDN for static assets

### Memory Leaks

**Symptoms:** Increasing memory usage over time
**Solutions:**

- Check for unclosed database connections
- Monitor file handle leaks
- Use memory profiling tools
- Implement proper cleanup

### Connection Timeouts

**Symptoms:** Requests timing out under load
**Solutions:**

- Increase connection pool size
- Optimize request processing
- Add request queuing
- Consider horizontal scaling

### Database Bottlenecks

**Symptoms:** High database response times
**Solutions:**

- Add database indexes
- Optimize queries
- Use read replicas
- Implement query caching

## 📋 Load Testing Checklist

### Before Testing

- [ ] Server is running and accessible
- [ ] Database is properly configured
- [ ] Test data is available
- [ ] Monitoring tools are set up
- [ ] Backup of production data

### During Testing

- [ ] Monitor CPU usage
- [ ] Monitor memory usage
- [ ] Monitor disk I/O
- [ ] Monitor network usage
- [ ] Check error logs
- [ ] Monitor database performance

### After Testing

- [ ] Analyze response time distribution
- [ ] Review error rates and types
- [ ] Check for memory leaks
- [ ] Document performance bottlenecks
- [ ] Plan optimization strategies

## 🛠️ Advanced Testing Scenarios

### 1. Spike Testing

Test how your server handles sudden traffic spikes:

```bash
# Run spike test with WRK
wrk -t2 -c100 -d10s -R1000 http://localhost:3000/
```

### 2. Soak Testing

Test for memory leaks over extended periods:

```bash
# Run 30-minute soak test
TEST_DURATION=1800 npm run load-test-simple
```

### 3. Stress Testing

Find your server's breaking point:

```bash
# Gradually increase load until failure
for i in 10 50 100 200 500; do
  CONCURRENT_USERS=$i npm run load-test
done
```

### 4. Endurance Testing

Test stability over long periods:

```bash
# Run 2-hour endurance test
TEST_DURATION=7200 CONCURRENT_USERS=20 npm run load-test
```

## 📊 Monitoring and Alerting

### Recommended Monitoring Tools

- **Application Performance Monitoring (APM)**: New Relic, DataDog, AppDynamics
- **Server Monitoring**: Prometheus, Grafana, Nagios
- **Database Monitoring**: pgAdmin, MongoDB Compass
- **Log Aggregation**: ELK Stack, Splunk, Papertrail

### Key Metrics to Monitor

- Response time percentiles
- Error rates
- Throughput (RPS)
- Resource utilization (CPU, memory, disk)
- Database connection pool usage
- Cache hit rates

## 🎯 Performance Targets

Based on your application type, here are recommended performance targets:

### Web Application (CrateMatch)

- **Average Response Time**: < 500ms
- **95th Percentile**: < 1s
- **99th Percentile**: < 2s
- **Success Rate**: > 99.5%
- **Concurrent Users**: 100+
- **Requests per Second**: 200+

### File Processing Operations

- **Upload Response Time**: < 5s (for 50MB files)
- **Processing Time**: < 30s (for typical playlists)
- **Concurrent Uploads**: 10+
- **Success Rate**: > 98%

## 📞 Getting Help

If you encounter issues during load testing:

1. Check the server logs for errors
2. Monitor system resources during testing
3. Review the error distribution in test results
4. Consider running tests with lower load first
5. Verify all dependencies are properly installed

For additional support, refer to:

- [Express.js Performance Best Practices](https://expressjs.com/en/advanced/best-practices-performance.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/performance/)
- [Supabase Performance Optimization](https://supabase.com/docs/guides/performance)
