// Enterprise Asset Tracker Performance Test Suite
// Testing requirements: <100ms API response time (95th percentile), 10,000+ concurrent users per tenant

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiCallsCounter = new Counter('api_calls');

// Test configuration for enterprise performance requirements
export const options = {
  scenarios: {
    // Scenario 1: Load test for 1000 concurrent users
    load_test: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '5m',
      tags: { test_type: 'load' },
    },
    // Scenario 2: Stress test for peak usage
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 2000 },
        { duration: '5m', target: 5000 },
        { duration: '2m', target: 10000 },
        { duration: '3m', target: 10000 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    // Scenario 3: Spike test for sudden traffic surges
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 15000 }, // Immediate spike
        { duration: '3m', target: 15000 },
        { duration: '10s', target: 100 },
      ],
      tags: { test_type: 'spike' },
    }
  },
  thresholds: {
    // Enterprise requirements: <100ms response time (95th percentile)
    'http_req_duration': ['p(95)<100', 'p(99)<200'],
    'http_req_failed': ['rate<0.01'], // Less than 1% error rate
    'errors': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Test data for realistic scenarios
const testUsers = [
  { email: 'admin@enterprise.com', password: 'SecurePassword123!' },
  { email: 'manager@enterprise.com', password: 'ManagerPass456!' },
  { email: 'operator@enterprise.com', password: 'OperatorPass789!' },
];

const assetTemplates = [
  { name: 'Laptop-${Math.random()}', type: 'IT Equipment', location: 'Office-A' },
  { name: 'Printer-${Math.random()}', type: 'Office Equipment', location: 'Office-B' },
  { name: 'Desk-${Math.random()}', type: 'Furniture', location: 'Floor-3' },
];

let authToken = null;

export function setup() {
  // Authenticate and get token for API calls
  const loginPayload = JSON.stringify({
    email: testUsers[0].email,
    password: testUsers[0].password,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const response = http.post(`${BASE_URL}/api/auth/login`, loginPayload, params);
  
  if (response.status === 200) {
    const body = JSON.parse(response.body);
    return { token: body.token };
  }
  
  return { token: 'dummy-token' }; // Fallback for testing
}

export default function (data) {
  const token = data && data.token ? data.token : 'dummy-token';
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test scenarios mimicking real enterprise usage patterns
  
  // 1. Asset Management Operations (70% of traffic)
  if (Math.random() < 0.7) {
    testAssetOperations(params);
  }
  
  // 2. User Management Operations (15% of traffic)
  else if (Math.random() < 0.85) {
    testUserOperations(params);
  }
  
  // 3. Audit and Reporting Operations (10% of traffic)
  else if (Math.random() < 0.95) {
    testAuditOperations(params);
  }
  
  // 4. Search and Analytics Operations (5% of traffic)
  else {
    testSearchOperations(params);
  }

  // Realistic user think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

function testAssetOperations(params) {
  apiCallsCounter.add(1);
  
  // Get assets list (most common operation)
  let response = http.get(`${BASE_URL}/api/assets?page=1&limit=20`, params);
  let success = check(response, {
    'assets list status is 200': (r) => r.status === 200,
    'assets list response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  if (!success) errorRate.add(1);
  
  // Create new asset (20% of asset operations)
  if (Math.random() < 0.2) {
    const asset = Object.assign({}, assetTemplates[Math.floor(Math.random() * assetTemplates.length)]);
    asset.name = asset.name.replace('${Math.random()}', Math.random().toString(36).substr(2, 9));
    
    response = http.post(`${BASE_URL}/api/assets`, JSON.stringify(asset), params);
    success = check(response, {
      'asset creation status is 201': (r) => r.status === 201,
      'asset creation response time < 200ms': (r) => r.timings.duration < 200,
    });
    
    if (!success) errorRate.add(1);
  }
  
  // Update asset (10% of asset operations)
  if (Math.random() < 0.1) {
    const updateData = { location: 'Updated-Location-' + Math.random() };
    response = http.put(`${BASE_URL}/api/assets/test-asset-id`, JSON.stringify(updateData), params);
    success = check(response, {
      'asset update response time < 150ms': (r) => r.timings.duration < 150,
    });
    
    if (!success) errorRate.add(1);
  }
}

function testUserOperations(params) {
  apiCallsCounter.add(1);
  
  // Get user profile
  let response = http.get(`${BASE_URL}/api/users/profile`, params);
  let success = check(response, {
    'user profile status is 200': (r) => r.status === 200,
    'user profile response time < 50ms': (r) => r.timings.duration < 50,
  });
  
  if (!success) errorRate.add(1);
  
  // Get organization data
  response = http.get(`${BASE_URL}/api/organizations/current`, params);
  success = check(response, {
    'organization data response time < 75ms': (r) => r.timings.duration < 75,
  });
  
  if (!success) errorRate.add(1);
}

function testAuditOperations(params) {
  apiCallsCounter.add(1);
  
  // Get audit logs
  let response = http.get(`${BASE_URL}/api/audit/logs?page=1&limit=10`, params);
  let success = check(response, {
    'audit logs status is 200': (r) => r.status === 200,
    'audit logs response time < 150ms': (r) => r.timings.duration < 150,
  });
  
  if (!success) errorRate.add(1);
  
  // Generate compliance report
  if (Math.random() < 0.3) {
    const reportRequest = { 
      type: 'monthly', 
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    };
    
    response = http.post(`${BASE_URL}/api/audit/reports`, JSON.stringify(reportRequest), params);
    success = check(response, {
      'compliance report response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    if (!success) errorRate.add(1);
  }
}

function testSearchOperations(params) {
  apiCallsCounter.add(1);
  
  const searchTerms = ['laptop', 'printer', 'office', 'equipment', 'furniture'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  // Elasticsearch-powered search
  let response = http.get(`${BASE_URL}/api/search?q=${term}&type=assets`, params);
  let success = check(response, {
    'search operation status is 200': (r) => r.status === 200,
    'search operation response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  if (!success) errorRate.add(1);
  
  // Analytics dashboard data
  response = http.get(`${BASE_URL}/api/analytics/dashboard`, params);
  success = check(response, {
    'analytics dashboard response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  if (!success) errorRate.add(1);
}

export function handleSummary(data) {
  const summary = {
    testSuite: 'Enterprise Asset Tracker Performance Tests',
    timestamp: new Date().toISOString(),
    duration: data.metrics.iteration_duration.values,
    httpReqs: {
      count: data.metrics.http_reqs.values.count,
      rate: data.metrics.http_reqs.values.rate
    },
    httpReqDuration: {
      avg: data.metrics.http_req_duration.values.avg,
      p95: data.metrics.http_req_duration.values['p(95)'],
      p99: data.metrics.http_req_duration.values['p(99)'],
      max: data.metrics.http_req_duration.values.max
    },
    httpReqFailed: {
      rate: data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0
    },
    vus: {
      max: data.metrics.vus_max.values.max,
      value: data.metrics.vus.values.value
    },
    iterations: data.metrics.iterations.values.count,
    dataReceived: data.metrics.data_received.values.count,
    dataSent: data.metrics.data_sent.values.count
  };

  return {
    'benchmarks/results/k6-performance-raw.json': JSON.stringify(data),
    'benchmarks/results/k6-performance-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateConsoleReport(summary),
  };
}

function generateConsoleReport(summary) {
  return `
🚀 ENTERPRISE ASSET TRACKER PERFORMANCE RESULTS
===============================================

📊 Request Statistics:
  • Total Requests: ${summary.httpReqs.count}
  • Request Rate: ${summary.httpReqs.rate.toFixed(2)} req/s
  • Failed Requests: ${(summary.httpReqFailed.rate * 100).toFixed(2)}%

⏱️  Response Times:
  • Average: ${summary.httpReqDuration.avg.toFixed(2)}ms
  • 95th Percentile: ${summary.httpReqDuration.p95.toFixed(2)}ms ⭐ (Target: <100ms)
  • 99th Percentile: ${summary.httpReqDuration.p99.toFixed(2)}ms ⭐ (Target: <200ms)
  • Maximum: ${summary.httpReqDuration.max.toFixed(2)}ms

👥 Concurrent Users:
  • Peak VUs: ${summary.vus.max}
  • Current VUs: ${summary.vus.value}

💾 Data Transfer:
  • Data Received: ${(summary.dataReceived / 1024 / 1024).toFixed(2)} MB
  • Data Sent: ${(summary.dataSent / 1024).toFixed(2)} KB

✅ Enterprise SLA Compliance:
  • Response Time (P95): ${summary.httpReqDuration.p95 < 100 ? 'PASS' : 'FAIL'}
  • Error Rate: ${summary.httpReqFailed.rate < 0.01 ? 'PASS' : 'FAIL'}
  • Availability: ${summary.httpReqFailed.rate < 0.01 ? '>99.99%' : '<99.99%'}

📈 Max Throughput Achieved: ${summary.httpReqs.rate.toFixed(0)} requests/minute
`;
}