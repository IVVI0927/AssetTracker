#!/bin/bash

# Asset Tracker Local Deployment Script
echo "🚀 Starting Asset Tracker services..."

# Set environment variables
export MONGO_URI="mongodb://localhost:27017/asset-tracker"
export JWT_SECRET="dev-jwt-secret-change-in-production"
export PORT_ASSET=3001
export PORT_USER=3002
export PORT_AUDIT=3003

# Start MongoDB if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting MongoDB..."
    docker run -d --name asset-tracker-mongo \
        -p 27017:27017 \
        -e MONGO_INITDB_DATABASE=asset-tracker \
        mongo:6
    
    echo "⏳ Waiting for MongoDB to start..."
    sleep 10
fi

# Install dependencies and start services
echo "📦 Installing dependencies..."
cd services/asset && npm install --omit=dev && cd ../..
cd services/user && npm install --omit=dev && cd ../..
cd services/audit && npm install --omit=dev && cd ../..

echo "🔧 Starting Asset Service on port $PORT_ASSET..."
cd services/asset
MONGO_URI=$MONGO_URI PORT=$PORT_ASSET node index.js &
ASSET_PID=$!
cd ../..

echo "👤 Starting User Service on port $PORT_USER..."
cd services/user  
MONGO_URI=$MONGO_URI PORT=$PORT_USER JWT_SECRET=$JWT_SECRET node index.js &
USER_PID=$!
cd ../..

echo "📋 Starting Audit Service on port $PORT_AUDIT..."
cd services/audit
PORT=$PORT_AUDIT node index-simple.js &
AUDIT_PID=$!
cd ../..

echo "✅ All services started!"
echo ""
echo "📋 Service URLs:"
echo "  - Asset Service:  http://localhost:3001/health"
echo "  - User Service:   http://localhost:3002/health" 
echo "  - Audit Service:  http://localhost:3003/health"
echo "  - MongoDB:        mongodb://localhost:27017/asset-tracker"
echo ""
echo "🛑 To stop services, run: kill $ASSET_PID $USER_PID $AUDIT_PID"

# Wait for services to start
sleep 5

# Health checks
echo "🔍 Running health checks..."
curl -s http://localhost:3001/health || echo "❌ Asset service not responding"
curl -s http://localhost:3002/health || echo "❌ User service not responding"  
curl -s http://localhost:3003/health || echo "❌ Audit service not responding"

echo "🎉 Deployment complete!"