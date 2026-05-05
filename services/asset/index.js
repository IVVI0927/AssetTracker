/**
 * Asset Service - Enterprise Asset Tracking Platform
 * 
 * Purpose: Core asset management service for CRUD operations, tracking, and analytics.
 * Features:
 * - Asset lifecycle management (creation, updates, disposal)
 * - Real-time location tracking with geofencing
 * - QR code and RFID tag integration
 * - Asset transfer and custody chain management
 * - Advanced search with Elasticsearch integration
 * - Performance analytics and reporting
 * - Multi-tenant data isolation
 */

require('dotenv').config({ path: __dirname + '/.env' });
const logger = require('./logger/logger');
const morganMiddleware = require("./logger/morganMiddleware");
const errorHandler = require('./middlewares/errorHandler');
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5050;
const useTls = process.env.MONGO_TLS === 'true';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));

// Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morganMiddleware); // ✅ 使用 morgan 记录 HTTP 请求日志

//注册/挂载这个路由
const assetRoutes = require('./routes/assets');
app.use('/api/assets', assetRoutes);

// 用户认证相关路由
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running 🎉");
});

//前端检测后端连接状态
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// MongoDB connect and server start
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: useTls,
    });

    logger.info("✅ MongoDB connected");

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });   //允许外部访问

  } catch (err) {
    logger.error("❌ Database connection error:", err);
    process.exit(1); // Exit on failure
  }
};

app.use(errorHandler);

startServer();
