# Price List Management System - Deployment Guide

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Git

## Local Development Setup

### 1. Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE pricelist_db;"

# Run schema
psql -U postgres -d pricelist_db -f database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Production Deployment

### Option 1: Railway + Vercel (Recommended)

**Backend (Railway):**
1. Push code to GitHub
2. Connect Railway to your repo
3. Add PostgreSQL plugin
4. Set environment variables
5. Deploy

**Frontend (Vercel):**
1. Connect Vercel to your repo
2. Set root directory to `frontend`
3. Add environment variable: `VITE_API_URL=your-railway-url`
4. Deploy

### Option 2: Docker Deployment

```dockerfile
# Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
EXPOSE 5000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: pricelist_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: pricelist_db
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | No (default: 5000) |
| DB_HOST | Database host | Yes |
| DB_PORT | Database port | Yes |
| DB_NAME | Database name | Yes |
| DB_USER | Database user | Yes |
| DB_PASSWORD | Database password | Yes |
| JWT_SECRET | JWT signing key | Yes |
| JWT_EXPIRE | Token expiry | No (default: 24h) |
| FRONTEND_URL | CORS allowed origin | Yes |

## First Time Setup

1. Login with default admin: `admin@company.com` / `Admin@123`
2. Change default password immediately
3. Create categories and brands
4. Assign product managers to categories
5. Add products or bulk upload via Excel

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT_SECRET (min 32 chars)
- [ ] Enable HTTPS in production
- [ ] Set up database backups
- [ ] Configure rate limiting appropriately
- [ ] Use environment variables (never commit secrets)
- [ ] Enable CORS only for trusted origins
