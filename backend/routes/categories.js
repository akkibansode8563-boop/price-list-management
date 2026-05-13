const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const { role, id } = req.user;

    let query = 'SELECT * FROM categories WHERE 1=1';
    const params = [];

    // Product managers only see their assigned categories
    if (role === 'product_manager') {
      query += ` AND id IN (SELECT category_id FROM product_assignments WHERE product_manager_id = $1)`;
      params.push(id);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create category (Admin only)
router.post('/', authenticate, authorize('super_admin'), [
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const result = await pool.query(
      'INSERT INTO categories (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Category already exists.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get brands
router.get('/brands/all', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create brand (Admin only)
router.post('/brands', authenticate, authorize('super_admin'), [
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Brand already exists.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
