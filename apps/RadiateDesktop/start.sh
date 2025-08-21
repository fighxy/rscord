#!/bin/bash

# Start RSCORD Desktop Application
echo "🚀 Starting RSCORD Desktop Application..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the development server
echo "🔧 Starting development server..."
npm run dev