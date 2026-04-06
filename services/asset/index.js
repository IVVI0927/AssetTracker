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

const app = express();
const PORT = process.env.PORT || 5050;
const useTls = process.env.MONGO_TLS === 'true';

// Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,                 // 每个 IP 最多 100 次请求
  message: 'Too many requests from this IP, please try again later.',
});

app.use(limiter); // ✅ 应用全局限制器
app.use(cors()); // ✅ 允许所有来源跨域访问
app.use(express.json());

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
