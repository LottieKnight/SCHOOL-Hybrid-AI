#!/bin/sh
set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Railway API Deployment - Migration & Start"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "📋 Step 1: Running pending migrations..."
echo ""
if [ -f "apps/api/run-migrations.ts" ]; then
  npx tsx apps/api/run-migrations.ts
elif [ -f "./run-migrations.ts" ]; then
  npx tsx ./run-migrations.ts
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📡 Step 2: Starting API server..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ -f "apps/api/dist/index.js" ]; then
  exec node apps/api/dist/index.js
else
  exec node dist/index.js
fi
