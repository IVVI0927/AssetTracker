#!/bin/bash

set -euo pipefail

echo "Starting local Asset Tracker stack..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
export MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/asset-tracker}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-in-production}"
export PORT="${PORT:-5050}"

if ! docker ps --format '{{.Names}}' | grep -qx "asset-tracker-mongo"; then
    if docker ps -a --format '{{.Names}}' | grep -qx "asset-tracker-mongo"; then
        echo "Starting existing MongoDB container..."
        docker start asset-tracker-mongo >/dev/null
    else
        echo "Creating MongoDB container..."
        docker run -d --name asset-tracker-mongo \
            -p 27017:27017 \
            -e MONGO_INITDB_DATABASE=asset-tracker \
            mongo:6 >/dev/null
    fi

    echo "Waiting for MongoDB to accept connections..."
    sleep 10
fi

if [ ! -d "$ROOT_DIR/services/asset/node_modules" ]; then
    echo "Installing asset service dependencies..."
    (cd "$ROOT_DIR/services/asset" && npm install)
fi

echo "Starting asset service on port $PORT..."
(cd "$ROOT_DIR/services/asset" && MONGO_URI="$MONGO_URI" PORT="$PORT" JWT_SECRET="$JWT_SECRET" npm run start) &
ASSET_PID=$!

sleep 5

echo "Running backend health check..."
curl -fsS "http://localhost:$PORT/health"
echo
echo "Asset service is running: http://localhost:$PORT"
echo "Client dev server can be started separately with:"
echo "  cd client && npm install && npm run dev"
echo "Stop backend with:"
echo "  kill $ASSET_PID"
