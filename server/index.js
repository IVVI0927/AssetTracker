import dotenv from "dotenv";
dotenv.config();
import logger from "./logger/logger.js";
import morganMiddleware from "./logger/morganMiddleware.js";
import errorHandler from './middlewares/errorHandler.js';
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5050;

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
import assetRoutes from './routes/assets.js';
app.use('/api/assets', assetRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running 🎉");
});

// MongoDB connect and server start
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
    });

    logger.info("✅ MongoDB connected");

    // app.listen(PORT, () => {
    //   logger.info(`🚀 Server running on http://localhost:${PORT}`);
    // });
    app.listen(process.env.PORT || 5050, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5050}`);
});   //允许外部访问

  } catch (err) {
    logger.error("❌ Database connection error:", err);
    process.exit(1); // Exit on failure
  }
};

app.use(errorHandler);

startServer();