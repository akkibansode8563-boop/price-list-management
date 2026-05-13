# Price List Management System

## Overview

A full-stack **Price List Management System** built for B2B distribution companies. It enables **Super Admins**, **Product Managers**, and **Sales Managers** to manage, update, and view product pricing in real time.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 5 + TailwindCSS 3 |
| **Backend** | Node.js + Express 4 |
| **Database** | PostgreSQL 17 |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **File Handling** | Multer v2 + xlsx |
| **Security** | Helmet, express-rate-limit, express-validator |

---

## Features

- 🔐 **Role-based authentication** — super_admin, product_manager, sales_manager
- 📦 **Product management** — CRUD, filtering, search, bulk Excel upload/download
- 💰 **Price tracking** — Automatic price change audit logs with timestamps
- 📊 **Role-specific dashboards** — Tailored stats per user role
- 🔔 **Notifications** — Real-time price change alerts
- ❤️ **Favorites** — Sales managers can bookmark products
- 🌙 **Dark mode** — Full dark/light theme support
- 📱 **Responsive** — Mobile-first design

---

## Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

```bash
# Copy and edit the backend .env
cp backend/.env.example backend/.env
# Edit DB_PASSWORD, JWT_SECRET etc.
```

### 3. Initialize Database

```bash
cd backend
npm run db:init
```

### 4. Start Servers

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

### 5. Open Browser

Navigate to: **http://localhost:5173**

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@company.com | Admin@123 |
| Product Manager | pm@company.com | Manager@123 |
| Sales Manager | sales@company.com | Sales@123 |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/change-password` | Change password |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (with filters) |
| GET | `/api/products/:id` | Get product detail |
| POST | `/api/products` | Create product (admin/pm) |
| PUT | `/api/products/:id` | Update product (admin/pm) |
| DELETE | `/api/products/:id` | Delete product (admin) |
| GET | `/api/products/:id/favorites` | Check favorite status |
| POST | `/api/products/:id/favorites` | Add to favorites |
| DELETE | `/api/products/:id/favorites` | Remove from favorites |

### Users (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Deactivate user |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/admin` | Admin stats |
| GET | `/api/dashboard/product-manager` | PM stats |
| GET | `/api/dashboard/sales` | Sales stats |

### Upload/Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/products` | Bulk upload via Excel |
| GET | `/api/upload/template` | Download upload template |
| GET | `/api/export` | Export price list to Excel |

---

## Project Structure

```
price-list-management/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL pool connection
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── roleCheck.js         # Role-based authorization
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── products.js          # Product CRUD
│   │   ├── users.js             # User management
│   │   ├── categories.js        # Category management
│   │   ├── dashboard.js         # Dashboard stats
│   │   └── upload.js            # File upload/download
│   ├── scripts/
│   │   └── init-db.js           # Database initialization & seeding
│   ├── .env                     # Environment variables (not in git)
│   ├── .env.example             # Environment template
│   ├── package.json
│   └── server.js                # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx        # App shell layout
│   │   │   ├── Navbar.jsx        # Top navigation bar
│   │   │   └── Sidebar.jsx       # Role-based sidebar
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Authentication state
│   │   ├── pages/
│   │   │   ├── Login.jsx         # Login page
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── ProductManagerDashboard.jsx
│   │   │   ├── SalesDashboard.jsx
│   │   │   ├── Products.jsx      # Product list/management
│   │   │   ├── Users.jsx         # User management (admin)
│   │   │   └── Profile.jsx       # User profile/settings
│   │   ├── utils/
│   │   │   └── api.js            # Axios instance with interceptors
│   │   ├── App.jsx               # React Router setup
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Tailwind + custom styles
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── database/
│   └── schema.sql               # Full PostgreSQL schema
├── README.md
└── DEPLOYMENT.md
```

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24h expiry
- Rate limiting: 1000 req/15min globally, 10 req/15min on auth
- Helmet.js for HTTP security headers
- Input validation via express-validator
- CORS restricted to frontend URL

---

## Future Improvements

1. **Real-time price updates** via WebSockets (Socket.io already installed)
2. **PDF price list generation** (pdfkit already installed)
3. **Email notifications** when prices change significantly
4. **Bulk edit** inline in table view
5. **Analytics dashboard** with charts (Chart.js / Recharts)
6. **Mobile app** via React Native with shared API
7. **Multi-currency support**
8. **Price history graphs** per product

---

*Built with ❤️ using React, Node.js, and PostgreSQL*
