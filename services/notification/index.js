require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const winston = require('winston');
const rateLimit = require('express-rate-limit');

// Import notification modules
const emailService = require('./services/emailService');
const smsService = require('./services/smsService');
const pushService = require('./services/pushService');
const NotificationQueue = require('./services/queueService');
const Notification = require('./models/Notification');
const { verifyToken } = require('./middleware/auth');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/notification-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/notification.log' })
  ]
});

const app = express();
const PORT = process.env.PORT || 3004;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(limiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Initialize notification queue
const notificationQueue = new NotificationQueue();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const queueStatus = await notificationQueue.getHealthStatus();
    
    res.json({ 
      status: 'healthy', 
      service: 'notification',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      dependencies: {
        database: dbStatus,
        queue: queueStatus,
        email: emailService.isConfigured(),
        sms: smsService.isConfigured(),
        push: pushService.isConfigured()
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({ 
      status: 'unhealthy',
      service: 'notification',
      error: 'Service unavailable'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Asset Tracker Notification Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      notifications: '/api/notifications',
      send: 'POST /api/notifications/send',
      templates: '/api/templates',
      preferences: '/api/preferences'
    }
  });
});

// API Routes with authentication
app.use('/api', verifyToken);

// Get user notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    
    const filter = { userId, tenantId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Notification.countDocuments(filter);
    
    res.json({
      notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch notifications', { error: error.message, userId: req.user.userId });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Send notification
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { recipients, type, subject, message, channels = ['email'], priority = 'normal', templateId, templateData } = req.body;
    
    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }
    
    if (!type || !['alert', 'info', 'warning', 'system'].includes(type)) {
      return res.status(400).json({ error: 'Valid notification type is required' });
    }
    
    if (!channels.every(ch => ['email', 'sms', 'push', 'in-app'].includes(ch))) {
      return res.status(400).json({ error: 'Invalid notification channels' });
    }
    
    // Create notification jobs
    const jobs = [];
    for (const recipient of recipients) {
      const notificationData = {
        recipient,
        type,
        subject: subject || 'Asset Tracker Notification',
        message,
        channels,
        priority,
        templateId,
        templateData,
        tenantId: req.user.tenantId,
        createdBy: req.user.userId
      };
      
      jobs.push(notificationQueue.addJob('send-notification', notificationData, {
        priority: priority === 'high' ? 10 : priority === 'normal' ? 5 : 1,
        delay: priority === 'low' ? 60000 : 0 // Delay low priority by 1 minute
      }));
    }
    
    const results = await Promise.allSettled(jobs);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    logger.info('Notification jobs created', {
      total: recipients.length,
      successful,
      failed: recipients.length - successful,
      type,
      createdBy: req.user.userId
    });
    
    res.json({
      message: 'Notification jobs created successfully',
      total: recipients.length,
      queued: successful,
      failed: recipients.length - successful
    });
    
  } catch (error) {
    logger.error('Failed to send notifications', { error: error.message, userId: req.user.userId });
    res.status(500).json({ error: 'Failed to queue notifications' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user.userId,
        tenantId: req.user.tenantId 
      },
      { 
        status: 'read',
        readAt: new Date()
      },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ notification });
  } catch (error) {
    logger.error('Failed to mark notification as read', { error: error.message });
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Get notification preferences
app.get('/api/preferences', async (req, res) => {
  try {
    // This would typically fetch from a UserPreferences model
    const defaultPreferences = {
      email: {
        alerts: true,
        reports: true,
        marketing: false
      },
      sms: {
        alerts: true,
        reports: false,
        marketing: false
      },
      push: {
        alerts: true,
        reports: true,
        marketing: false
      },
      inApp: {
        alerts: true,
        reports: true,
        marketing: true
      }
    };
    
    res.json({ preferences: defaultPreferences });
  } catch (error) {
    logger.error('Failed to fetch preferences', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    service: 'notification',
    requestId: req.id || Date.now()
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { url: req.url, method: req.method, ip: req.ip });
  res.status(404).json({ 
    error: 'Route not found',
    service: 'notification',
    availableEndpoints: [
      'GET /health',
      'GET /',
      'GET /api/notifications',
      'POST /api/notifications/send',
      'PATCH /api/notifications/:id/read',
      'GET /api/preferences'
    ]
  });
});

// Database connection and server start
async function startServer() {
  try {
    // Connect to MongoDB
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info('Connected to MongoDB');
    } else {
      logger.warn('No MongoDB URI provided, running without database persistence');
    }
    
    // Initialize notification queue
    await notificationQueue.initialize();
    logger.info('Notification queue initialized');
    
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Notification service running on port ${PORT}`);
      logger.info(`📋 Health check: http://0.0.0.0:${PORT}/health`);
      logger.info('Service features:', {
        email: emailService.isConfigured(),
        sms: smsService.isConfigured(),
        push: pushService.isConfigured(),
        queue: true,
        database: !!process.env.MONGO_URI
      });
    });
    
  } catch (error) {
    logger.error('Failed to start notification service', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await notificationQueue.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await notificationQueue.close();
  await mongoose.connection.close();
  process.exit(0);
});

startServer();