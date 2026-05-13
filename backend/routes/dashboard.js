const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Admin Dashboard Stats
router.get('/admin', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = true');
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = true');
    const totalCategories = await pool.query('SELECT COUNT(*) FROM categories');

    const priceChangesToday = await pool.query(
      `SELECT COUNT(*) FROM price_update_logs 
       WHERE updated_at >= CURRENT_DATE`
    );

    const recentUpdates = await pool.query(
      `SELECT pl.*, p.name as product_name, u.first_name || ' ' || u.last_name as updated_by_name
       FROM price_update_logs pl
       JOIN products p ON pl.product_id = p.id
       JOIN users u ON pl.updated_by = u.id
       ORDER BY pl.updated_at DESC
       LIMIT 10`
    );

    const activeUsers = await pool.query(
      `SELECT COUNT(DISTINCT user_id) FROM login_logs 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND action = 'login'`
    );

    res.json({
      stats: {
        totalProducts: parseInt(totalProducts.rows[0].count),
        totalUsers: parseInt(totalUsers.rows[0].count),
        totalCategories: parseInt(totalCategories.rows[0].count),
        priceChangesToday: parseInt(priceChangesToday.rows[0].count),
        activeUsersLast7Days: parseInt(activeUsers.rows[0].count)
      },
      recentUpdates: recentUpdates.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Product Manager Dashboard
router.get('/product-manager', authenticate, authorize('product_manager'), async (req, res) => {
  try {
    const { id } = req.user;

    // Core portfolio stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN p.dealer_price > 0 THEN 1 ELSE 0 END) as priced_products,
        SUM(CASE WHEN p.stock_status = 'In Stock' THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN p.stock_status = 'Out of Stock' THEN 1 ELSE 0 END) as out_of_stock,
        COUNT(DISTINCT p.category_id) as category_count,
        COUNT(DISTINCT p.brand_id) as brand_count,
        ROUND(MIN(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as min_nlc,
        ROUND(MAX(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as max_nlc,
        ROUND(AVG(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as avg_nlc
      FROM products p
      JOIN product_assignments pa ON p.category_id = pa.category_id
      WHERE pa.product_manager_id = $1 AND p.is_active = true
    `, [id]);

    // Category breakdown (top 10 by product count)
    const categoryBreakdown = await pool.query(`
      SELECT c.name as category, COUNT(p.id) as product_count,
             ROUND(AVG(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as avg_nlc,
             ROUND(MIN(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as min_nlc,
             ROUND(MAX(p.dealer_price) FILTER (WHERE p.dealer_price > 0)::numeric, 2) as max_nlc
      FROM products p
      JOIN product_assignments pa ON p.category_id = pa.category_id
      JOIN categories c ON p.category_id = c.id
      WHERE pa.product_manager_id = $1 AND p.is_active = true
      GROUP BY c.id, c.name
      ORDER BY product_count DESC
      LIMIT 10
    `, [id]);

    // Top 10 highest value products
    const topProducts = await pool.query(`
      SELECT p.product_id, p.name, p.dealer_price, p.mrp, p.special_price,
             p.stock_status, c.name as category_name, b.name as brand_name
      FROM products p
      JOIN product_assignments pa ON p.category_id = pa.category_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE pa.product_manager_id = $1 AND p.is_active = true AND p.dealer_price > 0
      ORDER BY p.dealer_price DESC
      LIMIT 10
    `, [id]);

    // Recent price update logs
    const recentUpdates = await pool.query(`
      SELECT pl.*, p.name as product_name, p.product_id
      FROM price_update_logs pl
      JOIN products p ON pl.product_id = p.id
      WHERE pl.updated_by = $1
      ORDER BY pl.updated_at DESC
      LIMIT 10
    `, [id]);

    // Pending updates (products not updated in 30+ days)
    const pendingUpdates = await pool.query(`
      SELECT COUNT(*) FROM products p
      JOIN product_assignments pa ON p.category_id = pa.category_id
      WHERE pa.product_manager_id = $1 
      AND p.last_updated < CURRENT_DATE - INTERVAL '30 days'
      AND p.is_active = true
    `, [id]);

    const s = statsResult.rows[0];
    res.json({
      stats: {
        totalProducts:    parseInt(s.total_products),
        pricedProducts:   parseInt(s.priced_products || 0),
        inStock:          parseInt(s.in_stock || 0),
        outOfStock:       parseInt(s.out_of_stock || 0),
        categoryCount:    parseInt(s.category_count || 0),
        brandCount:       parseInt(s.brand_count || 0),
        minNlc:           parseFloat(s.min_nlc || 0),
        maxNlc:           parseFloat(s.max_nlc || 0),
        avgNlc:           parseFloat(s.avg_nlc || 0),
        pendingUpdates:   parseInt(pendingUpdates.rows[0].count)
      },
      categoryBreakdown: categoryBreakdown.rows,
      topProducts:       topProducts.rows,
      recentUpdates:     recentUpdates.rows
    });
  } catch (error) {
    console.error('PM Dashboard error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Sales Manager Dashboard
router.get('/sales', authenticate, authorize('sales_manager'), async (req, res) => {
  try {
    const { id } = req.user;

    const recentlyUpdated = await pool.query(
      `SELECT p.*, b.name as brand_name, c.name as category_name
       FROM products p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = true
       AND p.last_updated >= CURRENT_DATE - INTERVAL '3 days'
       ORDER BY p.last_updated DESC
       LIMIT 10`
    );

    const favoriteCount = await pool.query(
      'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
      [id]
    );

    const unreadNotifications = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [id]
    );

    res.json({
      stats: {
        recentlyUpdatedCount: recentlyUpdated.rows.length,
        favoriteCount: parseInt(favoriteCount.rows[0].count),
        unreadNotifications: parseInt(unreadNotifications.rows[0].count)
      },
      recentlyUpdated: recentlyUpdated.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
