require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'analytics',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Asset Tracker Analytics Service',
    version: '1.0.0',
    endpoints: ['/health', '/analytics']
  });
});

// Analytics endpoint (placeholder)
app.get('/analytics', (req, res) => {
  res.json({ 
    analytics: {
      totalAssets: 0,
      totalUsers: 0,
      reports: []
    },
    message: 'Analytics service is running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    service: 'analytics'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    service: 'analytics'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Analytics service running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});