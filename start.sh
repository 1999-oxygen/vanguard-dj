#!/bin/bash

echo "🎧 Starting Vanguard DJ..."
echo "=========================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/segments
mkdir -p data/stems
mkdir -p data/mixes
mkdir -p uploads
echo ""

# Check if backend is already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend already running on port 8000"
    echo "   Kill it with: lsof -ti:8000 | xargs kill -9"
    echo ""
else
    echo "✅ Port 8000 is available"
    echo ""
fi

# Check if frontend is already running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Frontend already running on port 5173"
    echo "   Kill it with: lsof -ti:5173 | xargs kill -9"
    echo ""
else
    echo "✅ Port 5173 is available"
    echo ""
fi

echo "🚀 Starting Vanguard DJ..."
echo ""
echo "Backend API: http://localhost:8000"
echo "Frontend UI: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start both backend and frontend
npm run dev:api
