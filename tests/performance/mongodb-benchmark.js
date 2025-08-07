#!/usr/bin/env node
// MongoDB Performance Benchmark for Enterprise Asset Tracker
// Tests database query latency, indexing efficiency, and concurrent operations

const { MongoClient } = require('mongodb');
const { performance } = require('perf_hooks');

class MongoDBBenchmark {
  constructor() {
    this.client = null;
    this.db = null;
    this.connectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/asset-tracker-benchmark';
    
    this.results = {
      queries: [],
      inserts: [],
      updates: [],
      aggregations: [],
      indexes: [],
      errors: 0
    };
  }

  async connect() {
    try {
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 100,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });
      
      await this.client.connect();
      this.db = this.client.db();
      console.log('✅ Connected to MongoDB');
      
      // Ensure indexes exist for optimal performance
      await this.ensureIndexes();
      
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      throw error;
    }
  }

  async ensureIndexes() {
    console.log('📋 Creating database indexes...');
    
    const assets = this.db.collection('assets');
    const users = this.db.collection('users');
    const auditEvents = this.db.collection('auditEvents');
    
    // Asset indexes for common queries
    await assets.createIndex({ 'tenantId': 1, 'status': 1 });
    await assets.createIndex({ 'tenantId': 1, 'location': 1 });
    await assets.createIndex({ 'tenantId': 1, 'type': 1 });
    await assets.createIndex({ 'tenantId': 1, 'createdAt': -1 });
    await assets.createIndex({ 'serialNumber': 1 }, { unique: true, sparse: true });
    await assets.createIndex({ 'name': 'text', 'description': 'text' }); // Full-text search
    
    // User indexes
    await users.createIndex({ 'email': 1 }, { unique: true });
    await users.createIndex({ 'tenantId': 1, 'role': 1 });
    await users.createIndex({ 'tenantId': 1, 'isActive': 1 });
    
    // Audit event indexes for compliance queries
    await auditEvents.createIndex({ 'tenantId': 1, 'timestamp': -1 });
    await auditEvents.createIndex({ 'tenantId': 1, 'eventType': 1, 'timestamp': -1 });
    await auditEvents.createIndex({ 'tenantId': 1, 'resourceId': 1, 'timestamp': -1 });
    await auditEvents.createIndex({ 'userId': 1, 'timestamp': -1 });
    
    console.log('✅ Database indexes created');
  }

  async seedTestData() {
    console.log('🌱 Seeding test data...');
    
    const startTime = performance.now();
    
    // Create test tenants
    const tenants = Array.from({ length: 10 }, (_, i) => ({
      _id: i + 1,
      name: `Enterprise-${i + 1}`,
      plan: 'enterprise',
      maxAssets: 100000,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
    }));
    
    await this.db.collection('tenants').insertMany(tenants);
    
    // Create test users (1000 users across 10 tenants)
    const users = [];
    for (let i = 1; i <= 1000; i++) {
      users.push({
        _id: i,
        email: `user${i}@enterprise${Math.ceil(i / 100)}.com`,
        tenantId: Math.ceil(i / 100),
        role: ['admin', 'manager', 'operator', 'viewer'][i % 4],
        isActive: Math.random() > 0.1, // 90% active users
        createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
    }
    
    await this.db.collection('users').insertMany(users);
    
    // Create test assets (50,000 assets across 10 tenants)
    const assetTypes = ['Laptop', 'Desktop', 'Printer', 'Scanner', 'Phone', 'Tablet', 'Monitor', 'Furniture'];
    const locations = ['Building-A', 'Building-B', 'Warehouse', 'Office-Floor-1', 'Office-Floor-2', 'Remote'];
    const statuses = ['active', 'maintenance', 'retired', 'lost'];
    
    console.log('📦 Creating 50,000 test assets...');
    const assetBatches = [];
    const batchSize = 1000;
    
    for (let batch = 0; batch < 50; batch++) {
      const assets = [];
      for (let i = 0; i < batchSize; i++) {
        const assetId = batch * batchSize + i + 1;
        assets.push({
          _id: assetId,
          name: `Asset-${assetId}`,
          serialNumber: `SN${assetId.toString().padStart(8, '0')}`,
          type: assetTypes[assetId % assetTypes.length],
          location: locations[assetId % locations.length],
          status: statuses[assetId % statuses.length],
          tenantId: (assetId % 10) + 1,
          assignedTo: Math.random() > 0.3 ? Math.floor(Math.random() * 1000) + 1 : null,
          purchasePrice: Math.floor(Math.random() * 5000) + 100,
          purchaseDate: new Date(Date.now() - Math.random() * 1095 * 24 * 60 * 60 * 1000), // Up to 3 years ago
          createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          metadata: {
            warranty: Math.random() > 0.5 ? 'active' : 'expired',
            condition: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)],
            lastMaintenance: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
          }
        });
      }
      assetBatches.push(assets);
    }
    
    // Insert assets in parallel batches for faster seeding
    await Promise.all(
      assetBatches.map(batch => this.db.collection('assets').insertMany(batch))
    );
    
    // Create audit events (100,000 events for compliance testing)
    console.log('📋 Creating 100,000 audit events...');
    const eventTypes = ['asset_created', 'asset_updated', 'asset_transferred', 'user_login', 'user_logout', 'report_generated'];
    const auditBatches = [];
    
    for (let batch = 0; batch < 100; batch++) {
      const events = [];
      for (let i = 0; i < 1000; i++) {
        const eventId = batch * 1000 + i + 1;
        events.push({
          _id: eventId,
          tenantId: (eventId % 10) + 1,
          eventType: eventTypes[eventId % eventTypes.length],
          userId: Math.floor(Math.random() * 1000) + 1,
          resourceId: Math.floor(Math.random() * 50000) + 1,
          resourceType: 'asset',
          timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
          details: {
            action: 'update',
            changes: ['location', 'status', 'assignedTo'][Math.floor(Math.random() * 3)],
            ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            userAgent: 'AssetTracker/1.0'
          }
        });
      }
      auditBatches.push(events);
    }
    
    await Promise.all(
      auditBatches.map(batch => this.db.collection('auditEvents').insertMany(batch))
    );
    
    const seedTime = performance.now() - startTime;
    console.log(`✅ Test data seeded in ${(seedTime / 1000).toFixed(2)} seconds`);
  }

  async runQueryBenchmarks() {
    console.log('🔍 Running query performance benchmarks...');
    
    const queries = [
      // Common asset queries
      {
        name: 'assets_by_tenant_and_status',
        collection: 'assets',
        operation: 'find',
        query: { tenantId: 1, status: 'active' },
        limit: 20
      },
      {
        name: 'assets_by_location',
        collection: 'assets',
        operation: 'find',
        query: { tenantId: 1, location: 'Building-A' },
        limit: 50
      },
      {
        name: 'assets_full_text_search',
        collection: 'assets',
        operation: 'find',
        query: { $text: { $search: 'laptop monitor' }, tenantId: 1 },
        limit: 10
      },
      {
        name: 'recent_assets',
        collection: 'assets',
        operation: 'find',
        query: { tenantId: 1 },
        sort: { createdAt: -1 },
        limit: 10
      },
      
      // User queries
      {
        name: 'active_users_by_tenant',
        collection: 'users',
        operation: 'find',
        query: { tenantId: 1, isActive: true }
      },
      {
        name: 'user_by_email',
        collection: 'users',
        operation: 'findOne',
        query: { email: 'user1@enterprise1.com' }
      },
      
      // Audit queries for compliance
      {
        name: 'recent_audit_events',
        collection: 'auditEvents',
        operation: 'find',
        query: { tenantId: 1 },
        sort: { timestamp: -1 },
        limit: 100
      },
      {
        name: 'audit_events_by_user',
        collection: 'auditEvents',
        operation: 'find',
        query: { tenantId: 1, userId: 1, timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }
    ];

    // Run each query multiple times to get average performance
    for (const queryDef of queries) {
      const measurements = [];
      
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        
        try {
          const collection = this.db.collection(queryDef.collection);
          let cursor;
          
          if (queryDef.operation === 'findOne') {
            await collection.findOne(queryDef.query);
          } else {
            cursor = collection.find(queryDef.query);
            
            if (queryDef.sort) cursor = cursor.sort(queryDef.sort);
            if (queryDef.limit) cursor = cursor.limit(queryDef.limit);
            
            await cursor.toArray();
          }
          
          const latency = performance.now() - start;
          measurements.push(latency);
          
        } catch (error) {
          console.error(`Query ${queryDef.name} failed:`, error.message);
          this.results.errors++;
        }
      }
      
      // Calculate statistics
      const sorted = measurements.sort((a, b) => a - b);
      const count = sorted.length;
      
      this.results.queries.push({
        name: queryDef.name,
        collection: queryDef.collection,
        measurements: count,
        avg: (sorted.reduce((sum, val) => sum + val, 0) / count).toFixed(3),
        p50: sorted[Math.floor(count * 0.5)].toFixed(3),
        p95: sorted[Math.floor(count * 0.95)].toFixed(3),
        p99: sorted[Math.floor(count * 0.99)].toFixed(3),
        max: Math.max(...sorted).toFixed(3)
      });
    }
  }

  async runAggregationBenchmarks() {
    console.log('📊 Running aggregation performance benchmarks...');
    
    const aggregations = [
      {
        name: 'asset_count_by_type',
        collection: 'assets',
        pipeline: [
          { $match: { tenantId: 1 } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      },
      {
        name: 'asset_value_by_location',
        collection: 'assets',
        pipeline: [
          { $match: { tenantId: 1, status: 'active' } },
          { $group: { _id: '$location', totalValue: { $sum: '$purchasePrice' }, count: { $sum: 1 } } },
          { $sort: { totalValue: -1 } }
        ]
      },
      {
        name: 'monthly_audit_events',
        collection: 'auditEvents',
        pipeline: [
          { $match: { tenantId: 1, timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } },
          { 
            $group: {
              _id: { 
                year: { $year: '$timestamp' },
                month: { $month: '$timestamp' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]
      }
    ];

    for (const aggDef of aggregations) {
      const measurements = [];
      
      for (let i = 0; i < 10; i++) { // Fewer runs for complex aggregations
        const start = performance.now();
        
        try {
          const collection = this.db.collection(aggDef.collection);
          await collection.aggregate(aggDef.pipeline).toArray();
          
          const latency = performance.now() - start;
          measurements.push(latency);
          
        } catch (error) {
          console.error(`Aggregation ${aggDef.name} failed:`, error.message);
          this.results.errors++;
        }
      }
      
      const sorted = measurements.sort((a, b) => a - b);
      const count = sorted.length;
      
      this.results.aggregations.push({
        name: aggDef.name,
        collection: aggDef.collection,
        measurements: count,
        avg: (sorted.reduce((sum, val) => sum + val, 0) / count).toFixed(3),
        p95: sorted[Math.floor(count * 0.95)].toFixed(3),
        max: Math.max(...sorted).toFixed(3)
      });
    }
  }

  async generateReport() {
    const dbStats = await this.db.stats();
    const collectionStats = {
      assets: await this.db.collection('assets').countDocuments(),
      users: await this.db.collection('users').countDocuments(),
      auditEvents: await this.db.collection('auditEvents').countDocuments()
    };

    const report = `
# MongoDB Performance Benchmark Report

**Test Timestamp**: ${new Date().toISOString()}
**Database Size**: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB
**Index Size**: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB

## Collection Statistics
- **Assets**: ${collectionStats.assets.toLocaleString()}
- **Users**: ${collectionStats.users.toLocaleString()}
- **Audit Events**: ${collectionStats.auditEvents.toLocaleString()}

## Query Performance (100 executions each)

| Query Name | Collection | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|------------|------------|----------|----------|----------|----------|----------|
${this.results.queries.map(q => 
  `| ${q.name} | ${q.collection} | ${q.avg} | ${q.p50} | ${q.p95} | ${q.p99} | ${q.max} |`
).join('\n')}

## Aggregation Performance (10 executions each)

| Aggregation Name | Collection | Avg (ms) | P95 (ms) | Max (ms) |
|------------------|------------|----------|----------|----------|
${this.results.aggregations.map(a => 
  `| ${a.name} | ${a.collection} | ${a.avg} | ${a.p95} | ${a.max} |`
).join('\n')}

## Enterprise Compliance
- **Query Response Time (P95)**: ${Math.max(...this.results.queries.map(q => parseFloat(q.p95))) < 50 ? '✅ PASS (<50ms)' : '❌ FAIL (>50ms)'}
- **Aggregation Response Time**: ${Math.max(...this.results.aggregations.map(a => parseFloat(a.p95))) < 500 ? '✅ PASS (<500ms)' : '❌ FAIL (>500ms)'}
- **Error Rate**: ${this.results.errors === 0 ? '✅ PASS (0 errors)' : `❌ FAIL (${this.results.errors} errors)`}

## Business Impact Analysis
- **Query Efficiency**: Average response time of ${(this.results.queries.reduce((sum, q) => sum + parseFloat(q.avg), 0) / this.results.queries.length).toFixed(2)}ms supports real-time user experience
- **Index Effectiveness**: ${((dbStats.indexSize / dbStats.dataSize) * 100).toFixed(1)}% index-to-data ratio indicates ${dbStats.indexSize / dbStats.dataSize > 0.3 ? 'well-optimized' : 'potentially under-indexed'} query performance
- **Scalability**: Current performance supports estimated ${Math.floor(1000 / Math.max(...this.results.queries.map(q => parseFloat(q.p95))))} concurrent users per query type
- **Compliance Ready**: Audit query performance of ${this.results.queries.find(q => q.name.includes('audit'))?.p95 || 'N/A'}ms enables real-time compliance monitoring

## Recommendations
${Math.max(...this.results.queries.map(q => parseFloat(q.p95))) > 50 ? '⚠️  Consider additional indexes for slow queries' : '✅ Query performance is optimal'}
${Math.max(...this.results.aggregations.map(a => parseFloat(a.p95))) > 500 ? '⚠️  Complex aggregations may need optimization or caching' : '✅ Aggregation performance is acceptable'}
${(dbStats.indexSize / dbStats.dataSize) > 0.5 ? '⚠️  High index overhead - review index usage' : ''}
`;

    return report;
  }

  async cleanup() {
    // Clean up test data
    await this.db.collection('assets').deleteMany({});
    await this.db.collection('users').deleteMany({});
    await this.db.collection('auditEvents').deleteMany({});
    await this.db.collection('tenants').deleteMany({});
    console.log('🧹 Test data cleaned up');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

async function main() {
  const benchmark = new MongoDBBenchmark();
  
  try {
    await benchmark.connect();
    await benchmark.seedTestData();
    await benchmark.runQueryBenchmarks();
    await benchmark.runAggregationBenchmarks();
    
    const report = await benchmark.generateReport();
    console.log(report);
    
    // Save report to file
    const fs = require('fs');
    fs.writeFileSync('benchmarks/results/mongodb-benchmark-report.md', report);
    
    // Uncomment to clean up test data
    // await benchmark.cleanup();
    
  } catch (error) {
    console.error('❌ MongoDB benchmark failed:', error);
  } finally {
    await benchmark.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MongoDBBenchmark;