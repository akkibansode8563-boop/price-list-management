const pool = require('../config/database');

const checkProductAccess = async (req, res, next) => {
  try {
    const { role, id } = req.user;

    if (role === 'super_admin') {
      return next();
    }

    if (role === 'product_manager') {
      const { productId } = req.params;

      const result = await pool.query(
        `SELECT p.id FROM products p
         JOIN categories c ON p.category_id = c.id
         JOIN product_assignments pa ON c.id = pa.category_id
         WHERE p.id = $1 AND pa.product_manager_id = $2`,
        [productId, id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ message: 'You do not have access to this product.' });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const checkCategoryAccess = async (req, res, next) => {
  try {
    const { role, id } = req.user;

    if (role === 'super_admin') {
      return next();
    }

    if (role === 'product_manager') {
      const { categoryId } = req.params;

      const result = await pool.query(
        `SELECT id FROM product_assignments 
         WHERE product_manager_id = $1 AND category_id = $2`,
        [id, categoryId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ message: 'Category not assigned to you.' });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { checkProductAccess, checkCategoryAccess };
