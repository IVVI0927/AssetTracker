require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'audit',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Asset Tracker Audit Service',
    version: '1.0.0',
    endpoints: ['/health', '/audit']
  });
});

// Audit endpoint (placeholder)
app.get('/audit', (req, res) => {
  res.json({ 
    auditLogs: [],
    message: 'Audit service is running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    service: 'audit'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    service: 'audit'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Audit service running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});