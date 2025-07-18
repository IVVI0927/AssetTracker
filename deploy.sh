#!/bin/bash

echo "📦 开始部署前端"
cd client
echo "⚙️ 复制 .env.production 为 .env"
cp .env.production .env

npm install
npm run build
echo "✅ 前端构建完成"

cd ..
cd server
echo "🚀 启动后端服务"
npm install

pm2 restart server || pm2 start server
echo "✅ 后端服务已启动"

echo "🌍 当前 VITE_API_BASE_URL 为 $(grep VITE_API_BASE_URL client/.env)"