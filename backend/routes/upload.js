const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'), false);
    }
  }
});

// Bulk upload products via Excel
router.post('/products', authenticate, authorize('super_admin', 'product_manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { id, role } = req.user;
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty.' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      duplicates: 0
    };

    // Get all categories and brands for validation
    const categoriesResult = await pool.query('SELECT id, name FROM categories');
    const brandsResult = await pool.query('SELECT id, name FROM brands');

    const categoriesMap = new Map(categoriesResult.rows.map(c => [c.name.toLowerCase(), c.id]));
    const brandsMap = new Map(brandsResult.rows.map(b => [b.name.toLowerCase(), b.id]));

    // Check product manager category access
    let allowedCategories = new Set();
    if (role === 'product_manager') {
      const assignResult = await pool.query(
        'SELECT category_id FROM product_assignments WHERE product_manager_id = $1',
        [id]
      );
      allowedCategories = new Set(assignResult.rows.map(r => r.category_id));
    }

    for (const [index, row] of data.entries()) {
      try {
        const rowNum = index + 2; // Excel row number (1-based + header)

        // Map columns — accepts both original Excel format and app format
        const productId     = row['Item Code'] || row['Item Code '] || row['Product ID'] || row['ProductID'] || row['product_id'];
        const brandName     = row['Brand'] || row['brand'];
        const categoryName  = row['Category'] || row['Product Group'] || row['category'];
        const name          = row['Item Description'] || row['Product Name'] || row['ProductName'] || row['name'];
        const model         = row['Model'] || row['Model Number'] || row['model_number'];
        const dealerPrice   = row['MOP'] || row['Dealer Price'] || row['DealerPrice'] || row['dealer_price'];
        const remarks       = row['ProductManager Code'] || row['Remarks'] || row['remarks'];
        const availableQty  = row['Available Quantity'] || row['available_quantity'];
        const gst           = row['GST %'] || row['gst_percent'];

        if (!productId || !name || !dealerPrice) {
          results.failed++;
          results.errors.push({ row: rowNum, error: 'Missing required fields (Item Code, Item Description, MOP)' });
          continue;
        }

        const categoryId = categoriesMap.get(categoryName?.toLowerCase());
        if (!categoryId) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Category "${categoryName}" not found.` });
          continue;
        }

        // Check access for product managers
        if (role === 'product_manager' && !allowedCategories.has(categoryId)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: 'Category not assigned to you.' });
          continue;
        }

        const brandId = brandName ? brandsMap.get(brandName.toLowerCase()) : null;

        // Check for duplicate product ID
        const existing = await pool.query('SELECT id FROM products WHERE product_id = $1', [productId]);

        if (existing.rows.length > 0) {
          // Update existing
          await pool.query(
            `UPDATE products SET
              brand_id = $1, category_id = $2, name = $3, model_number = $4,
              dealer_price = $5, stock_status = $6,
              available_quantity = $7, gst_percent = $8, remarks = $9, updated_by = $10
             WHERE product_id = $11`,
            [brandId, categoryId, name, model, dealerPrice,
             'In Stock', availableQty || 0, gst || 18.00, remarks, id, productId]
          );
          results.duplicates++;
        } else {
          // Insert new
          await pool.query(
            `INSERT INTO products (product_id, brand_id, category_id, name, model_number,
             dealer_price, stock_status, available_quantity, gst_percent, remarks, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [productId, brandId, categoryId, name, model, dealerPrice,
             'In Stock', availableQty || 0, gst || 18.00, remarks, id]
          );
        }

        results.success++;
      } catch (rowError) {
        results.failed++;
        results.errors.push({ row: index + 2, error: rowError.message });
      }
    }

    res.json({
      message: 'Upload processed.',
      results: {
        totalRows: data.length,
        created: results.success - results.duplicates,
        updated: results.duplicates,
        failed: results.failed,
        errors: results.errors.slice(0, 20) // Limit error details
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload.' });
  }
});

// Download Excel template
router.get('/template', authenticate, authorize('super_admin', 'product_manager'), async (req, res) => {
  try {
    const template = [
      {
        'Item Code':          'PROD001',
        'Item Description':   'Dell Inspiron 15 3511',
        'Product Group':      'LAPTOP DELL INSPIRON',
        'MOP':                48000.00,
        'ProductManager Code': 'JAYSINGH',
        'GST %':              18.00,
        'Remarks':            ''
      }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Products');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_upload_template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
