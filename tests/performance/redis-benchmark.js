#!/usr/bin/env node
// Redis Cache Performance Benchmark for Enterprise Asset Tracker
// Tests cache hit ratios, latency, and throughput under realistic load

const Redis = require('ioredis');
const { performance } = require('perf_hooks');

class RedisBenchmark {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });
    
    this.results = {
      totalOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      latencies: [],
      errors: 0,
      throughput: 0,
    };
  }

  async connect() {
    try {
      await this.redis.connect();
      console.log('✅ Connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      throw error;
    }
  }

  async warmupCache() {
    console.log('🔥 Warming up cache with realistic data...');
    
    // Simulate asset data caching
    const assetKeys = [];
    for (let i = 1; i <= 10000; i++) {
      const key = `asset:${i}`;
      const asset = JSON.stringify({
        id: i,
        name: `Asset-${i}`,
        type: ['Laptop', 'Printer', 'Desk', 'Phone'][i % 4],
        location: `Floor-${Math.ceil(i / 1000)}`,
        status: 'active',
        lastUpdated: new Date().toISOString(),
        metadata: {
          serialNumber: `SN${i.toString().padStart(6, '0')}`,
          purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          warranty: 'active'
        }
      });
      
      await this.redis.setex(key, 3600, asset); // 1 hour TTL
      assetKeys.push(key);
    }

    // Cache user session data
    for (let i = 1; i <= 1000; i++) {
      const sessionKey = `session:${i}`;
      const session = JSON.stringify({
        userId: i,
        role: ['admin', 'manager', 'operator', 'viewer'][i % 4],
        permissions: ['read', 'write', 'delete'],
        lastAccess: new Date().toISOString(),
        tenantId: Math.ceil(i / 100)
      });
      
      await this.redis.setex(sessionKey, 1800, session); // 30 minutes TTL
    }

    // Cache frequently accessed queries
    for (let i = 1; i <= 100; i++) {
      const queryKey = `query:assets:location:${i}`;
      const queryResult = JSON.stringify({
        totalCount: Math.floor(Math.random() * 1000),
        assets: Array.from({ length: 20 }, (_, idx) => ({
          id: idx + i * 20,
          name: `Asset-${idx + i * 20}`,
          location: `Floor-${i}`
        }))
      });
      
      await this.redis.setex(queryKey, 600, queryResult); // 10 minutes TTL
    }

    console.log('✅ Cache warmed up with 11,100 keys');
    return assetKeys;
  }

  async benchmarkOperations(duration = 300000) { // 5 minutes
    console.log(`🚀 Running Redis benchmark for ${duration/1000} seconds...`);
    
    const startTime = performance.now();
    const endTime = startTime + duration;
    let operationCount = 0;

    while (performance.now() < endTime) {
      const operations = await Promise.all([
        this.benchmarkGetOperation(),
        this.benchmarkSetOperation(),
        this.benchmarkListOperation(),
        this.benchmarkHashOperation(),
        this.benchmarkSearchOperation(),
      ]);

      operations.forEach(result => {
        if (result) {
          this.results.totalOperations++;
          if (result.latency) this.results.latencies.push(result.latency);
          if (result.hit) this.results.cacheHits++;
          if (result.miss) this.results.cacheMisses++;
          if (result.error) this.results.errors++;
        }
      });

      operationCount += operations.length;
    }

    const totalTime = performance.now() - startTime;
    this.results.throughput = (operationCount / totalTime) * 1000; // ops/sec
    
    console.log(`✅ Completed ${operationCount} operations in ${(totalTime/1000).toFixed(2)} seconds`);
  }

  async benchmarkGetOperation() {
    const start = performance.now();
    try {
      // 80% chance of hitting existing keys (realistic cache hit ratio)
      const assetId = Math.random() < 0.8 
        ? Math.floor(Math.random() * 10000) + 1 
        : Math.floor(Math.random() * 100000) + 10001;
      
      const key = `asset:${assetId}`;
      const result = await this.redis.get(key);
      const latency = performance.now() - start;
      
      return {
        latency,
        hit: result !== null,
        miss: result === null,
      };
    } catch (error) {
      return { error: true, latency: performance.now() - start };
    }
  }

  async benchmarkSetOperation() {
    const start = performance.now();
    try {
      const assetId = Math.floor(Math.random() * 1000) + 20000;
      const key = `temp:asset:${assetId}`;
      const asset = JSON.stringify({
        id: assetId,
        name: `TempAsset-${assetId}`,
        timestamp: Date.now()
      });
      
      await this.redis.setex(key, 300, asset); // 5 minute TTL
      const latency = performance.now() - start;
      
      return { latency };
    } catch (error) {
      return { error: true, latency: performance.now() - start };
    }
  }

  async benchmarkListOperation() {
    const start = performance.now();
    try {
      // Test list operations for real-time notifications/events
      const listKey = 'events:recent';
      const event = JSON.stringify({
        type: 'asset_updated',
        assetId: Math.floor(Math.random() * 10000),
        timestamp: Date.now(),
        userId: Math.floor(Math.random() * 1000)
      });
      
      await this.redis.lpush(listKey, event);
      await this.redis.ltrim(listKey, 0, 99); // Keep latest 100 events
      const latency = performance.now() - start;
      
      return { latency };
    } catch (error) {
      return { error: true, latency: performance.now() - start };
    }
  }

  async benchmarkHashOperation() {
    const start = performance.now();
    try {
      // Test hash operations for user sessions and complex objects
      const userId = Math.floor(Math.random() * 1000) + 1;
      const hashKey = `user:${userId}:stats`;
      
      await this.redis.hincrby(hashKey, 'loginCount', 1);
      await this.redis.hset(hashKey, 'lastLogin', Date.now());
      await this.redis.expire(hashKey, 3600);
      
      const stats = await this.redis.hgetall(hashKey);
      const latency = performance.now() - start;
      
      return { latency, hit: Object.keys(stats).length > 0 };
    } catch (error) {
      return { error: true, latency: performance.now() - start };
    }
  }

  async benchmarkSearchOperation() {
    const start = performance.now();
    try {
      // Test key pattern searching for monitoring/debugging
      const pattern = Math.random() < 0.5 ? 'asset:*' : 'session:*';
      const keys = await this.redis.keys(pattern);
      const latency = performance.now() - start;
      
      return { latency, hit: keys.length > 0 };
    } catch (error) {
      return { error: true, latency: performance.now() - start };
    }
  }

  calculateStatistics() {
    const sortedLatencies = this.results.latencies.sort((a, b) => a - b);
    const count = sortedLatencies.length;
    
    return {
      operations: {
        total: this.results.totalOperations,
        throughput: this.results.throughput.toFixed(2),
        errorRate: ((this.results.errors / this.results.totalOperations) * 100).toFixed(2)
      },
      cache: {
        hitRatio: ((this.results.cacheHits / (this.results.cacheHits + this.results.cacheMisses)) * 100).toFixed(2),
        hits: this.results.cacheHits,
        misses: this.results.cacheMisses
      },
      latency: {
        avg: (sortedLatencies.reduce((sum, lat) => sum + lat, 0) / count).toFixed(3),
        p50: sortedLatencies[Math.floor(count * 0.5)].toFixed(3),
        p95: sortedLatencies[Math.floor(count * 0.95)].toFixed(3),
        p99: sortedLatencies[Math.floor(count * 0.99)].toFixed(3),
        max: Math.max(...sortedLatencies).toFixed(3)
      }
    };
  }

  async generateReport() {
    const stats = this.calculateStatistics();
    const memoryInfo = await this.redis.info('memory');
    
    const report = `
# Redis Cache Performance Benchmark Report

**Test Duration**: 5 minutes  
**Timestamp**: ${new Date().toISOString()}

## Performance Metrics

### Throughput
- **Total Operations**: ${stats.operations.total:,}
- **Operations/Second**: ${stats.operations.throughput}
- **Error Rate**: ${stats.operations.errorRate}%

### Cache Performance
- **Cache Hit Ratio**: ${stats.cache.hitRatio}% ⭐ (Target: >80%)
- **Cache Hits**: ${stats.cache.hits:,}
- **Cache Misses**: ${stats.cache.misses:,}

### Latency (milliseconds)
- **Average**: ${stats.latency.avg}ms
- **50th Percentile**: ${stats.latency.p50}ms
- **95th Percentile**: ${stats.latency.p95}ms ⭐ (Target: <5ms)
- **99th Percentile**: ${stats.latency.p99}ms
- **Maximum**: ${stats.latency.max}ms

### Redis Memory Usage
\`\`\`
${memoryInfo}
\`\`\`

## Enterprise Compliance
- **Sub-5ms P95 Latency**: ${parseFloat(stats.latency.p95) < 5 ? '✅ PASS' : '❌ FAIL'}
- **80%+ Cache Hit Ratio**: ${parseFloat(stats.cache.hitRatio) >= 80 ? '✅ PASS' : '❌ FAIL'}
- **<1% Error Rate**: ${parseFloat(stats.operations.errorRate) < 1 ? '✅ PASS' : '❌ FAIL'}

## Business Impact
- **Query Response Improvement**: ${stats.cache.hitRatio}% of database queries avoided
- **Estimated Cost Savings**: ~$${(parseFloat(stats.cache.hitRatio) * 0.001 * stats.cache.hits).toFixed(2)}/day in reduced DB load
- **User Experience**: ${parseFloat(stats.latency.p95) < 10 ? 'Excellent' : parseFloat(stats.latency.p95) < 50 ? 'Good' : 'Needs Improvement'} response times
`;

    return report;
  }

  async disconnect() {
    await this.redis.disconnect();
    console.log('✅ Disconnected from Redis');
  }
}

async function main() {
  const benchmark = new RedisBenchmark();
  
  try {
    await benchmark.connect();
    await benchmark.warmupCache();
    await benchmark.benchmarkOperations();
    
    const report = await benchmark.generateReport();
    
    console.log(report);
    
    // Save report to file
    const fs = require('fs');
    fs.writeFileSync('benchmarks/results/redis-benchmark-report.md', report);
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await benchmark.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RedisBenchmark;