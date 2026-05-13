const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { search, role, isActive, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
             u.is_active, u.last_login, u.created_at, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (search) {
      query += ` AND (u.first_name ILIKE $${++paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
      query += ` AND r.name = $${++paramCount}`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND u.is_active = $${++paramCount}`;
      params.push(isActive === 'true');
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as count_query`, params);
    const totalCount = parseInt(countResult.rows[0].count);

    query += ` ORDER BY u.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get single user
router.get('/:userId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
              u.is_active, u.last_login, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get assigned categories for product managers
    let assignments = [];
    if (result.rows[0].role === 'product_manager') {
      const assignResult = await pool.query(
        `SELECT c.id, c.name FROM categories c
         JOIN product_assignments pa ON c.id = pa.category_id
         WHERE pa.product_manager_id = $1`,
        [userId]
      );
      assignments = assignResult.rows;
    }

    res.json({ ...result.rows[0], assignments });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create user (Admin only)
router.post('/', authenticate, authorize('super_admin'), [
  body('email').isEmail().normalizeEmail(),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['super_admin', 'product_manager', 'sales_manager'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, firstName, lastName, password, role, phone, assignedCategories } = req.body;

    const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    const roleId = roleResult.rows[0].id;

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role_id, created_at`,
      [email, hashedPassword, firstName, lastName, roleId, phone]
    );

    const newUser = result.rows[0];

    // Assign categories if product manager
    if (role === 'product_manager' && assignedCategories && assignedCategories.length > 0) {
      for (const catId of assignedCategories) {
        await pool.query(
          `INSERT INTO product_assignments (product_manager_id, category_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [newUser.id, catId, req.user.id]
        );
      }
    }

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role,
      message: 'User created successfully.'
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists.' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error creating user.' });
  }
});

// Update user (Admin only)
router.put('/:userId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, isActive, assignedCategories } = req.body;

    const setClause = [];
    const values = [];
    let paramCount = 0;

    if (firstName !== undefined) {
      setClause.push(`first_name = $${++paramCount}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      setClause.push(`last_name = $${++paramCount}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      setClause.push(`phone = $${++paramCount}`);
      values.push(phone);
    }
    if (isActive !== undefined) {
      setClause.push(`is_active = $${++paramCount}`);
      values.push(isActive);
    }

    if (setClause.length > 0) {
      values.push(userId);
      await pool.query(
        `UPDATE users SET ${setClause.join(', ')} WHERE id = $${++paramCount}`,
        values
      );
    }

    // Update category assignments for product managers
    if (assignedCategories !== undefined) {
      await pool.query('DELETE FROM product_assignments WHERE product_manager_id = $1', [userId]);

      const userRole = await pool.query(
        `SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [userId]
      );

      if (userRole.rows[0]?.name === 'product_manager') {
        for (const catId of assignedCategories) {
          await pool.query(
            `INSERT INTO product_assignments (product_manager_id, category_id, assigned_by)
             VALUES ($1, $2, $3)`,
            [userId, catId, req.user.id]
          );
        }
      }
    }

    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Reset password (Admin only)
router.post('/:userId/reset-password', authenticate, authorize('super_admin'), [
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get login logs (Admin only)
router.get('/:userId/login-logs', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM login_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
