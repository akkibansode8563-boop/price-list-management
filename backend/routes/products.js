const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { checkProductAccess } = require('../middleware/roleCheck');
const router = express.Router();

// Get all products with search, filter, pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      search, 
      brand, 
      category, 
      stockStatus, 
      minPrice, 
      maxPrice,
      itemCode,
      page = 1, 
      limit = 50,
      sortBy = 'last_updated',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const { role, id } = req.user;

    let baseQuery = `
      SELECT p.*, 
             b.name as brand_name, 
             c.name as category_name,
             u.first_name || ' ' || u.last_name as updated_by_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.updated_by = u.id
      WHERE p.is_active = true
    `;

    const params = [];
    let paramCount = 0;

    // Role-based filtering
    if (role === 'product_manager') {
      baseQuery += ` AND EXISTS (
        SELECT 1 FROM product_assignments pa 
        WHERE pa.category_id = p.category_id AND pa.product_manager_id = $${++paramCount}
      )`;
      params.push(id);
    }

    if (search) {
      const p1 = ++paramCount;
      const p2 = ++paramCount;
      const p3 = ++paramCount;
      const p4 = ++paramCount;
      baseQuery += ` AND (
        p.name ILIKE $${p1} OR 
        p.model_number ILIKE $${p2} OR 
        COALESCE(b.name, '') ILIKE $${p3} OR
        to_tsvector('english', p.name) @@ plainto_tsquery('english', $${p4})
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, search);
    }

    if (brand) {
      baseQuery += ` AND b.name = $${++paramCount}`;
      params.push(brand);
    }

    if (category) {
      baseQuery += ` AND c.id = $${++paramCount}`;
      params.push(category);
    }

    if (stockStatus) {
      baseQuery += ` AND p.stock_status = $${++paramCount}`;
      params.push(stockStatus);
    }

    if (minPrice) {
      baseQuery += ` AND p.dealer_price >= $${++paramCount}`;
      params.push(minPrice);
    }

    if (maxPrice) {
      baseQuery += ` AND p.dealer_price <= $${++paramCount}`;
      params.push(maxPrice);
    }

    if (itemCode) {
      baseQuery += ` AND p.product_id ILIKE $${++paramCount}`;
      params.push(`%${itemCode}%`);
    }

    // Count query
    const countResult = await pool.query(`SELECT COUNT(*) FROM (${baseQuery}) as count_query`, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Sorting
    const allowedSortColumns = ['name', 'dealer_price', 'special_price', 'last_updated', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'last_updated';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    baseQuery += ` ORDER BY p.${sortColumn} ${order}`;
    baseQuery += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(baseQuery, params);

    // Check favorites for sales managers
    if (role === 'sales_manager') {
      const favResult = await pool.query(
        'SELECT product_id FROM favorites WHERE user_id = $1',
        [id]
      );
      const favorites = new Set(favResult.rows.map(r => r.product_id));
      result.rows.forEach(row => {
        row.is_favorite = favorites.has(row.id);
      });
    }

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ message: 'Server error fetching products.' });
  }
});

// Get single product
router.get('/:productId', authenticate, checkProductAccess, async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await pool.query(
      `SELECT p.*, 
              b.name as brand_name, 
              c.name as category_name,
              u.first_name || ' ' || u.last_name as updated_by_name
       FROM products p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.updated_by = u.id
       WHERE p.id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Get price history
    const historyResult = await pool.query(
      `SELECT pl.*, u.first_name || ' ' || u.last_name as updated_by_name
       FROM price_update_logs pl
       LEFT JOIN users u ON pl.updated_by = u.id
       WHERE pl.product_id = $1
       ORDER BY pl.updated_at DESC
       LIMIT 20`,
      [productId]
    );

    const product = result.rows[0];
    product.priceHistory = historyResult.rows;

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create product (Admin & Product Manager)
router.post('/', authenticate, authorize('super_admin', 'product_manager'), [
  body('name').notEmpty().trim(),
  body('productId').notEmpty().trim(),
  body('categoryId').isInt(),
  body('dealerPrice').isDecimal(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, id } = req.user;
    const {
      productId, brandId, categoryId, name, modelNumber, specification,
      mrp, dealerPrice, specialPrice, stockStatus, availableQuantity,
      gstPercent, remarks
    } = req.body;

    // Check if product manager has access to this category
    if (role === 'product_manager') {
      const accessCheck = await pool.query(
        'SELECT id FROM product_assignments WHERE product_manager_id = $1 AND category_id = $2',
        [id, categoryId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ message: 'No access to this category.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO products (product_id, brand_id, category_id, name, model_number, specification,
       mrp, dealer_price, special_price, stock_status, available_quantity, gst_percent, remarks, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [productId, brandId, categoryId, name, modelNumber, specification,
       mrp, dealerPrice, specialPrice, stockStatus || 'In Stock', 
       availableQuantity || 0, gstPercent || 18.00, remarks, id]
    );

    // Notify sales managers
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_product_id)
       SELECT id, 'New Product Added', $1, 'info', $2 FROM users WHERE role_id = 
       (SELECT id FROM roles WHERE name = 'sales_manager')`,
      [`New product "${name}" has been added.`, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Product ID already exists.' });
    }
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error creating product.' });
  }
});

// Update product (Admin & Product Manager)
router.put('/:productId', authenticate, authorize('super_admin', 'product_manager'), checkProductAccess, [
  body('name').optional().trim(),
  body('dealerPrice').optional().isDecimal(),
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { id } = req.user;
    const updates = req.body;

    const allowedFields = {
      name: 'name',
      brandId: 'brand_id',
      categoryId: 'category_id',
      modelNumber: 'model_number',
      specification: 'specification',
      mrp: 'mrp',
      dealerPrice: 'dealer_price',
      specialPrice: 'special_price',
      stockStatus: 'stock_status',
      availableQuantity: 'available_quantity',
      gstPercent: 'gst_percent',
      remarks: 'remarks'
    };

    const setClause = [];
    const values = [];
    let paramCount = 0;

    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        setClause.push(`${dbField} = $${++paramCount}`);
        values.push(updates[key]);
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    setClause.push(`updated_by = $${++paramCount}`);
    values.push(id);
    values.push(productId);

    const query = `UPDATE products SET ${setClause.join(', ')} WHERE id = $${++paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Notify sales managers about price update
    if (updates.dealerPrice || updates.specialPrice || updates.stockStatus) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_product_id)
         SELECT id, 'Price/Stock Update', $1, 'warning', $2 FROM users WHERE role_id = 
         (SELECT id FROM roles WHERE name = 'sales_manager')`,
        [`Product "${result.rows[0].name}" has been updated. Check latest prices.`, result.rows[0].id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error updating product.' });
  }
});

// Delete product (soft delete - Admin only)
router.delete('/:productId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { productId } = req.params;

    await pool.query('UPDATE products SET is_active = false WHERE id = $1', [productId]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Toggle favorite (Sales Manager)
router.post('/:productId/favorite', authenticate, authorize('sales_manager'), async (req, res) => {
  try {
    const { productId } = req.params;
    const { id } = req.user;

    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND product_id = $2',
      [id, productId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2', [id, productId]);
      res.json({ isFavorite: false, message: 'Removed from favorites.' });
    } else {
      await pool.query('INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)', [id, productId]);
      res.json({ isFavorite: true, message: 'Added to favorites.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get favorites (Sales Manager)
router.get('/favorites/list', authenticate, authorize('sales_manager'), async (req, res) => {
  try {
    const { id } = req.user;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT p.*, b.name as brand_name, c.name as category_name
       FROM favorites f
       JOIN products p ON f.product_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE f.user_id = $1 AND p.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    result.rows.forEach(row => row.is_favorite = true);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
