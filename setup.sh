#!/bin/bash
# Price List Management System - Quick Start Script

echo "🚀 Price List Management System - Quick Start"
echo "=============================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL 14+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18+. Found: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Database setup
echo "🗄️  Setting up database..."
read -p "Enter PostgreSQL username [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Enter PostgreSQL password: " DB_PASSWORD
echo ""
read -p "Enter database name [pricelist_db]: " DB_NAME
DB_NAME=${DB_NAME:-pricelist_db}

export PGPASSWORD=$DB_PASSWORD

# Create database
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database may already exist, continuing..."

# Run schema
psql -U $DB_USER -d $DB_NAME -f database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup complete"
else
    echo "❌ Database setup failed"
    exit 1
fi

echo ""
echo "⚙️  Setting up backend..."
cd backend

# Create .env
cat > .env << EOF
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# JWT (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=change-this-to-a-32-character-secret-key
JWT_EXPIRE=24h

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Session
SESSION_TIMEOUT=30
EOF

npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend npm install failed"
    exit 1
fi

echo "✅ Backend setup complete"
echo ""
echo "🎨 Setting up frontend..."
cd ../frontend

npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend npm install failed"
    exit 1
fi

echo "✅ Frontend setup complete"
echo ""
echo "=============================================="
echo "🎉 Setup complete! To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "Default login:"
echo "  Email: admin@company.com"
echo "  Password: Admin@123"
echo ""
echo "⚠️  IMPORTANT: Change the default password immediately!"
echo "=============================================="
