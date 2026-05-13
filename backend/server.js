const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));

// Notifications route (inline)
app.get('/api/notifications', require('./middleware/auth').authenticate, async (req, res) => {
  const pool = require('./config/database');
  try {
    const { id } = req.user;
    const result = await pool.query(
      `SELECT n.*, p.name as product_name 
       FROM notifications n
       LEFT JOIN products p ON n.related_product_id = p.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/notifications/:id/read', require('./middleware/auth').authenticate, async (req, res) => {
  const pool = require('./config/database');
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', 
      [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Export route
app.get('/api/export', require('./middleware/auth').authenticate, async (req, res) => {
  const pool = require('./config/database');
  const xlsx = require('xlsx');
  try {
    const { role, id } = req.user;
    let query = `
      SELECT 
        p.product_id  AS "Item Code",
        p.name        AS "Item Description",
        c.name        AS "Product Group",
        p.dealer_price AS "MOP",
        p.remarks      AS "PM Code",
        p.last_updated AS "Last Updated"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params = [];

    if (role === 'product_manager') {
      query += ` AND EXISTS (
        SELECT 1 FROM product_assignments pa 
        WHERE pa.category_id = p.category_id AND pa.product_manager_id = $1
      )`;
      params.push(id);
    }

    query += ' ORDER BY c.name, p.name';

    const result = await pool.query(query, params);

    const ws = xlsx.utils.json_to_sheet(result.rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Price List');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=price_list.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: err.message,
    stack: err.stack
  });
});

// Serve frontend in production (Skip on Vercel as Vercel serves static files)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  });
} else {
  // 404 handler for API routes
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found.' });
  });
}

// Start listener only if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export for Vercel Serverless
module.exports = app;
